/**
 * Cerebro de la publicación en redes, compartido por los scripts
 * (scripts/social/build-schedule.ts, publicar-directo.ts) y por la página
 * /redes que enseña al fundador qué sale, cuándo y qué salió.
 *
 * Aquí no hay red ni disco: solo el calendario de lanzamiento, el ritmo
 * humano y los textos. Quien llama pone el catálogo y el registro.
 */

import { formatoEuros } from "./premio";
import { diaYHoraMadrid } from "./cuando-sabado";

export const URL_WEB = "vibo-azure.vercel.app";
/** El enlace de descarga (src/app/app/route.ts): App Store en iPhone, portada en el resto; apunta el origen. */
export const URL_APP = `${URL_WEB}/app`;
export const TZ = "Europe/Madrid";

export type Lang = "es" | "en";
// cta (25 sep 2026): la llamada a comentar propia de cada formato de vídeo (scripts/social/formatos.ts).
export type Video = { file: string; mecanica: string; lang: Lang; tipo: string; pregunta: string | null; tags?: string; id?: string; variante?: string; gancho?: string; activo?: boolean; actualidad?: string; cta?: string; prioridad?: boolean };
export type Red = "youtube" | "x" | "instagram" | "tiktok" | "facebook" | "linkedin" | "threads" | "bluesky";
// 29 sep 2026 (fundador: "paramos las que no están ni activadas"; TikTok lo sube él a mano):
// el robot solo publica en Instagram, YouTube y X. TikTok daba 0 visitas con lo automático y
// Facebook, LinkedIn, Threads y Bluesky perdían el 100 % de las publicaciones.
// 29 sep 2026 (fundador: "me voy a centrar en TikTok, lo subo yo; el resto automático"):
// TikTok a mano; X parado; el robot solo YouTube e Instagram, 1 al día en español.
// 30 sep 2026 (fundador): TikTok ES lo lleva él a mano (carruseles). Instagram: carrusel 14:00
// (publicar-carruseles-ig.ts) + reel 20:00 (este robot). YouTube ES/EN y TikTok EN (@vibo.app2), robot.
// 1 oct 2026 (fundador, «actívalo en los dos»): X vuelve, en español e inglés. Del 15 al 29 sep trajo 44 visitas
// a la web, más que TikTok (31), YouTube (18) o Instagram (15) (tabla visita_origen).
export const REDES_PARADAS: Red[] = ["facebook", "linkedin", "threads", "bluesky"];
export const REDES: Red[] = (["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "threads", "bluesky"] as Red[]).filter((r) => !REDES_PARADAS.includes(r));
/** Redes que salen por Buffer (22 sep 2026): basta con conectar el canal en Buffer; si no está conectado, se salta sin error. */
export const REDES_BUFFER: Red[] = ["tiktok", "instagram", "facebook", "linkedin", "threads", "bluesky", "x"];

/**
 * Hashtags (decisión 15 sep 2026): 3-5 por vídeo, siempre la misma
 * estructura: 1 de marca + 2 de tema + hasta 2 del vídeo concreto
 * (campo "tags" en videos.json, p. ej. "#geografia #banderas"). Nada de
 * #fyp/#viral/#parati (no hacen nada y huelen a spam). Prohibidos por
 * línea roja: #sorteo, #ganadinero.
 */
export const HASHTAGS: Record<Lang, string> = {
  es: "#vibo #trivia #culturageneral",
  en: "#vibo #trivia #quiz",
};
export function hashtagsDe(v: Video): string {
  const extra = (v.tags ?? "").split(/\s+/).filter((t) => /^#\w+$/.test(t)).slice(0, 2);
  return [HASHTAGS[v.lang], ...extra].join(" ").trim();
}

/**
 * El calendario: día relativo al sábado S, hora Madrid y QUÉ va en cada hueco.
 * Los huecos fijos (cuenta atrás, bote, ritual, resumen) llevan su vídeo.
 * Los huecos de PREGUNTA (pool, 15 sep 2026) no: cada semana se eligen del
 * catálogo (tipo "pregunta", activo≠false) los que no han salido en 30 días,
 * en un orden distinto por semana, y de cada pregunta la variante de gancho
 * (a/b/c) que toca esa semana. Así el mismo calendario sirve todas las
 * semanas y /redes enseña qué gancho trae más gente.
 */
export type Hueco = { dia: number; hora: string; file?: string; pool?: "pregunta"; lang?: Lang; nota?: string };
// 29 sep 2026 (fundador: "igual nos estamos pasando"): pocos vídeos al día, solo
// en español, de los de grabación real (los animados están prohibidos). Antes
// eran 5-6 al día mezclando inglés en el mismo canal de YouTube.
// 29 sep 2026, noche (fundador: "yo subiría con el robot por lo menos 2 vídeos al día"): 14:00 y 20:00.
// 30 sep 2026 (fundador: "hay que poner en marcha el canal de YouTube en inglés"):
// además, 2 al día en inglés a las 17:00 y 23:00 (tarde de Reino Unido, mediodía
// y tarde de EE. UU.); solo van a YouTube EN (ver `networks` más abajo).
export const PLAN: Hueco[] = Array.from({ length: 10 }, (_, i) => i - 9).flatMap((dia) => [
  // 8 oct 2026 (fundador: «3 al día en YouTube»): 10:00, 14:00 y 20:00 en español (el tercero solo cabe en YouTube:
  // las demás redes siguen con su tope de 2).
  ...["10:00", "14:00", "20:00"].map((hora) => ({ dia, hora, pool: "pregunta" as const, lang: "es" as const })),
  ...["17:00", "23:00"].map((hora) => ({ dia, hora, pool: "pregunta" as const, lang: "en" as const })),
]);

/**
 * Pie de cada publicación. Desde el 21 sep 2026 abre con el DINERO (la
 * cifra real del bote, que llega en `bote`), no con la pregunta: lo que
 * nos diferencia tiene que leerse antes de que sigan bajando. Sin "gana
 * dinero" ni "sorteo" (línea roja): se dice la cifra y quién se la lleva.
 */
/**
 * "este sábado" solo si la partida cae en 7 días; si no, la fecha. (22 sep
 * 2026: la partida es el 17 oct y los pies decían "este sábado" desde
 * septiembre: quien viniera el 26 no encontraría nada.)
 */
export function cuandoPartida(empiezaEn: string | Date | undefined, lang: "es" | "en"): { frase: string; corta: string; hora: string } {
  const es = lang === "es";
  // 6 oct 2026: día y hora de la fecha REAL (domingos a las 20:00 desde la 002; la 001, sábado a las 18:00).
  if (!empiezaEn) return { frase: es ? "este domingo" : "this Sunday", corta: es ? "Domingo" : "Sunday", hora: es ? "20:00" : "8 PM" };
  const d = new Date(empiezaEn);
  const { dia, hora } = diaYHoraMadrid(d, es ? "es" : "en");
  const Dia = dia.charAt(0).toUpperCase() + dia.slice(1);
  if ((d.getTime() - Date.now()) / 86400000 <= 7) return { frase: es ? `este ${dia}` : `this ${dia}`, corta: Dia, hora };
  const larga = d.toLocaleDateString(es ? "es-ES" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const cortaF = d.toLocaleDateString(es ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(".", "");
  return { frase: es ? `el ${dia} ${larga}` : `on ${dia} ${larga}`, corta: `${Dia} ${cortaF}`, hora };
}

export function caption(v: Video, boteCents?: number, mesCents?: number, empiezaEn?: string | Date): string {
  const es = v.lang === "es";
  const cp = cuandoPartida(empiezaEn, v.lang);
  // 1 oct 2026: «Spain time» (en octubre España está en CEST, no CET).
  const cita = es ? `${cp.corta} ${cp.hora} · gratis · ${URL_APP}` : `${cp.corta} ${cp.hora} Spain time · free · ${URL_APP}`;
  const bote = boteCents ? formatoEuros(boteCents, es ? "es" : "en") : "";
  const mes = mesCents && mesCents > (boteCents ?? 0) ? formatoEuros(mesCents, es ? "es" : "en") : "";
  // 26 sep 2026: el total de la temporada NO se anuncia como "en juego este
  // sábado" (daba a entender 65 € el día 17). Premio del sábado + ligas aparte.
  // 29 sep 2026 (fundador: "le daría importancia a los premios porque no es lo
  // común, es lo que nos va a diferenciar"): 🏆 y la cifra, lo primero que se lee.
  // El paréntesis de la temporada se cae solo en TikTok/IG (texto corto).
  const dinero = bote
    ? es
      ? `🏆 ${bote} en premios ${cp.frase}${mes ? ` (${mes} esta temporada)` : ""}.`
      : `🏆 ${bote} in prizes ${cp.frase}${mes ? ` (${mes} this season)` : ""}.`
    : "";
  // Llamada a comentar (15 sep 2026): los comentarios son lo que más empuja
  // un vídeo en TikTok/IG. En "misterio" no hay respuesta en el vídeo: se
  // pide la apuesta. En el resto, si la sabía.
  if (v.pregunta) {
    const cta = v.cta ? v.cta
      : v.mecanica === "fabrica-misterio"
      ? (es ? "Esta cae en la partida. Deja tu respuesta en comentarios." : "This one's in the game. Drop your answer in the comments.")
      : v.mecanica === "fabrica-comenta"
      ? (es ? "¿A, B, C o D? Deja tu respuesta en comentarios 👇" : "A, B, C or D? Drop your answer in the comments 👇")
      // Formatos de varias preguntas (23 sep 2026): comentan su resultado.
      : v.mecanica === "fabrica-tres"
      ? (es ? "Comenta cuántas has acertado: 0, 1, 2 o 3 👇" : "Comment your score: 0, 1, 2 or 3 👇")
      : v.mecanica === "fabrica-escalera"
      ? (es ? "¿Hasta cuál llegaste? Comenta 1, 2 o 3 👇" : "How far did you get? Comment 1, 2 or 3 👇")
      : v.mecanica === "real-historia"
      ? (es ? "¿Tú habrías llegado hasta aquí? Comenta 👇" : "Would you have made it this far? Comment 👇")
      : (es ? "Comenta qué dijiste tú 👇" : "Comment what you picked 👇");
    // 26 sep 2026: ya no cobran siempre 5 (premios según apuntados, reglas.ts).
    const quien = bote ? (es ? " Los que más aguantan, cobran." : " Those who last longest get paid.") : "";
    // La pregunta del vídeo va en minúsculas (estilo TikTok); en el pie, con mayúscula.
    const pregunta = v.pregunta.replace(/^(¿?)(\p{L})/u, (_m, a: string, b: string) => a + b.toUpperCase());
    return `${dinero} ${pregunta} ${cta}${quien} ${cita}`.replace(/\s+/g, " ").trim();
  }
  if (v.tipo === "resumen") return es ? `Así fue la última partida. Datos reales. ${cita}` : `How the last game went. Real numbers. ${cita}`;
  if (v.tipo === "repeticion") return es ? `La última partida, pregunta a pregunta. ¿Hasta dónde habrías llegado tú? ${cita}` : `The last game, question by question. How far would you have got? ${cita}`;
  if (v.tipo === "bote") return es ? `El premio sube con cada registro. ${cita}` : `The prize grows with every sign-up. ${cita}`;
  return `${dinero} ${cita}`.trim();
}

/** Próximo día de partida. 6 oct 2026: domingos (antes sábados); el nombre se queda por compatibilidad. */
export const DIA_PARTIDA = 0; // 0 = domingo
export function proximoSabado(desde: Date): Date {
  const d = new Date(desde);
  d.setDate(d.getDate() + ((DIA_PARTIDA - d.getDay() + 7) % 7 || 7));
  return d;
}

export function fechaMas(base: Date, offsetDias: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

export type Fila = { date: string; time: string; networks: string[]; video: string; caption: string; hashtags: string; nota?: string; lang?: Lang };
/** Idioma de un vídeo por su nombre de fichero (los EN llevan " EN - "); para registros antiguos sin lang. */
export function langDeVideo(video: string): Lang { return / EN - /.test(video) ? "en" : "es"; }

/** Las filas del calendario para el sábado dado (lo mismo que acaba en schedule.csv). */
/** Qué vídeo de pregunta va en cada hueco "pool" esta semana (determinista: misma semana, misma elección). */
/**
 * Calentamiento de cuentas nuevas (18 sep 2026): los días ANTERIORES al
 * plan de 10 días. Solo preguntas, sin cuenta atrás ni bote (esos vídeos
 * solo tienen sentido pegados a una partida). Uno al día en español y uno
 * en inglés cada dos días: el planificador ya corta a 1 por red y día
 * durante los primeros 14 días (RITMO.CALENTAMIENTO_DIAS), así que esto
 * es el ritmo real, no una aspiración.
 */
export function planCalentamiento(desdeDia: number, hastaDia = -10): Hueco[] {
  const huecos: Hueco[] = [];
  // 19 sep 2026: 3 al día y por idioma, con al menos 3 h entre vídeos de la
  // misma cuenta (es la ráfaga, no el volumen, lo que hace que te tapen).
  // En Instagram el tope de 2 al día recorta el tercero solo.
  // 22 sep 2026 (fundador): las 21:30 era tarde. Mañana, sobremesa y tarde.
  const HORAS_ES = ["10:00", "14:00", "20:00"]; // 8 oct 2026: 3 al día en español (fundador)
  // 30 sep 2026 (fundador: "hay que poner en marcha el canal de YouTube en
  // inglés"): 2 al día en inglés, a horas de Reino Unido / EE. UU.
  const HORAS_EN = ["17:00", "23:00"];
  for (let d = desdeDia; d <= hastaDia; d++) {
    for (const h of HORAS_ES) huecos.push({ dia: d, hora: h, pool: "pregunta", lang: "es" });
    for (const h of HORAS_EN) huecos.push({ dia: d, hora: h, pool: "pregunta", lang: "en" });
  }
  return huecos;
}

export function elegirPreguntas(sabado: Date, catalogo: Video[], estado?: Estado, plan: Hueco[] = PLAN): Map<Hueco, Video> {
  const semana = fechaMas(sabado, 0);
  const desde = new Date(sabado.getTime() - (RITMO.NO_REPETIR_DIAS + 9) * 86400000).getTime();
  const grupo = (v: Video) => v.id ?? v.file;
  const recientes = new Set<string>();
  for (const p of estado?.publicados ?? []) {
    if ((p.estado === "ok" || p.estado === "borrador") && new Date(p.fecha).getTime() >= desde) {
      const v = catalogo.find((x) => `videos/${x.file}` === p.video);
      if (v) recientes.add(grupo(v));
    }
  }
  const eleccion = new Map<Hueco, Video>();
  for (const lang of ["es", "en"] as Lang[]) {
    // 26 sep 2026: los huecos que ya pasaron van al final del reparto; si no,
    // lo prioritario (actualidad, vídeos reales) caía en días pasados y se perdía.
    // 8 oct 2026: «futuro» = huecos que el robot aún no ha preparado. Sube a YouTube con hasta 8 h de adelanto
    // (publicar-directo --adelantar=8) y un hueco hecho cuenta como hecho sea cual sea el vídeo: lo fresco y lo
    // prioritario va a partir de ahí; antes, «hoy» entero contaba como futuro y lo nuevo caía en huecos ya hechos.
    const corte = Date.now() + 8.5 * 3600000;
    const todos = plan.filter((h) => h.pool === "pregunta" && h.lang === lang);
    const futuro = (h: Hueco) => madridADate(fechaMas(sabado, h.dia), h.hora).getTime() > corte;
    const huecos = [...todos.filter(futuro), ...todos.filter((h) => !futuro(h))];
    if (!huecos.length) continue;
    const grupos = new Map<string, Video[]>();
    // 1 oct 2026 (fundador): las listas de planes (ce69 en adelante) no van en vídeo. En YouTube casi no tienen
    // visitas (análisis de 918 Shorts en español); en Instagram ya salen como carrusel (publicar-carruseles-ig.ts).
    const esLista = (v: Video) => /^ce(69|[7-9]\d)/.test(v.id ?? "");
    // 8 oct 2026 (fundador: «si es mejor quitarlos, sí»): fuera también los «¿cuál eliges?» (ids ceNN). En YouTube
    // la gente los deja a la mitad (47-68 % visto) y los de datos curiosos se ven casi enteros (90 % o más).
    // En TikTok siguen (los sube el fundador a mano).
    const esCualEliges = (v: Video) => /^ce\d/.test(v.id ?? "");
    for (const v of catalogo) if (v.tipo === "pregunta" && v.lang === lang && v.activo !== false && !esLista(v) && !esCualEliges(v)) grupos.set(grupo(v), [...(grupos.get(grupo(v)) ?? []), v]);
    const orden = [...grupos.keys()].sort((a, b) => hashEstable(semana + a) - hashEstable(semana + b));
    // Primero los que no han salido en 30 días; si no llegan, se repiten los más antiguos (mejor repetir que callar).
    // Y antes que nada, los que TIENEN pregunta escrita (18 sep 2026): un
    // hueco de pregunta con un vídeo sin texto sale con el pie genérico y
    // parece un anuncio. Los 6 sin texto quedan al final, de reserva.
    const conTexto = (g: string) => grupos.get(g)!.some((v) => !!v.pregunta);
    // Actualidad (23 sep 2026, fundador: "preguntas de lo que está pasando
    // hoy"): las marcadas con `actualidad` van primero mientras sean frescas
    // (21 días desde la fecha) y no hayan salido ya.
    const fresca = (g: string) => grupos.get(g)!.some((v) => v.actualidad && Date.now() - new Date(v.actualidad).getTime() < 21 * 86400000);
    // Formatos por turnos (23 sep 2026, fundador: "probar distintos formatos
    // para ver cuál funciona"): una pregunta suelta, un "tres", una
    // "escalera"… Así cada formato sale los mismos días que los demás y la
    // comparación es justa (antes salían en bloques de 20 del mismo tipo).
    // 25 sep 2026: cada formato nuevo (formato-rapidas, formato-banderas…) tiene su propio turno.
    // 1 oct 2026 (fundador, tras ver que en YouTube lo que más funciona son las preguntas de curiosidad):
    // los «¿cuál eliges?» y las listas (ids ceNN) son su propia familia → se alternan 1 y 1 con las preguntas.
    const familia = (g: string) => { if (/^ce\d/.test(g)) return "cualeliges"; const m = grupos.get(g)![0].mecanica; return m === "fabrica-tres" || m === "fabrica-escalera" || m.startsWith("formato-") ? m : "pregunta"; };
    const porTurnos = (gs: string[]) => {
      const colas = new Map<string, string[]>();
      for (const g of gs) colas.set(familia(g), [...(colas.get(familia(g)) ?? []), g]);
      const fams = [...colas.values()];
      const out: string[] = [];
      for (let i = 0; out.length < gs.length; i++) for (const c of fams) if (c[i]) out.push(c[i]);
      return out;
    };
    // 8 oct 2026: `prioridad` (formatos en prueba, p. ej. las escaleras y03/y04) va delante de todo lo fresco: si no,
    // con más vídeos frescos que huecos en la semana, el orden al azar podía dejarlos fuera.
    const prioritaria = (g: string) => grupos.get(g)!.some((v) => v.prioridad);
    const cola = [
      ...orden.filter((g) => conTexto(g) && prioritaria(g) && !recientes.has(g)),
      ...porTurnos(orden.filter((g) => conTexto(g) && fresca(g) && !prioritaria(g) && !recientes.has(g))),
      ...porTurnos(orden.filter((g) => conTexto(g) && !fresca(g) && !prioritaria(g) && !recientes.has(g))),
      ...orden.filter((g) => conTexto(g) && recientes.has(g)),
      ...orden.filter((g) => !conTexto(g)),
    ];
    huecos.forEach((h, i) => {
      const g = cola[i % cola.length];
      if (!g) return;
      const variantes = grupos.get(g)!;
      eleccion.set(h, variantes[hashEstable(semana + g + "v") % variantes.length]);
    });
  }
  return eleccion;
}

export function construirFilas(sabado: Date, catalogo: Video[], estado?: Estado, plan: Hueco[] = PLAN, boteCents?: number, mesCents?: number, empiezaEn?: string): Fila[] {
  const porFile = new Map(catalogo.map((v) => [v.file, v]));
  // Hueco fijo cuyo vídeo está desactivado (18 sep 2026: los diseños
  // antiguos a 360p) → se convierte en un hueco de pregunta del mismo
  // idioma. La campaña sigue con preguntas en vez de callar ese hueco.
  plan = plan.map((p) => {
    if (!p.file) return p;
    const v = porFile.get(p.file);
    if (v && v.activo === false) return { dia: p.dia, hora: p.hora, pool: "pregunta" as const, lang: v.lang, nota: p.nota };
    return p;
  });
  const elegidos = elegirPreguntas(sabado, catalogo, estado, plan);
  return plan.map((p) => {
    const v = p.pool ? elegidos.get(p) : porFile.get(p.file!);
    if (!v) throw new Error(p.pool ? `No hay vídeos de pregunta (${p.lang}) en videos.json` : `PLAN usa un vídeo que no está en videos.json: ${p.file}`);
    return {
      date: fechaMas(sabado, p.dia),
      time: p.hora,
      // 30 sep 2026: ES → YouTube, y el de las 20:00 también reel en Instagram (fundador: "hay que mezclar":
      // carrusel a las 14:00 con publicar-carruseles-ig.ts + reel a las 20:00). TikTok ES, a mano. EN → YouTube, TikTok EN
      // (@vibo.app2, por Buffer) y X (8 oct 2026, fundador: «activamos TikTok inglés, no cuesta nada»).
      // 8 oct 2026: también reel a las 14:00 en vez del carrusel (con 2 seguidores, los carruseles tenían 0 visitas;
      // los reels sí tienen: Instagram los recomienda a quien no te sigue).
      networks: v.lang === "es" ? ["youtube", ...(["14:00", "20:00"].includes(p.hora) ? ["instagram"] : []), "x", "facebook", "threads", "bluesky", "linkedin"] : ["youtube", "tiktok", "x"],
      video: `videos/${v.file}`,
      caption: caption(v, boteCents, mesCents, empiezaEn),
      hashtags: hashtagsDe(v),
      nota: p.nota,
      lang: v.lang,
    };
  });
}

// ───────────── Tiempo (Madrid) ─────────────
export function partesMadrid(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24, minuto: Number(p.minute) };
}
/** "2026-09-17" + "14:00" en Madrid → Date. */
export function madridADate(date: string, time: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  const enMadrid = new Date(naive.toLocaleString("en-US", { timeZone: TZ }));
  const enUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naive.getTime() - (enMadrid.getTime() - enUtc.getTime()));
}
export const fmtMadrid = (d: Date) => d.toLocaleString("es-ES", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Hash estable sin crypto (vale en Node y en el servidor de Next). */
export function hashEstable(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // Mezcla final (23 sep 2026): sin ella, ids parecidos ("e01", "e02"…)
  // daban números parecidos y el calendario los ponía todos seguidos.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// ───────────── Ritmo humano ─────────────
export const RITMO = {
  ESCALON_MIN: [0, 25, 50, 80, 105, 130, 155, 180],
  JITTER_MIN: 8,
  GAP_MISMA_RED_MIN: 180,
  // 1 oct 2026 (fundador: "dijimos 2 cada día"): YouTube y TikTok, 2 al día por cuenta.
  // 8 oct 2026 (fundador: «3 al día en YouTube»): YouTube sube a 3; el resto, igual.
  TOPE_DIA: { tiktok: 2, instagram: 2, youtube: 3, x: 2, facebook: 2, linkedin: 1, threads: 3, bluesky: 3 } as Record<Red, number>,
  CALENTAMIENTO_DIAS: 2,
  NO_REPETIR_DIAS: 30,
  SILENCIO: { desde: 1, hasta: 7 },
  VENTANA_TARDE_MIN: 130, // el cron corre cada 2 h; con menos, se perderían posts
  ERRORES_PARA_PARAR: 2,
};
// 1 oct 2026: también las otras líneas rojas de marketing (CLAUDE.md): «bote», «un fallo y fuera», «cobran en euros».
export const PROHIBIDO = [/sorteo/i, /gana dinero/i, /dinero gratis/i, /\bbotes?\b/i, /un fallo y fuera/i, /cobran en euros/i];

export type Publicado = { clave: string; red: Red; video: string; fecha: string; estado: "ok" | "error" | "perdido" | "borrador"; id?: string; error?: string; lang?: Lang };
export type Estado = { publicados: Publicado[] };
export type Plan = { clave: string; red: Red; fila: Fila; cuando: Date; motivo?: string };

export function planificar(filas: Fila[], estado: Estado, ahora: Date, opciones: { cuentasCalientes?: boolean } = {}): Plan[] {
  const R = RITMO;
  const hechos = new Map(estado.publicados.map((p) => [p.clave, p]));
  // HUECO YA USADO (1 oct 2026, bug: «hemos subido demasiados»): build-schedule rehace el calendario cada hora y,
  // si cambia el catálogo, el mismo hueco (día|hora|red) recibe OTRO vídeo → clave nueva → se publicaba otra vez.
  // Un hueco publicado (o perdido) cuenta como hecho, sea cual sea el vídeo.
  const huecosHechos = new Set(estado.publicados.map((p) => p.clave.split("|").slice(0, 3).join("|")));
  // Cuenta = red + idioma (18 sep 2026): TikTok español y TikTok inglés son
  // cuentas distintas; antes el tope diario y el calentamiento las sumaban y
  // la segunda se quedaba sin publicar.
  const cuentaDe = (red: Red, lang: Lang) => `${red}|${lang}`;
  const langDe = (p: Publicado) => p.lang ?? langDeVideo(p.video);
  const porCuentaOk = (c: string) => estado.publicados.filter((p) => cuentaDe(p.red, langDe(p)) === c && (p.estado === "ok" || p.estado === "borrador"));
  const primera: Record<string, Date | undefined> = {};
  const ultimaPlan: Record<string, Date | undefined> = {};
  for (const red of REDES) for (const lang of ["es", "en"] as Lang[]) {
    const c = cuentaDe(red, lang);
    const xs = porCuentaOk(c).map((p) => new Date(p.fecha).getTime());
    if (xs.length) { primera[c] = new Date(Math.min(...xs)); ultimaPlan[c] = new Date(Math.max(...xs)); }
  }
  const cuentaDia = (c: string, dia: string) => porCuentaOk(c).filter((p) => partesMadrid(new Date(p.fecha)).dia === dia).length;
  const erroresDia = (c: string, dia: string) => estado.publicados.filter((p) => cuentaDe(p.red, langDe(p)) === c && p.estado === "error" && partesMadrid(new Date(p.fecha)).dia === dia).length;

  const planes: Plan[] = [];
  const contador: Record<string, number> = {};
  const ocupadosPor: Record<string, number[]> = {};
  const ordenadas = [...filas].sort((a, b) => madridADate(a.date, a.time).getTime() - madridADate(b.date, b.time).getTime());
  for (const f of ordenadas) {
    const redes = f.networks.filter((n): n is Red => (REDES as string[]).includes(n));
    if (!redes.length) continue;
    // Huecos ya perdidos (22 sep 2026): una fila cuya hora pasó hace más de la
    // ventana de retraso no se publica nunca (publicar-directo la marca
    // "perdido"), así que tampoco debe ocupar sitio en la cola: antes, al
    // cambiar las horas del plan, decenas de filas viejas empujaban TikTok e
    // Instagram dos días hacia delante.
    if (ahora.getTime() - madridADate(f.date, f.time).getTime() > (R.VENTANA_TARDE_MIN + 24 * 60) * 60000) continue;
    const desplaz = hashEstable(f.video) % redes.length;
    const orden = [...redes.slice(desplaz), ...redes.slice(0, desplaz)];
    const lang: Lang = f.lang ?? langDeVideo(f.video);
    orden.forEach((red, i) => {
      const clave = `${f.date}|${f.time}|${red}|${f.video}`;
      const c = cuentaDe(red, lang);
      if (hechos.has(clave) || huecosHechos.has(`${f.date}|${f.time}|${red}`)) return;
      const j = (hashEstable(clave) % (R.JITTER_MIN * 2 + 1)) - R.JITTER_MIN;
      let cuando = new Date(madridADate(f.date, f.time).getTime() + (R.ESCALON_MIN[i] + j) * 60000);
      const pm = partesMadrid(cuando);
      if (pm.hora >= R.SILENCIO.desde && pm.hora < R.SILENCIO.hasta) cuando = new Date(madridADate(pm.dia, "07:15").getTime() + Math.abs(j) * 60000);
      // Separación mínima con TODO lo que esa cuenta ya tiene (publicado,
      // programado en Buffer o planificado en esta pasada), no solo con el
      // último (22 sep 2026): un post programado para mañana bloqueaba todos
      // los huecos de hoy y la cuenta se quedaba en 1 al día.
      const gap = R.GAP_MISMA_RED_MIN * 60000;
      const ocupados = (ocupadosPor[c] ??= porCuentaOk(c).map((p) => new Date(p.fecha).getTime()));
      for (let intentos = 0; intentos < 20; intentos++) {
        const choque = ocupados.find((t) => Math.abs(t - cuando.getTime()) < gap);
        if (choque === undefined) break;
        cuando = new Date(choque + gap + Math.abs(j) * 60000);
      }

      const dia = partesMadrid(cuando).dia;
      const k = `${c}|${dia}`;
      contador[k] = contador[k] ?? cuentaDia(c, dia);
      // El calentamiento se mide contra la fecha DEL HUECO, no contra el momento
      // de ejecutar: si no, una sola pasada de hoy dejaba todo el calendario
      // futuro capado a 1 al día (19 sep 2026).
      // Calentamiento solo donde existe el "shadowban" de cuenta nueva (TikTok,
      // Instagram, Threads). YouTube y X no penalizan el volumen inicial (22 sep 2026).
      const conCalentamiento = red === "tiktok" || red === "instagram" || red === "threads";
      const calentando = conCalentamiento && !opciones.cuentasCalientes && (!primera[c] || cuando.getTime() - primera[c]!.getTime() < R.CALENTAMIENTO_DIAS * 86400000);
      const tope = calentando ? 1 : R.TOPE_DIA[red];
      let motivo: string | undefined;
      if (contador[k] >= tope) motivo = calentando ? "cuenta nueva: 1 al día" : "tope diario";
      else if (erroresDia(c, dia) >= R.ERRORES_PARA_PARAR) motivo = "red parada hoy por errores";
      // El resumen de la partida se llama igual cada semana pero es un vídeo nuevo (datos de esa partida): no cuenta como repetido.
      else if (!/Resumen|Repeticion/.test(f.video) && porCuentaOk(c).some((p) => p.video === f.video && ahora.getTime() - new Date(p.fecha).getTime() < R.NO_REPETIR_DIAS * 86400000)) motivo = "mismo vídeo hace <30 días";
      else if (PROHIBIDO.some((re) => re.test(f.caption + f.hashtags))) motivo = "texto prohibido (línea roja)";
      if (!motivo) { contador[k]++; ultimaPlan[c] = cuando; ocupados.push(cuando.getTime()); }
      planes.push({ clave, red, fila: f, cuando, motivo });
    });
  }
  return planes;
}

/** Texto por red: nunca calcado de una a otra. */
export function textoPara(red: Red, f: Fila): { texto: string; titulo: string } {
  const tags = f.hashtags.split(/\s+/).filter(Boolean);
  const rota = hashEstable(f.video + red) % Math.max(1, tags.length);
  const rotados = [...tags.slice(rota), ...tags.slice(0, rota)];
  const base = f.caption.replace(/·\s*vibo-azure\.vercel\.app(\/app)?/i, "").replace(/vibo-azure\.vercel\.app(\/app)?/i, "").trim();
  // Título = la pregunta (la primera frase acabada en "?"); antes se cortaba
  // en "Saturday" y en inglés el título de YouTube salía sin pregunta.
  // 6 oct 2026: cualquier día (domingos desde la 002), no solo «Sábado».
  const DIA_RE = /(?:Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/;
  const pregunta = (base.match(/[^.?!]*\?/)?.[0] ?? base.split(DIA_RE)[0]).replace(/^[\s(]*\)?\s*/, "").trim();
  const en = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|Spain time|free/i.test(f.caption) && !/gratis/i.test(f.caption);
  // Versión corta para TikTok/IG: sin el paréntesis del desglose, sin "¿La
  // sabías?", sin la línea de premiados y sin la cita final (van en sus líneas).
  const citaFinal = base.match(new RegExp(`${DIA_RE.source}[^.?!]*$`))?.[0] ?? "";
  const cuandoCorto = citaFinal ? citaFinal.replace(/\s*·\s*(gratis|free)\s*$/i, "").trim().replace(/\s+(\d{1,2}:\d{2}|\d{1,2}(?::\d{2})? [AP]M(?: CET| Spain time)?)$/, ", $1") + "." : "";
  const corto = base
    .replace(/\s*\([^)]*\)/, "")
    .replace(/¿La sabías\?\s*|Did you know it\?\s*/g, "")
    .replace(/\s*(Para los 5 mejores\.|Top 5 split it\.|Cuantos más jugáis, más premiados\.|More players, more winners\.|Los que más aguantan, cobran\.|Those who last longest get paid\.)/g, "")
    .replace(new RegExp(`\\s*${DIA_RE.source}[^.?!]*$`), "")
    .trim();
  // Cada red lleva su ?o= (§ migración 047): así /redes sabe qué red trae gente.
  const web = `https://${URL_APP}?o=${red === "youtube" ? "yt" : red}-${en ? "en" : "es"}`;
  switch (red) {
    // TikTok e Instagram (22 sep 2026): los enlaces del texto NO son clicables;
    // lo que convierte es el nombre para buscar en la tienda + "enlace en la bio".
    // TikTok e Instagram (22 sep 2026): sin enlace clicable (TikTok lo
    // desbloquea a 1.000 seguidores) → el texto tiene que cerrar solo. Tres
    // líneas: dinero + pregunta + comentar / gratis y quién cobra / cómo entrar.
    // 24 sep 2026 (recorrido "como un desconocido"): "Busca VIBO en la App
    // Store" dejaba fuera a Android (3 de cada 4 móviles en España): la web
    // se juega desde el navegador del móvil. Con dominio propio, URL_WEB.
    case "tiktok": return { titulo: pregunta.slice(0, 90), texto: `${corto}\n${en ? "Free. Those who last longest get paid." : "Gratis. Los que más aguantan, cobran."} ${cuandoCorto}\n${en ? `iPhone: search “VIBO” on the App Store. Android: ${URL_WEB}` : `iPhone: busca «VIBO» en la App Store. Android: ${URL_WEB}`}\n${rotados.slice(0, 4).join(" ")}`.trim() };
    case "instagram": return { titulo: "", texto: `${corto}\n${en ? "Free. Those who last longest get paid." : "Gratis. Los que más aguantan, cobran."} ${cuandoCorto}\n${en ? "Link in bio (iPhone and Android)." : "Enlace en la bio (iPhone y Android)."}\n\n${rotados.slice(0, 5).join(" ")}` };
    // 5 oct 2026: en Shorts solo se ve el título; sin «VIBO» en él nadie sabe qué buscar en la App Store
    // (6.675 vistas → 20 visitas → 0 altas). El nombre va al final para no comerse la pregunta.
    // 8 oct 2026 (fundador: misterio y premio, como en TikTok): la pregunta, cuándo, «con premio 💸» y qué buscar.
    // Fuera «🏆 20 € en premios…» y «los que más aguantan, cobran».
    case "youtube": {
      const cuando = cuandoCorto.replace(/\.$/, "");
      const gancho = en ? `${cuando ? `${cuando}, ` : ""}with a prize 💸. Search «vibo» on the App Store.` : `${cuando ? `${cuando}, ` : ""}con premio 💸. Busca «vibo» en la App Store.`;
      return { titulo: pregunta ? `${pregunta.slice(0, 92)} | VIBO` : "VIBO", texto: `${pregunta ? `${pregunta} 👀\n` : ""}${gancho}\n${web}\n\n${rotados.slice(0, 3).join(" ")}` };
    }
    case "x": {
      // X cuenta distinto (24 sep 2026: tres rechazos por "más de 280"): el €
      // y los emojis pesan 2 y cada enlace pesa 23. Se quitan primero los
      // hashtags y, si aún no cabe, se acorta el texto; el enlace nunca se corta.
      const pesoX = (t: string) => [...t.replace(/https?:\/\/\S+/g, "x".repeat(23))].reduce((n, c) => n + (c.codePointAt(0)! <= 0x10ff ? 1 : 2), 0);
      let t = `${base}\n${web} ${rotados.slice(0, 2).join(" ")}`;
      if (pesoX(t) > 275) t = `${base}\n${web}`;
      let b = base;
      while (pesoX(t) > 275 && b.length > 20) { b = b.slice(0, b.lastIndexOf(" ", b.length - 2)).replace(/[\s.,;:]+$/, "") + "…"; t = `${b}\n${web}`; }
      return { titulo: "", texto: t };
    }
    case "bluesky": return { titulo: "", texto: `${base}\n${web}`.slice(0, 300) };
    case "threads": return { titulo: "", texto: `${base}\n${web} ${rotados.slice(0, 3).join(" ")}`.slice(0, 500) };
    case "linkedin": return { titulo: "", texto: `${base}\n\n${en ? "Free to play. Live every Sunday at 8 PM (Spain)." : "Gratis. En directo cada domingo a las 20:00."}\n${web}\n\n${rotados.slice(0, 3).join(" ")}` };
    case "facebook": return { titulo: "", texto: `${base}\n${web}\n\n${rotados.slice(0, 3).join(" ")}` };
  }
}

/** Enlace público a lo publicado, si lo sabemos construir. */
export function enlacePublicado(p: Publicado): string | null {
  if (!p.id || p.estado !== "ok") return null;
  if (p.red === "youtube") return `https://youtube.com/shorts/${p.id}`;
  if (p.red === "x") return `https://x.com/i/status/${p.id}`;
  return null;
}
