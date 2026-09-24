/**
 * CENTINELA del sábado (sep 2026, tras el playtest que cazó el bug del
 * reloj): un segundo corazón INDEPENDIENTE que se despierta antes de la
 * partida y no se fía de nadie.
 *
 *  - Comprueba que el motor responde y que HAY partida en las próximas 2 h.
 *  - Si algo huele mal (motor caído, sábado sin partida sembrada, o la
 *    hora llegó y no arranca), TERMINA EN ERROR → GitHub manda email a
 *    Nicolás al momento. El silencio jamás será la primera noticia.
 *  - Si todo está bien, se queda de guardia latiendo hasta el arranque y
 *    los primeros minutos — aunque el reloj principal muriera, la partida
 *    empieza igual (las colisiones entre ambos las arbitra la BD, probado
 *    en el ensayo de carga).
 *
 * Corre solo los sábados (.github/workflows/centinela.yml) y también a
 * mano desde Actions → Centinela VIBO → Run workflow.
 */
const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
if (!APP_URL || !CRON_SECRET) {
  console.error("Faltan APP_URL o CRON_SECRET en los secrets del repo.");
  process.exit(1);
}

const MAX_MS = 27 * 60 * 1000;
const inicio = Date.now();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function tick() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(`${APP_URL}/api/cron`, {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      return await res.json();
    } catch (e) {
      console.error(`tick falló (${i}/3):`, e.message);
      if (i < 3) await espera(1500 * i);
    }
  }
  return null;
}

async function main() {
  let data = await tick();
  if (!data) {
    console.error("🔴 EL MOTOR NO RESPONDE (3 intentos). Revisar Vercel/Supabase YA.");
    process.exit(1);
  }
  console.log(new Date().toISOString(), data);

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
      data = (await tick()) ?? { accion: "tick_fallido" };
      if (data.accion === "esperando_inicio" && (data.faltan_ms ?? 1) <= 0) {
        // La hora llegó y sigue sin arrancar: 60 s de margen y alarma.
        retrasoDesde ??= Date.now();
        if (Date.now() - retrasoDesde > 60_000) {
          console.error("🔴 LA HORA LLEGÓ Y LA PARTIDA NO ARRANCA. Encender el reloj manual YA.");
          process.exit(1);
        }
      } else if (data.accion !== "esperando_inicio") {
        break; // arrancó: pasar al latido rápido
      }
    }
  }

  // Partida en marcha: latir rápido como un reloj más hasta el tope.
  while (Date.now() - inicio < MAX_MS) {
    await espera(1500);
    data = (await tick()) ?? { accion: "tick_fallido" };
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
