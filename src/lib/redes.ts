/**
 * Cerebro de la publicación en redes, compartido por los scripts
 * (scripts/social/build-schedule.ts, publicar-directo.ts) y por la página
 * /redes que enseña al fundador qué sale, cuándo y qué salió.
 *
 * Aquí no hay red ni disco: solo el calendario de lanzamiento, el ritmo
 * humano y los textos. Quien llama pone el catálogo y el registro.
 */

import { formatoEuros } from "./premio";

export const URL_WEB = "vibo-azure.vercel.app";
/** El enlace de descarga (src/app/app/route.ts): App Store en iPhone, portada en el resto; apunta el origen. */
export const URL_APP = `${URL_WEB}/app`;
export const TZ = "Europe/Madrid";

export type Lang = "es" | "en";
// cta (25 sep 2026): la llamada a comentar propia de cada formato de vídeo (scripts/social/formatos.ts).
export type Video = { file: string; mecanica: string; lang: Lang; tipo: string; pregunta: string | null; tags?: string; id?: string; variante?: string; gancho?: string; activo?: boolean; actualidad?: string; cta?: string };
export type Red = "youtube" | "x" | "instagram" | "tiktok" | "facebook" | "linkedin" | "threads" | "bluesky";
export const REDES: Red[] = ["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "threads", "bluesky"];
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
export const PLAN: Hueco[] = [
  // S-9 jueves — siembra (solo preguntas, cero marca)
  { dia: -9, hora: "08:00", pool: "pregunta", lang: "es" },
  { dia: -9, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -9, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -9, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-8 viernes — siembra + anuncio (FIJAR el de las 14:00)
  { dia: -8, hora: "08:00", pool: "pregunta", lang: "es" },
  { dia: -8, hora: "14:00", pool: "pregunta", lang: "es", nota: "FIJAR este post en el perfil" },
  { dia: -8, hora: "17:00", pool: "pregunta", lang: "en" },
  { dia: -8, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -8, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-7 sábado — ritual de ensayo
  { dia: -7, hora: "10:00", file: "Vibo Ad 11 - Ritual Sabado.mp4" },
  { dia: -7, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -7, hora: "18:00", pool: "pregunta", lang: "es", nota: "A la hora exacta de la partida: ancla la cita" },
  { dia: -7, hora: "17:00", pool: "pregunta", lang: "en" },
  { dia: -7, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -7, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-6 domingo — empieza la cuenta atrás
  { dia: -6, hora: "10:00", file: "Vibo Countdown 6 - Faltan 6.mp4" },
  { dia: -6, hora: "13:00", file: "Vibo Countdown 6 EN - 6 Days Left.mp4" },
  { dia: -6, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -6, hora: "17:00", pool: "pregunta", lang: "en" },
  { dia: -6, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -6, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-5 lunes
  { dia: -5, hora: "08:00", file: "Vibo Countdown 5 - Faltan 5.mp4" },
  { dia: -5, hora: "13:00", file: "Vibo Countdown 5 EN - 5 Days Left.mp4" },
  { dia: -5, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -5, hora: "17:00", pool: "pregunta", lang: "en" },
  { dia: -5, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -5, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-4 martes
  { dia: -4, hora: "08:00", file: "Vibo Countdown 4 - Faltan 4.mp4" },
  { dia: -4, hora: "13:00", file: "Vibo Countdown 4 EN - 4 Days Left.mp4" },
  { dia: -4, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -4, hora: "17:00", pool: "pregunta", lang: "en" },
  { dia: -4, hora: "21:00", pool: "pregunta", lang: "es" },
  { dia: -4, hora: "23:00", pool: "pregunta", lang: "en" },
  // S-3 miércoles — primera mención al bote
  { dia: -3, hora: "08:00", file: "Vibo Countdown 3 - Faltan 3.mp4" },
  { dia: -3, hora: "13:00", file: "Vibo Countdown 3 EN - 3 Days Left.mp4" },
  { dia: -3, hora: "17:00", file: "Vibo Promo Video EN.mp4" },
  { dia: -3, hora: "14:00", file: "Vibo Ad 36 - Bote Que Sube.mp4", nota: "Cifra real: pasar antes update-pot-video y re-exportar" },
  { dia: -3, hora: "21:00", file: "Vibo Promo Video.mp4" },
  { dia: -3, hora: "23:00", file: "Vibo Ad 37 EN - Growing Pot.mp4" },
  // S-2 jueves
  { dia: -2, hora: "08:00", file: "Vibo Countdown 2 - Faltan 2.mp4" },
  { dia: -2, hora: "13:00", file: "Vibo Countdown 2 EN - 2 Days Left.mp4" },
  { dia: -2, hora: "14:00", pool: "pregunta", lang: "es" },
  { dia: -2, hora: "21:00", pool: "pregunta", lang: "es" },
  // S-1 viernes
  { dia: -1, hora: "08:00", file: "Vibo Countdown 1 - Faltan 1.mp4" },
  { dia: -1, hora: "13:00", file: "Vibo Countdown 1 EN - 1 Days Left.mp4" },
  { dia: -1, hora: "14:00", pool: "pregunta", lang: "es", nota: "Cambiar user y comentario por uno real de la semana" },
  { dia: -1, hora: "21:00", file: "Vibo Ad 30 - Chat.mp4" },
  { dia: -1, hora: "23:00", file: "Vibo Ad 31 EN - Chat.mp4" },
  // S sábado — día de partida
  { dia: 0, hora: "10:00", file: "Vibo Countdown 0 - Faltan 0.mp4" },
  { dia: 0, hora: "13:00", file: "Vibo Countdown 0 EN - 0 Days Left.mp4" },
  { dia: 0, hora: "15:00", file: "Vibo Ad 36 - Bote Que Sube.mp4", nota: "Cifra actualizada del mismo día" },
  { dia: 0, hora: "17:30", file: "Vibo Ad 23 EN - Saturday Ritual.mp4" },
  // S-6 domingo — así fue la partida (datos reales; lo fabrica el robot
  // el domingo por la mañana con scripts/social/resumen-partida.ts). Si
  // no hay partida reciente, el MP4 no existe y el publicador lo salta.
  { dia: -6, hora: "12:00", file: "Vibo Resumen - Asi Fue La Partida.mp4", nota: "Datos reales de la partida del sábado" },
  { dia: -6, hora: "16:00", file: "Vibo Resumen EN - How It Went.mp4", nota: "Datos reales de la partida del sábado" },
  // S-6 domingo — la repetición entera, pregunta a pregunta (24 sep 2026, la
  // fabrica scripts/social/repeticion-partida.ts detrás del resumen).
  { dia: -6, hora: "19:00", file: "Vibo Repeticion - La Partida Pregunta A Pregunta.mp4", nota: "Repetición real del sábado" },
  { dia: -6, hora: "20:00", file: "Vibo Repeticion EN - The Whole Game.mp4", nota: "Repetición real del sábado" },
];

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
export function cuandoPartida(empiezaEn: string | Date | undefined, lang: "es" | "en"): { frase: string; corta: string } {
  const es = lang === "es";
  if (!empiezaEn) return { frase: es ? "este sábado" : "this Saturday", corta: es ? "Sábado" : "Saturday" };
  const d = new Date(empiezaEn);
  if ((d.getTime() - Date.now()) / 86400000 <= 7) return { frase: es ? "este sábado" : "this Saturday", corta: es ? "Sábado" : "Saturday" };
  const larga = d.toLocaleDateString(es ? "es-ES" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const cortaF = d.toLocaleDateString(es ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(".", "");
  return { frase: es ? `el sábado ${larga}` : `on Saturday ${larga}`, corta: es ? `Sábado ${cortaF}` : `Saturday ${cortaF}` };
}

export function caption(v: Video, boteCents?: number, mesCents?: number, empiezaEn?: string | Date): string {
  const es = v.lang === "es";
  const cp = cuandoPartida(empiezaEn, v.lang);
  const cita = es ? `${cp.corta} 18:00 · gratis · ${URL_APP}` : `${cp.corta} 6 PM CET · free · ${URL_APP}`;
  const bote = boteCents ? formatoEuros(boteCents, es ? "es" : "en") : "";
  const mes = mesCents && mesCents > (boteCents ?? 0) ? formatoEuros(mesCents, es ? "es" : "en") : "";
  const dinero = mes
    ? (es ? `${mes} en juego ${cp.frase} (${bote} de premio + ligas).` : `${mes} on the line ${cp.frase} (${bote} prize + leagues).`)
    : bote ? (es ? `${bote} en juego ${cp.frase}.` : `${bote} on the line ${cp.frase}.`) : "";
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
      : (es ? "¿La sabías? Dilo en comentarios." : "Did you know it? Say so in the comments.");
    const quien = bote ? (es ? " Para los 5 mejores." : " Top 5 split it.") : "";
    return `${dinero} ${v.pregunta} ${cta}${quien} ${cita}`.replace(/\s+/g, " ").trim();
  }
  if (v.tipo === "resumen") return es ? `Así fue la partida del sábado. Datos reales. ${cita}` : `How Saturday's game went. Real numbers. ${cita}`;
  if (v.tipo === "repeticion") return es ? `La partida del sábado, pregunta a pregunta. ¿Hasta dónde habrías llegado tú? ${cita}` : `Saturday's game, question by question. How far would you have got? ${cita}`;
  if (v.tipo === "bote") return es ? `El premio sube con cada registro. ${cita}` : `The prize grows with every sign-up. ${cita}`;
  return `${dinero} ${cita}`.trim();
}

export function proximoSabado(desde: Date): Date {
  const d = new Date(desde);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
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
  const HORAS_ES = ["11:00", "14:30", "19:00"];
  const HORAS_EN = ["15:00", "19:30", "23:00"];
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
    const huecos = plan.filter((h) => h.pool === "pregunta" && h.lang === lang);
    if (!huecos.length) continue;
    const grupos = new Map<string, Video[]>();
    for (const v of catalogo) if (v.tipo === "pregunta" && v.lang === lang && v.activo !== false) grupos.set(grupo(v), [...(grupos.get(grupo(v)) ?? []), v]);
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
    const familia = (g: string) => { const m = grupos.get(g)![0].mecanica; return m === "fabrica-tres" || m === "fabrica-escalera" || m.startsWith("formato-") ? m : "pregunta"; };
    const porTurnos = (gs: string[]) => {
      const colas = new Map<string, string[]>();
      for (const g of gs) colas.set(familia(g), [...(colas.get(familia(g)) ?? []), g]);
      const fams = [...colas.values()];
      const out: string[] = [];
      for (let i = 0; out.length < gs.length; i++) for (const c of fams) if (c[i]) out.push(c[i]);
      return out;
    };
    const cola = [
      ...orden.filter((g) => conTexto(g) && fresca(g) && !recientes.has(g)),
      ...porTurnos(orden.filter((g) => conTexto(g) && !fresca(g) && !recientes.has(g))),
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
      networks: v.lang === "es" ? ["tiktok", "instagram", "youtube", "x", "facebook", "threads", "bluesky", "linkedin"] : ["tiktok", "instagram", "youtube", "x", "threads", "bluesky"],
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
  TOPE_DIA: { tiktok: 3, instagram: 2, youtube: 3, x: 4, facebook: 2, linkedin: 1, threads: 3, bluesky: 3 } as Record<Red, number>,
  CALENTAMIENTO_DIAS: 2,
  NO_REPETIR_DIAS: 30,
  SILENCIO: { desde: 1, hasta: 7 },
  VENTANA_TARDE_MIN: 130, // el cron corre cada 2 h; con menos, se perderían posts
  ERRORES_PARA_PARAR: 2,
};
export const PROHIBIDO = [/sorteo/i, /gana dinero/i, /dinero gratis/i];

export type Publicado = { clave: string; red: Red; video: string; fecha: string; estado: "ok" | "error" | "perdido" | "borrador"; id?: string; error?: string; lang?: Lang };
export type Estado = { publicados: Publicado[] };
export type Plan = { clave: string; red: Red; fila: Fila; cuando: Date; motivo?: string };

export function planificar(filas: Fila[], estado: Estado, ahora: Date, opciones: { cuentasCalientes?: boolean } = {}): Plan[] {
  const R = RITMO;
  const hechos = new Map(estado.publicados.map((p) => [p.clave, p]));
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
      if (hechos.has(clave)) return;
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
  const pregunta = (base.match(/[^.?!]*\?/)?.[0] ?? base.split("Sábado")[0].split("Saturday")[0]).replace(/^[\s(]*\)?\s*/, "").trim();
  const en = /Saturday/i.test(f.caption);
  // Versión corta para TikTok/IG: sin el paréntesis del desglose, sin "¿La
  // sabías?", sin "Para los 5 mejores." y sin la cita final (van en sus líneas).
  const citaFinal = base.match(/(?:Sábado|Saturday)[^.?!]*$/)?.[0] ?? "";
  const cuandoCorto = citaFinal ? citaFinal.replace(/\s*·\s*(gratis|free)\s*$/i, "").trim().replace(/\s+(18:00|6 PM CET)$/, ", $1") + "." : "";
  const corto = base
    .replace(/\s*\([^)]*\)/, "")
    .replace(/¿La sabías\?\s*|Did you know it\?\s*/g, "")
    .replace(/\s*(Para los 5 mejores\.|Top 5 split it\.)/g, "")
    .replace(/\s*(Sábado|Saturday)[^.?!]*$/, "")
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
    case "tiktok": return { titulo: pregunta.slice(0, 90), texto: `${corto}\n${en ? "Free. Top 5 get paid." : "Gratis. Los 5 mejores cobran."} ${cuandoCorto}\n${en ? `iPhone: search “VIBO” on the App Store. Android: ${URL_WEB}` : `iPhone: busca «VIBO» en la App Store. Android: ${URL_WEB}`}\n${rotados.slice(0, 4).join(" ")}`.trim() };
    case "instagram": return { titulo: "", texto: `${corto}\n${en ? "Free. Top 5 get paid." : "Gratis. Los 5 mejores cobran."} ${cuandoCorto}\n${en ? "Link in bio (iPhone and Android)." : "Enlace en la bio (iPhone y Android)."}\n\n${rotados.slice(0, 5).join(" ")}` };
    case "youtube": return { titulo: (pregunta || "VIBO").slice(0, 100), texto: `${base}\n${web}\n\n${rotados.slice(0, 3).join(" ")}` };
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
    case "linkedin": return { titulo: "", texto: `${base}\n\n${en ? "Free to play. Live every Saturday." : "Gratis. En directo cada sábado."}\n${web}\n\n${rotados.slice(0, 3).join(" ")}` };
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
