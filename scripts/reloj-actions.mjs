/**
 * Reloj del servidor para GitHub Actions (alternativa gratuita a Railway).
 *
 * Sin dependencias a propósito: cada ejecución de un workflow programado
 * cuenta minutos de la cuota gratis (2000/mes en repos privados), y instalar
 * node_modules en cada run sería el verdadero gasto. Usa fetch nativo.
 *
 * Se dispara cada 5 min (.github/workflows/reloj.yml). Si no hay nada que
 * hacer, sale enseguida (unos segundos). Si hay una partida activa o a
 * punto de empezar, se queda tickeando cada 1.5 s hasta que termine o hasta
 * un máximo de 25 min (el siguiente disparo programado retoma si hiciera
 * falta más tiempo).
 */
const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
if (!APP_URL || !CRON_SECRET) {
  console.error("Faltan APP_URL o CRON_SECRET en los secrets del repo.");
  process.exit(1);
}

const INACTIVAS = new Set(["sin_partida_activa", "esperando_inicio"]);
const MAX_MS = 25 * 60 * 1000;
const inicio = Date.now();

async function tick() {
  const res = await fetch(`${APP_URL}/api/cron`, {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    // Un latido colgado no puede congelar el run entero (25 sep 2026).
    signal: AbortSignal.timeout(30_000),
  });
  return res.json();
}

/**
 * Un fetch fallido (red, timeout, 500 puntual) no debe matar el proceso:
 * eso dejaría una partida en curso congelada hasta el siguiente disparo
 * programado (hasta 5 min). Reintenta con backoff corto antes de rendirse
 * — si los 3 intentos fallan, se trata como un tick vacío y el bucle de
 * fuera lo vuelve a intentar 1.5 s después, como si nada.
 */
async function tickConReintentos() {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      return await tick();
    } catch (e) {
      console.error(new Date().toISOString(), `tick() falló (intento ${intento}/3):`, e.message);
      if (intento < 3) await new Promise((r) => setTimeout(r, 1000 * intento));
    }
  }
  return { accion: "tick_fallido" };
}

/**
 * Despierta las rutas que van a tocar los jugadores.
 *
 * En Vercel cada ruta es una funcion independiente, asi que tener el
 * reloj llamando a /api/cron cada 5 minutos NO mantiene despiertas ni la
 * pantalla de partida ni el endpoint de estado. Y una funcion dormida
 * tarda 1-3 segundos en arrancar.
 *
 * Eso caeria en el peor momento posible: la app duerme toda la semana y
 * de golpe, a la hora en punto, entra todo el mundo a la vez. El primero
 * en llegar se come el arranque en frio justo cuando empieza la partida.
 *
 * Estas peticiones no hacen nada: solo obligan a la funcion a existir.
 * Los errores se ignoran a proposito — si el calentamiento falla no debe
 * tumbar el reloj, que es lo que de verdad importa.
 */
async function calentar() {
  const rutas = ["/", "/partida", "/api/partida/estado"];
  await Promise.all(
    rutas.map((r) =>
      fetch(`${APP_URL}${r}`, { headers: { "user-agent": "vibo-calentamiento" } }).catch(() => {})
    )
  );
  console.log(new Date().toISOString(), "rutas de jugador calentadas");
}

async function main() {
  let data = await tickConReintentos();
  console.log(new Date().toISOString(), data);

  // 'esperando_inicio' significa que hay partida programada y aun no ha
  // empezado: es exactamente la ventana en la que conviene ir
  // despertando lo que los jugadores van a abrir.
  if (data.accion === "esperando_inicio") await calentar();

  // EL BUG DEL PLAYTEST (sep 2026): antes, con partida a punto de empezar,
  // este run se despedia igualmente — y como GitHub dispara los schedules
  // con hasta 10-15 min de retraso, la partida podia arrancar un cuarto
  // de hora tarde con todo el mundo mirando el 0. Ahora, si el arranque
  // esta a menos de 45 min, el run SE QUEDA de guardia (latido suave cada
  // 10 s) hasta que empiece; el tope de 25 min y la cola de concurrencia
  // garantizan el relevo sin huecos ni solapes.
  const cercaDeEmpezar = data.accion === "esperando_inicio" && (data.faltan_ms ?? Infinity) <= 45 * 60 * 1000;
  if (INACTIVAS.has(data.accion) && !cercaDeEmpezar) {
    console.log("Sin partida activa — este run termina aquí.");
    return;
  }
  if (cercaDeEmpezar) {
    console.log(`Partida a ${Math.round((data.faltan_ms ?? 0) / 60000)} min: este run se queda de guardia.`);
    let vueltas = 0;
    while (Date.now() - inicio < MAX_MS) {
      await new Promise((r) => setTimeout(r, 10_000));
      data = await tickConReintentos();
      if (data.accion !== "esperando_inicio") break; // arrancó (o cambió algo): al bucle rápido
      // Las funciones se enfrían en pocos minutos: recalentar cada ~2 min
      // durante la guardia, para que a las 18:00:00 nadie pague el arranque.
      if (++vueltas % 12 === 0) await calentar();
    }
    await calentar();
    console.log(new Date().toISOString(), data);
  }
  while (Date.now() - inicio < MAX_MS) {
    await new Promise((r) => setTimeout(r, 1500));
    data = await tickConReintentos();
    if (!INACTIVAS.has(data.accion)) console.log(new Date().toISOString(), data);
    if (INACTIVAS.has(data.accion)) {
      console.log("Partida terminada — saliendo.");
      break;
    }
  }
}

main().catch((e) => {
  // Red de seguridad final: si algo inesperado revienta fuera de tick()
  // (nunca debería, pero mejor no dejar el run en 'failed' silencioso sin
  // rastro), que quede al menos en los logs de GitHub Actions.
  console.error(new Date().toISOString(), "main() falló:", e);
  process.exit(1);
});
