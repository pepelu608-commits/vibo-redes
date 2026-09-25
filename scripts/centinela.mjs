/**
 * CENTINELA del sábado (sep 2026, tras el playtest que cazó el bug del
 * reloj): un segundo corazón INDEPENDIENTE que se despierta antes de la
 * partida y no se fía de nadie.
 *
 *  - Comprueba que el motor responde y que HAY partida en las próximas 2 h.
 *  - Si algo huele mal (motor caído, sábado sin partida sembrada, o la
 *    hora llegó y no arranca), TERMINA EN ERROR → GitHub manda email a
 *    Nicolás al momento. El silencio jamás será la primera noticia.
 *  - Si todo está bien, se queda de guardia hasta el arranque y los
 *    primeros minutos.
 *
 * NUNCA LATE A LA VEZ QUE EL RELOJ (auditoría 25 sep 2026). Antes latían los
 * dos cada 1,5 s y el motor no está hecho para eso: dos latidos a la vez
 * podían abrir la misma pregunta dos veces (en la de reacción cambiaban los
 * colores con la gente ya mirando) o cerrarla dos veces (comodines gastados
 * dos veces, contador de vivos mal). Ahora:
 *
 *  - Si hay un run del reloj en marcha o en cola (API de GitHub), el
 *    centinela SOLO MIRA: lee el estado público (/api/partida/publico), que
 *    no mueve nada.
 *  - Si no hay reloj (GitHub no lo lanzó o se retrasó), late él.
 *  - Si hay reloj pero la partida no avanza (run colgado), lo da por muerto,
 *    late él y lo deja escrito en el registro. Si luego arranca un run NUEVO
 *    del reloj, le devuelve el testigo.
 *
 * Corre solo los sábados (.github/workflows/centinela.yml) y también a
 * mano desde Actions → Centinela VIBO → Run workflow.
 */
const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
// El reloj vive en el repo público vibo-redes; la copia a mano del repo
// privado lo indica con RELOJ_REPO.
const REPO = process.env.RELOJ_REPO ?? process.env.GITHUB_REPOSITORY;
const GH_TOKEN = process.env.GITHUB_TOKEN;
if (!APP_URL || !CRON_SECRET) {
  console.error("Faltan APP_URL o CRON_SECRET en los secrets del repo.");
  process.exit(1);
}

const MAX_MS = 27 * 60 * 1000;
// Una pregunta dura 6-8 s + 0,7 de gracia + 4 s de hueco: 40 s sin ningún
// cambio con partida en curso es que nadie está moviendo el reloj.
const ATASCO_MS = 40_000;
const inicio = Date.now();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toISOString();

async function tick() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(`${APP_URL}/api/cron`, {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
        signal: AbortSignal.timeout(30_000),
      });
      return await res.json();
    } catch (e) {
      console.error(`tick falló (${i}/3):`, e.message);
      if (i < 3) await espera(1500 * i);
    }
  }
  return null;
}

/** Estado de la partida SIN moverla (el mismo que ven los jugadores). */
async function mirar() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(`${APP_URL}/api/partida/publico`, { signal: AbortSignal.timeout(15_000) });
      const d = await res.json();
      const g = d.game;
      if (!g || !["programada", "en_curso", "desempate"].includes(g.estado)) return { accion: "sin_partida_activa", mirado: true };
      if (g.estado === "programada") {
        return { accion: "esperando_inicio", faltan_ms: new Date(g.empieza_en).getTime() - Date.now(), mirado: true };
      }
      const p = d.pregunta;
      return { accion: "en_curso", mirado: true, orden: p?.orden ?? null, firma: `${g.estado}|${p?.orden}|${p?.abierta_en}|${p?.cerrada_en}` };
    } catch (e) {
      console.error(`mirar falló (${i}/3):`, e.message);
      if (i < 3) await espera(1500 * i);
    }
  }
  return null;
}

// ¿Hay un run del reloj EN MARCHA? Se pregunta a GitHub como mucho cada 8 s:
// un run que arranca tarda más que eso en dar su primer latido (descargar el
// código y Node). Los runs que el centinela dio por colgados no cuentan.
const colgados = new Set();
let visto = { cuando: 0, activos: [] };
async function relojesActivos() {
  if (Date.now() - visto.cuando < 8000) return visto.activos;
  let activos = visto.activos;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/reloj.yml/runs?per_page=20`, {
      headers: { authorization: `Bearer ${GH_TOKEN}`, accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const { workflow_runs } = await res.json();
      activos = workflow_runs.filter((r) => r.status === "in_progress").map((r) => r.id);
    } else {
      console.error(`API de GitHub respondió ${res.status}: se sigue con lo último que se sabía.`);
    }
  } catch (e) {
    console.error("API de GitHub no responde:", e.message);
  }
  visto = { cuando: Date.now(), activos };
  return activos;
}
// Para latir hacen falta 10 s seguidos sin reloj (dos preguntas a GitHub):
// en el relevo entre dos runs del reloj hay unos segundos sin ninguno en
// marcha y el siguiente está a punto de empezar.
let sinRelojDesde = null;
async function hayReloj() {
  if ((await relojesActivos()).some((id) => !colgados.has(id))) {
    sinRelojDesde = null;
    return true;
  }
  sinRelojDesde ??= Date.now();
  return Date.now() - sinRelojDesde < 10_000;
}
// Sin token no se puede saber si el reloj está: no se late (el sistema de
// siempre, el reloj, sigue) y se avisa en el registro.
if (!REPO || !GH_TOKEN) {
  console.error("Falta GITHUB_TOKEN/GITHUB_REPOSITORY: el centinela solo mirará.");
  visto = { cuando: Infinity, activos: ["desconocido"] };
}

let ultimoCambio = Date.now();
let ultimaFirma = null;
let lateYo = false;
/** Un latido si el reloj no está (o está colgado); si está, solo mirar. */
async function pulso() {
  if (await hayReloj()) {
    if (lateYo) console.log(hora(), "Ha vuelto un reloj: el centinela vuelve a solo mirar.");
    lateYo = false;
    const d = await mirar();
    if (d?.firma !== ultimaFirma) {
      ultimaFirma = d?.firma;
      ultimoCambio = Date.now();
    }
    // Partida en curso y nada se mueve: el run del reloj está colgado.
    const atasco = d?.accion === "en_curso" && Date.now() - ultimoCambio > ATASCO_MS;
    // Hora de empezar pasada 20 s y sigue sin arrancar: igual.
    const noArranca = d?.accion === "esperando_inicio" && (d.faltan_ms ?? 1) < -20_000;
    if (!atasco && !noArranca) return d;
    const activos = await relojesActivos();
    activos.forEach((id) => colgados.add(id));
    sinRelojDesde = Date.now() - 10_000; // el rescate sigue sin pausa
    console.error(hora(), `⚠️ El reloj no mueve la partida (runs ${activos.join(", ")}): late el centinela.`);
  }
  if (!lateYo) console.log(hora(), "Sin reloj en marcha: late el centinela.");
  lateYo = true;
  ultimoCambio = Date.now();
  return await tick();
}

async function main() {
  let data = await pulso();
  if (!data) {
    console.error("🔴 EL MOTOR NO RESPONDE (3 intentos). Revisar Vercel/Supabase YA.");
    process.exit(1);
  }
  console.log(hora(), data);

  if (data.accion === "sin_partida_activa") {
    console.error("🔴 SÁBADO SIN PARTIDA SEMBRADA. Revisar auto-semanal / sembrar a mano.");
    process.exit(1);
  }

  // Partida programada: hacer guardia hasta que arranque (o hasta el tope
  // del run — el reloj principal y el siguiente centinela relevan).
  if (data.accion === "esperando_inicio") {
    const faltanMin = Math.round((data.faltan_ms ?? 0) / 60000);
    console.log(`Partida en ${faltanMin} min. Guardia activada.`);
    if ((data.faltan_ms ?? 0) > 2 * 60 * 60 * 1000) {
      console.log("Falta más de 2 h — nada que vigilar todavía. Salgo limpio.");
      return;
    }
    let retrasoDesde = null;
    while (Date.now() - inicio < MAX_MS) {
      await espera(10_000);
      data = (await pulso()) ?? { accion: "tick_fallido" };
      if (data.accion === "esperando_inicio" && (data.faltan_ms ?? 1) <= 0) {
        // La hora llegó y sigue sin arrancar: 60 s de margen y alarma.
        retrasoDesde ??= Date.now();
        if (Date.now() - retrasoDesde > 60_000) {
          console.error("🔴 LA HORA LLEGÓ Y LA PARTIDA NO ARRANCA. Encender el reloj manual YA.");
          process.exit(1);
        }
      } else if (data.accion !== "esperando_inicio" && data.accion !== "tick_fallido") {
        break; // arrancó: pasar a la guardia de la partida
      }
    }
  }

  // Partida en marcha: guardia hasta el tope. Latiendo cada 1,5 s solo si
  // el reloj no está; mirando cada 3 s si está.
  while (Date.now() - inicio < MAX_MS) {
    await espera(lateYo ? 1500 : 3000);
    data = (await pulso()) ?? { accion: "tick_fallido" };
    if (["sin_partida_activa", "esperando_inicio"].includes(data.accion)) {
      console.log("Partida terminada (o sin nada activo). Guardia cumplida.");
      return;
    }
  }
  console.log("Tope del run alcanzado con partida activa — el relevo continúa.");
}

main().catch((e) => {
  console.error("🔴 centinela reventó:", e);
  process.exit(1);
});
