/**
 * PUBLICADOR DIRECTO — sube los vídeos a las redes hablando con sus APIs
 * oficiales (YouTube, X, Instagram, TikTok), sin Metricool ni Buffer.
 * Cero coste al mes. Corre cada hora en GitHub Actions.
 *
 * DRY-RUN POR DEFECTO: sin --apply enseña qué publicaría y no llama a
 * ninguna API. Nada sale sin que el fundador haya activado SOCIAL_APPLY.
 *
 * Lee schedule.csv (fecha y hora en Madrid, generado por build-schedule.ts)
 * y aplica un RITMO HUMANO antes de publicar, que es lo que evita que las
 * redes traten la cuenta como spam (shadowban):
 *
 *   · Nunca el mismo vídeo en todas las redes en el mismo minuto: se
 *     escalona 0 / +25 / +50 / +80 min, y el orden de las redes rota.
 *   · Cada publicación se mueve unos minutos al azar (fijo por vídeo, así
 *     el dry-run y el real coinciden). Ninguna sale a una hora "en punto".
 *   · Mínimo 3 h entre publicaciones en la misma red. Tope diario por red.
 *   · Silencio de 01:00 a 07:00 Madrid: lo de esa franja se aplaza.
 *   · Cuenta nueva (menos de 14 días desde la primera publicación en esa
 *     red): 1 vídeo al día. Las redes castigan el arranque a lo bruto.
 *     Si las cuentas ya llevan tiempo publicando a mano, la variable
 *     SOCIAL_CUENTAS_CALIENTES=true salta este calentamiento.
 *   · El mismo vídeo no se repite en la misma red en 30 días.
 *   · Texto distinto en cada red (hashtags distintos, orden distinto): el
 *     mismo texto calcado en cuatro sitios es la firma de un robot.
 *   · Dos errores seguidos en una red en el día → esa red se para hasta
 *     mañana (no insistimos contra un bloqueo).
 *   · Si el cron llega tarde (más de 130 min), la publicación se marca
 *     "perdida" y NO se recupera en avalancha.
 *
 * TikTok: hasta que TikTok audite la app, el vídeo se deja en los
 * BORRADORES del fundador (endpoint inbox); él lo publica con un toque.
 * Tras la auditoría, cambiar TIKTOK_DIRECTO=true para publicar del tirón.
 *
 * Estado en publicados.json (el workflow lo commitea): qué salió, cuándo,
 * con qué id, y los errores.
 *
 * Secrets necesarios (GitHub → Settings → Secrets → Actions):
 *   YouTube:   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (canal "Vibo", es)
 *              y YT_REFRESH_TOKEN_EN (canal "Vibo-en"): cada vídeo va al canal de su idioma
 *   X:         X_CLIENT_ID, X_CLIENT_SECRET, X_REFRESH_TOKEN
 *   Instagram: IG_USER_ID, IG_ACCESS_TOKEN (token largo, caduca a los 60 días:
 *              el script avisa cuando falla)
 *              + la subida del MP4 (Instagram
 *              exige una URL pública: bucket "social"; en la nube con la firma de GitHub, sin llave)
 *   TikTok:    TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
 *   BUFFER (camino preferido para TikTok e Instagram, decisión 15 sep 2026):
 *              BUFFER_TOKEN (cuenta española, viboapp1) y BUFFER_TOKEN_EN
 *              (cuenta inglesa, pepelu608), "Personal Key" del plan gratis.
 *              El robot deja el post PROGRAMADO en Buffer a la hora del plan
 *              y Buffer lo publica en TikTok/Instagram. Sin apps de
 *              desarrollador ni auditorías. Los canales se descubren por la
 *              API (service = tiktok / instagram); el MP4 se sirve desde el
 *              bucket público "social" de Supabase. Si hay token de Buffer,
 *              se usa; si no, se intenta el camino directo de cada red.
 * Una red sin sus secrets se salta con aviso; las demás siguen.
 *
 * Uso:
 *   npx tsx scripts/social/publicar-directo.ts              # dry-run
 *   npx tsx scripts/social/publicar-directo.ts --plan       # todo el plan con horas reales
 *   npx tsx scripts/social/publicar-directo.ts --apply      # publica lo que toca AHORA
 */
import * as fs from "fs";
import * as path from "path";
import {
  planificar, textoPara, fmtMadrid as fmt, RITMO, langDeVideo, REDES_BUFFER, type Red, type Fila, type Publicado, type Estado,
} from "../../src/lib/redes";

const CARPETA = __dirname;
const RAIZ = path.resolve(CARPETA, "../..");
const VIDEOS = path.join(RAIZ, "social");
const ESTADO_PATH = path.join(CARPETA, "publicados.json");
const VENTANA_TARDE_MIN = RITMO.VENTANA_TARDE_MIN;

function parseCsv(texto: string): Fila[] {
  return texto.trim().split("\n").slice(1).filter(Boolean).map((l) => {
    const campos = l.match(/("([^"]|"")*"|[^,]+)/g)!.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
    const [date, time, networks, video, caption, hashtags] = campos;
    return { date, time, networks: networks.split(";").map((n) => n.trim()), video, caption, hashtags, lang: langDeVideo(video) };
  });
}

// ───────────── Adaptadores ─────────────
async function json(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  const t = await r.text();
  let b: any = {};
  try { b = JSON.parse(t); } catch { b = { raw: t }; }
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]} → ${t.slice(0, 300)}`);
  return b;
}
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

async function tokenGoogle(en: boolean) {
  const refresh = en ? process.env.YT_REFRESH_TOKEN_EN : process.env.YT_REFRESH_TOKEN;
  if (!refresh) throw new Error(`falta ${en ? "YT_REFRESH_TOKEN_EN" : "YT_REFRESH_TOKEN"} (canal ${en ? "Vibo-en" : "Vibo"})`);
  const b = await json("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ client_id: process.env.YT_CLIENT_ID!, client_secret: process.env.YT_CLIENT_SECRET!, refresh_token: refresh, grant_type: "refresh_token" }) });
  return b.access_token as string;
}
// 25 sep 2026: GitHub se salta muchas ejecuciones programadas (el 24 corrió 5
// veces en vez de 12) y lo que pasaba de hora se perdía: el canal ES dejó de
// publicar. Si la hora del plan aún no ha llegado, el vídeo se sube PRIVADO con
// publishAt y YouTube lo publica solo a esa hora, corra o no el robot.
async function publicarYoutube(mp4: string, titulo: string, texto: string, en: boolean, cuando?: Date) {
  const token = await tokenGoogle(en);
  const bytes = fs.readFileSync(mp4);
  const programado = cuando && cuando.getTime() > Date.now() + 15 * 60000;
  const status = programado
    ? { privacyStatus: "private", publishAt: cuando!.toISOString(), selfDeclaredMadeForKids: false }
    : { privacyStatus: "public", selfDeclaredMadeForKids: false };
  const meta = { snippet: { title: titulo, description: texto, categoryId: "24", defaultLanguage: en ? "en" : "es" }, status };
  const inicio = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-upload-content-type": "video/mp4", "x-upload-content-length": String(bytes.length) }, body: JSON.stringify(meta) });
  if (!inicio.ok) throw new Error(`youtube init ${inicio.status} ${await inicio.text()}`);
  const subida = inicio.headers.get("location")!;
  const r = await json(subida, { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "video/mp4" }, body: bytes });
  await miniaturaYoutube(r.id as string, mp4, token);
  return r.id as string;
}

/**
 * Miniatura en YouTube (fundador, 22 sep 2026): YouTube elegía solo un
 * fotograma y a menudo caía en la RESPUESTA (el tic verde), que mata la
 * curiosidad. Se saca el mismo segundo que en Buffer (miniaturaMs: pregunta
 * + cuenta atrás) con ffmpeg y se sube con thumbnails.set. Si el canal no
 * está verificado por teléfono, YouTube lo rechaza (403): se avisa y sigue.
 */
async function miniaturaYoutube(videoId: string, mp4: string, token: string) {
  const { execFileSync } = await import("child_process");
  const jpg = path.join(require("os").tmpdir(), `vibo-mini-${videoId}.jpg`);
  try {
    let ffmpeg = "ffmpeg";
    try { ffmpeg = require("ffmpeg-static") as string; } catch {}
    execFileSync(ffmpeg, ["-y", "-ss", (miniaturaMs(mp4) / 1000).toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "2", jpg], { stdio: "ignore" });
    const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" }, body: fs.readFileSync(jpg) });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    console.log("  ✓ miniatura puesta (segundo " + (miniaturaMs(mp4) / 1000).toFixed(1) + ")");
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.log(msg.includes("403") || /forbidden|verif/i.test(msg)
      ? "  ⚠ miniatura no puesta: el canal tiene que estar verificado por teléfono en YouTube (Ajustes → Canal → Verificación)."
      : `  ⚠ miniatura no puesta: ${msg.slice(0, 160)}`);
  } finally { try { fs.unlinkSync(jpg); } catch {} }
}

async function tokenX() {
  const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const b = await json("https://api.x.com/2/oauth2/token", { method: "POST", headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "refresh_token", refresh_token: process.env.X_REFRESH_TOKEN! }) });
  if (b.refresh_token && b.refresh_token !== process.env.X_REFRESH_TOKEN) console.log("  ⚠ X ha rotado el refresh token: actualizar el secret X_REFRESH_TOKEN =", b.refresh_token.slice(0, 6) + "…");
  return b.access_token as string;
}
async function publicarX(mp4: string, texto: string) {
  const token = await tokenX();
  const bytes = fs.readFileSync(mp4);
  const h = { authorization: `Bearer ${token}` };
  const init = await json("https://api.x.com/2/media/upload", { method: "POST", headers: { ...h, "content-type": "application/x-www-form-urlencoded" },
    body: form({ command: "INIT", media_type: "video/mp4", media_category: "tweet_video", total_bytes: String(bytes.length) }) });
  const mediaId = init.data?.id ?? init.media_id_string;
  const TROZO = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < bytes.length; i += TROZO, seg++) {
    const fd = new FormData();
    fd.set("command", "APPEND"); fd.set("media_id", mediaId); fd.set("segment_index", String(seg));
    fd.set("media", new Blob([bytes.subarray(i, i + TROZO)]), "trozo.mp4");
    const r = await fetch("https://api.x.com/2/media/upload", { method: "POST", headers: h, body: fd });
    if (!r.ok) throw new Error(`x append ${r.status} ${await r.text()}`);
  }
  let fin = await json("https://api.x.com/2/media/upload", { method: "POST", headers: { ...h, "content-type": "application/x-www-form-urlencoded" }, body: form({ command: "FINALIZE", media_id: mediaId }) });
  for (let i = 0; i < 20 && (fin.data?.processing_info ?? fin.processing_info)?.state !== "succeeded"; i++) {
    const pi = fin.data?.processing_info ?? fin.processing_info;
    if (!pi || pi.state === "failed") throw new Error("x: el vídeo no se procesó");
    await new Promise((r) => setTimeout(r, (pi.check_after_secs ?? 3) * 1000));
    fin = await json(`https://api.x.com/2/media/upload?command=STATUS&media_id=${mediaId}`, { headers: h });
  }
  const tweet = await json("https://api.x.com/2/tweets", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ text: texto, media: { media_ids: [mediaId] } }) });
  return tweet.data.id as string;
}

/** ¿Puede subir vídeos? En la nube, con la firma de GitHub; en el Mac, con la llave de .env.local. */
const puedeSubir = () => !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function urlPublica(mp4: string): Promise<string> {
  // Instagram no acepta bytes: quiere una URL pública. Bucket "social" de Supabase (público, solo lectura).
  // En la nube (24 sep 2026), SIN llave maestra: GitHub firma que esto es el
  // robot de vibo-redes y VIBO da permiso para subir solo este vídeo
  // (/api/redes/subida). La llave maestra ya no está en el repositorio público.
  if (process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    const vibo = process.env.VIBO_URL ?? "https://vibo-azure.vercel.app";
    const firma = await json(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=vibo-redes`, { headers: { authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
    const permiso = await json(`${vibo}/api/redes/subida`, { method: "POST", headers: { authorization: `Bearer ${firma.value}`, "content-type": "application/json" }, body: JSON.stringify({ nombre: path.basename(mp4).replace(/[^a-zA-Z0-9._-]/g, "_") }) });
    const r = await fetch(permiso.subir, { method: "PUT", headers: { "content-type": "video/mp4", "x-upsert": "true" }, body: fs.readFileSync(mp4) });
    if (!r.ok) throw new Error(`subida ${r.status} ${await r.text()}`);
    return permiso.publica as string;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const nombre = `videos/${path.basename(mp4).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const r = await fetch(`${base}/storage/v1/object/social/${nombre}`, { method: "POST", headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "video/mp4", "x-upsert": "true" }, body: fs.readFileSync(mp4) });
  if (!r.ok) throw new Error(`storage ${r.status} ${await r.text()} (¿existe el bucket público "social"?)`);
  return `${base}/storage/v1/object/public/social/${nombre}`;
}
async function publicarInstagram(mp4: string, texto: string) {
  const uid = process.env.IG_USER_ID!, token = process.env.IG_ACCESS_TOKEN!;
  const video_url = await urlPublica(mp4);
  const c = await json(`https://graph.facebook.com/v21.0/${uid}/media`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ media_type: "REELS", video_url, caption: texto, share_to_feed: "true", access_token: token }) });
  for (let i = 0; i < 30; i++) {
    const s = await json(`https://graph.facebook.com/v21.0/${c.id}?fields=status_code,status&access_token=${token}`, {});
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error(`instagram: ${s.status}`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  const p = await json(`https://graph.facebook.com/v21.0/${uid}/media_publish`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ creation_id: c.id, access_token: token }) });
  return p.id as string;
}

async function tokenTikTok() {
  const b = await json("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: process.env.TIKTOK_REFRESH_TOKEN! }) });
  if (b.refresh_token && b.refresh_token !== process.env.TIKTOK_REFRESH_TOKEN) console.log("  ⚠ TikTok ha rotado el refresh token: actualizar el secret TIKTOK_REFRESH_TOKEN");
  return b.access_token as string;
}
async function publicarTikTok(mp4: string, titulo: string): Promise<{ id: string; borrador: boolean }> {
  const token = await tokenTikTok();
  const bytes = fs.readFileSync(mp4);
  const directo = process.env.TIKTOK_DIRECTO === "true";
  const url = directo ? "https://open.tiktokapis.com/v2/post/publish/video/init/" : "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
  const body: any = { source_info: { source: "FILE_UPLOAD", video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 } };
  if (directo) body.post_info = { title: titulo, privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_comment: false, disable_stitch: false };
  const init = await json(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const r = await fetch(init.data.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(bytes.length), "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
  if (!r.ok) throw new Error(`tiktok upload ${r.status} ${await r.text()}`);
  return { id: init.data.publish_id, borrador: !directo };
}

// ───────────── Buffer (TikTok, Instagram, Facebook, LinkedIn, Threads, Bluesky) ─────────────
/** Red sin canal conectado en Buffer: se salta, no cuenta como error (no para la red). */
class SinCanal extends Error {}
const BUFFER_API = "https://api.buffer.com";
async function graphqlBuffer(token: string, query: string) {
  const r = await json(BUFFER_API, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ query }) });
  if (r.errors?.length) throw new Error("buffer: " + r.errors.map((e: any) => e.message).join("; "));
  return r.data;
}
function tokenBuffer(en: boolean) { return en ? process.env.BUFFER_TOKEN_EN : process.env.BUFFER_TOKEN; }
/**
 * Tercera cuenta de Buffer (22 sep 2026): Buffer gratis admite 3 canales por
 * cuenta, y las dos que hay ya llevan TikTok + Instagram. X, Facebook, Threads,
 * LinkedIn y Bluesky salen por una cuenta extra (BUFFER_TOKEN_EXTRA) si existe;
 * si no, se buscan en la cuenta del idioma. Sin canal conectado: se salta.
 */
const REDES_EXTRA: Red[] = ["x", "facebook", "threads", "linkedin", "bluesky"];
function tokensBufferPara(red: Red, en: boolean): string[] {
  const t = [] as string[];
  if (REDES_EXTRA.includes(red) && process.env.BUFFER_TOKEN_EXTRA) t.push(process.env.BUFFER_TOKEN_EXTRA);
  const propio = tokenBuffer(en);
  if (propio) t.push(propio);
  return t;
}
async function canalBuffer(token: string, red: Red): Promise<string> {
  const cuenta = await graphqlBuffer(token, "{ account { organizations { id } } }");
  const org = cuenta.account.organizations[0]?.id;
  if (!org) throw new Error("buffer: la cuenta no tiene organización");
  const d = await graphqlBuffer(token, `{ channels(input:{organizationId:"${org}"}) { id name service isQueuePaused } }`);
  // Buffer llama "twitter" a X; el resto coincide con nuestro nombre.
  const servicio = red === "x" ? "twitter" : red;
  const c = d.channels.find((x: any) => x.service === servicio);
  if (!c) throw new SinCanal(`buffer: no hay canal de ${red} conectado en esta cuenta`);
  if (c.isQueuePaused) throw new Error(`buffer: la cola de ${red} (${c.name}) está en pausa`);
  return c.id as string;
}
/**
 * Deja el post programado en Buffer para `cuando` (o dentro de 3 min si ya pasó). Devuelve el id del post.
 * Miniatura (fundador, 22 sep 2026): en el segundo 3,2 del vídeo, no en el 1,5. Ahí se ve la
 * pregunta con la cuenta atrás en marcha y la banda "20 € este sábado" arriba: curiosidad + dinero.
 * Antes caía en la pantalla del dinero a secas; y nunca en la respuesta, que mata la curiosidad.
 */
/**
 * Segundo del vídeo que se usa como miniatura, según cómo está montado cada
 * uno (fundador, 22 sep 2026: "en el momento adecuado de cada vídeo"):
 *  - fábrica (revela/final/misterio): 0,8 s → la pantalla de apertura (dinero / "pregunta 9 de 10").
 *  - resumen de partida y bote: 1,0 s → la cifra grande ya en pantalla.
 *  - promos/countdown/cara: 0,8 s → el primer rótulo, antes de cualquier corte.
 */
function miniaturaMs(mp4: string): number {
  const file = path.basename(mp4);
  let mecanica = "";
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(CARPETA, "videos.json"), "utf8")) as { videos: { file: string; mecanica?: string }[] };
    mecanica = cat.videos.find((v) => v.file === file)?.mecanica ?? "";
  } catch {}
  // Fundador, 23 sep 2026: la miniatura es el PRIMER segundo (la pantalla del
  // dinero / "pregunta 9 de 10"), nunca la respuesta ni la cuenta atrás.
  if (/^fabrica-/.test(mecanica) || /^Fab /.test(file)) return 800;
  if (/resumen|bote|repeticion/.test(mecanica) || /Resumen|Bote|Repeticion/.test(file)) return 1000;
  return 800;
}

/**
 * Modo "aviso" de Buffer (fundador, 23 sep 2026): los vídeos que Buffer
 * publicaba solo en TikTok tenían 0 visitas y el subido a mano 125. Con
 * `notification`, a la hora prevista Buffer manda una notificación al móvil
 * con el vídeo y el texto, y se publica desde la app de la red (sale como
 * subido a mano). Variable SOCIAL_MANUAL_REDES (por defecto "tiktok,instagram");
 *
 */
function modoBuffer(red: Red): "automatic" | "notification" {
  const manuales = (process.env.SOCIAL_MANUAL_REDES ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return manuales.includes(red) ? "notification" : "automatic";
}

async function publicarBuffer(mp4: string, texto: string, red: Red, en: boolean, cuando: Date): Promise<string> {
  // Primera cuenta de Buffer que tenga el canal conectado (la extra primero para X/Facebook/Threads…).
  let token = "", canal = "", ultimo: Error | null = null;
  for (const t of tokensBufferPara(red, en)) {
    try { canal = await canalBuffer(t, red); token = t; break; } catch (e: any) { ultimo = e; if (!(e instanceof SinCanal)) throw e; }
  }
  if (!token) throw ultimo ?? new SinCanal(`buffer: no hay canal de ${red}`);
  const url = await urlPublica(mp4);
  const thumbnailOffset = miniaturaMs(mp4);
  const dueAt = new Date(Math.max(cuando.getTime(), Date.now() + 3 * 60000)).toISOString();
  const esc = (t: string) => JSON.stringify(t);
  const d = await graphqlBuffer(token, `mutation { createPost(input: {
      text: ${esc(texto)}, channelId: ${esc(canal)}, schedulingType: ${modoBuffer(red)}, mode: customScheduled, dueAt: ${esc(dueAt)},
      assets: [{ video: { url: ${esc(url)}, metadata: { thumbnailOffset: ${thumbnailOffset} } } }]${red === "instagram" ? ", metadata: { instagram: { type: reel, shouldShareToFeed: true } }" : ""}
    }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`);
  if (d.createPost?.message) throw new Error("buffer: " + d.createPost.message);
  return d.createPost.post.id as string;
}

function tieneSecrets(red: Red, en = false) {
  if (REDES_BUFFER.includes(red) && tokensBufferPara(red, en).length && puedeSubir()) return true;
  const req: Partial<Record<Red, string[]>> = {
    youtube: ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"], x: ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REFRESH_TOKEN"],
    instagram: ["IG_USER_ID", "IG_ACCESS_TOKEN"], tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"],
  };
  return (req[red] ?? [""]).every((k) => k && process.env[k]) && (red !== "instagram" || puedeSubir());
}

// ───────────── Principal ─────────────
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const verPlan = args.includes("--plan");
  const ahora = new Date();

  const csvPath = path.join(CARPETA, "schedule.csv");
  if (!fs.existsSync(csvPath)) throw new Error("No hay schedule.csv — genera primero con build-schedule.ts");
  const filas = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const estado: Estado = fs.existsSync(ESTADO_PATH) ? JSON.parse(fs.readFileSync(ESTADO_PATH, "utf8")) : { publicados: [] };

  const planes = planificar(filas, estado, ahora, { cuentasCalientes: process.env.SOCIAL_CUENTAS_CALIENTES === "true" });
  if (verPlan) {
    console.log(`PLAN con ritmo humano (${planes.length} publicaciones):`);
    for (const p of planes) console.log(`  ${fmt(p.cuando)}  ${p.red.padEnd(9)} ${p.fila.video.replace(/^videos\//, "")}${p.motivo ? `   ✗ ${p.motivo}` : ""}`);
    return;
  }

  const toca = planes.filter((p) => !p.motivo && p.cuando <= ahora);
  const tarde = toca.filter((p) => ahora.getTime() - p.cuando.getTime() > VENTANA_TARDE_MIN * 60000);
  // --adelantar=H (18 sep 2026, robots de GitHub parados): TikTok e Instagram
  // van por Buffer, que programa a la hora del plan; así una sola pasada
  // desde el Mac deja listas las próximas H horas aunque el Mac se apague.
  const adelantoH = Number((process.argv.find((a) => a.startsWith("--adelantar=")) ?? "").split("=")[1] || 0);
  const limite = new Date(ahora.getTime() + adelantoH * 3600000);
  const porAdelantado = adelantoH > 0
    ? planes.filter((p) => !p.motivo && p.cuando > ahora && p.cuando <= limite && (p.red === "youtube" || (REDES_BUFFER.includes(p.red) && tokensBufferPara(p.red, (p.fila.lang ?? langDeVideo(p.fila.video)) === "en").length > 0)))
    : [];
  const ahoraSi = [...toca.filter((p) => !tarde.includes(p)), ...porAdelantado];
  const proximas = planes.filter((p) => !p.motivo && p.cuando > ahora).slice(0, 6);

  console.log(`${apply ? "APPLY" : "DRY-RUN"} · ${fmt(ahora)} · toca ahora: ${ahoraSi.length - porAdelantado.length} · por adelantado (Buffer, ${adelantoH} h): ${porAdelantado.length} · perdidas (cron tarde): ${tarde.length} · pendientes: ${planes.filter((p) => !p.motivo && p.cuando > ahora).length}`);
  for (const p of tarde) {
    console.log(`  perdido  ${fmt(p.cuando)} ${p.red} ${p.fila.video}`);
    if (apply) estado.publicados.push({ clave: p.clave, red: p.red, video: p.fila.video, fecha: p.cuando.toISOString(), estado: "perdido" });
  }
  for (const p of proximas) console.log(`  próxima  ${fmt(p.cuando)} ${p.red} ${p.fila.video.replace(/^videos\//, "")}`);

  for (const p of ahoraSi) {
    const mp4 = path.join(VIDEOS, p.fila.video);
    const { texto, titulo } = textoPara(p.red, p.fila);
    console.log(`\n→ ${p.red.toUpperCase()}  ${p.fila.video}\n  ${texto.replace(/\n/g, " / ")}`);
    if (!fs.existsSync(mp4)) { console.log("  ✗ no existe el MP4"); continue; }
    const en = (p.fila.lang ?? langDeVideo(p.fila.video)) === "en";
    // SOCIAL_SOLO_EN=true (ensayo, 15 sep 2026): publica solo en las cuentas
    // inglesas (0 seguidores; sirven de banco de pruebas la primera semana).
    if (process.env.SOCIAL_SOLO_EN === "true" && !en) { console.log("  · ensayo solo EN: se salta"); continue; }
    if (!apply) continue;
    if (!tieneSecrets(p.red, en)) { console.log("  · sin secrets de esta red: se salta (no cuenta como error)"); continue; }
    try {
      let id = "", est: Publicado["estado"] = "ok";
      // X: por Buffer si hay cuenta con canal; si no, por la API directa (claves X_*).
      const porBuffer = REDES_BUFFER.includes(p.red) && tokensBufferPara(p.red, en).length > 0 && !(p.red === "x" && !process.env.BUFFER_TOKEN_EXTRA && process.env.X_REFRESH_TOKEN);
      const ytProgramado = !porBuffer && p.red === "youtube" && p.cuando.getTime() > Date.now() + 15 * 60000;
      if (porBuffer) id = await publicarBuffer(mp4, texto, p.red, en, p.cuando);
      else if (p.red === "youtube") id = await publicarYoutube(mp4, titulo, texto, en, p.cuando);
      else if (p.red === "x") id = await publicarX(mp4, texto);
      else if (p.red === "instagram") id = await publicarInstagram(mp4, texto);
      else { const r = await publicarTikTok(mp4, titulo || texto); id = r.id; est = r.borrador ? "borrador" : "ok"; }
      // Por Buffer (o YouTube programado) la fecha real es la programada (cuenta para el tope de ese día, no de hoy).
      estado.publicados.push({ clave: p.clave, red: p.red, video: p.fila.video, fecha: (porBuffer || ytProgramado ? p.cuando : new Date()).toISOString(), estado: est, id, lang: en ? "en" : "es" });
      console.log(est === "borrador" ? `  ✓ en tus borradores de TikTok (publícalo desde el móvil) · ${id}` : porBuffer ? `  ✓ programado en Buffer · ${id}` : ytProgramado ? `  ✓ programado en YouTube para ${fmt(p.cuando)} · ${id}` : `  ✓ publicado · ${id}`);
    } catch (e: any) {
      if (e instanceof SinCanal) { console.log(`  · ${e.message} (conéctalo en Buffer; se salta)`); continue; }
      estado.publicados.push({ clave: p.clave, red: p.red, video: p.fila.video, fecha: new Date().toISOString(), estado: "error", error: String(e.message ?? e).slice(0, 300) });
      console.log(`  ✗ error: ${String(e.message ?? e).slice(0, 200)}`);
    }
  }
  if (apply) fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2) + "\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
