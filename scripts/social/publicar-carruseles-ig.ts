/**
 * Carruseles «¿cuál eliges?» en Instagram, solos (30 sep 2026, fundador: "automatiza
 * Instagram también; yo solamente me ocupo de TikTok España"). Dos al día, 14:00 y 20:00
 * (Madrid) — desde el 30 sep solo a las 14:00; a las 20:00 va un reel —, en el orden de scripts/social/carruseles-ig.json, por Buffer: carrusel de fotos
 * 4:5 (social/carruseles-ig, hechas con carruseles-ig.py) + el pie con la llamada a VIBO al final
 * (el primer comentario automático es de pago en Buffer; tipo "post": con varias fotos, carrusel). Las fotos las descarga Buffer del repositorio público vibo-redes.
 *
 * Cada hora (robot de GitHub) deja programados en Buffer los huecos de las próximas 8 h que
 * aún no lo estén; el registro (publicados) evita repetir hueco y carrusel.
 * Uso: npx tsx scripts/social/publicar-carruseles-ig.ts [--apply]   (sin --apply, solo dice qué haría)
 */
import fs from "node:fs";
import path from "node:path";

const REG = path.join(__dirname, "carruseles-ig.json");
const FOTOS = path.join(__dirname, "../../social/carruseles-ig");
const RAW = "https://raw.githubusercontent.com/pepelu608-commits/vibo-redes/main/social/carruseles-ig";
const HORAS = ["14:00"]; // 30 sep: a las 20:00 va un reel (publicar-directo.ts), "hay que mezclar"
const ADELANTO_H = 8;
const COMENTARIO = "¿quieres jugar por premios de verdad? busca «vibo» en la app store · sábados 18:00 💶";
const apply = process.argv.includes("--apply");

type Registro = { orden: string[]; publicados: { slug: string; hueco: string; id: string; fecha: string }[] };

// "2026-10-01T14:00" en hora de Madrid → Date (UTC).
function madrid(dia: string, hora: string): Date {
  const off = new Date(`${dia}T12:00:00Z`).toLocaleString("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).match(/GMT([+-]\d+)/)?.[1] ?? "+1";
  const h = Number(off);
  return new Date(`${dia}T${hora}:00${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`);
}
const diaMadrid = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

async function buffer(query: string) {
  const r = await fetch("https://api.buffer.com", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.BUFFER_TOKEN}` }, body: JSON.stringify({ query }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error("buffer: " + j.errors.map((e: { message: string }) => e.message).join("; "));
  return j.data;
}
async function canalInstagram(): Promise<string> {
  const org = (await buffer("{ account { organizations { id } } }")).account.organizations[0]?.id;
  const d = await buffer(`{ channels(input:{organizationId:"${org}"}) { id service isQueuePaused } }`);
  const c = d.channels.find((x: { service: string }) => x.service === "instagram");
  if (!c) throw new Error("buffer: no hay Instagram conectado en la cuenta ES");
  if (c.isQueuePaused) throw new Error("buffer: la cola de Instagram está en pausa");
  return c.id;
}

(async () => {
  const reg: Registro = JSON.parse(fs.readFileSync(REG, "utf8"));
  const hechos = new Set(reg.publicados.map((p) => p.hueco));
  const usados = new Set(reg.publicados.map((p) => p.slug));
  const ahora = Date.now();
  const huecos: { clave: string; cuando: Date }[] = [];
  for (let k = 0; k < 2; k++) {
    const dia = diaMadrid(new Date(ahora + k * 86400000));
    for (const h of HORAS) {
      const cuando = madrid(dia, h);
      if (cuando.getTime() > ahora + 60000 && cuando.getTime() <= ahora + ADELANTO_H * 3600000) huecos.push({ clave: `${dia}T${h}`, cuando });
    }
  }
  const pendientes = huecos.filter((h) => !hechos.has(h.clave));
  if (!pendientes.length) return console.log("Instagram (carruseles): nada que programar ahora.");
  if (apply && !process.env.BUFFER_TOKEN) return console.log("Instagram (carruseles): falta BUFFER_TOKEN.");
  const canal = apply ? await canalInstagram() : "";
  for (const h of pendientes) {
    const slug = reg.orden.find((s) => !usados.has(s));
    if (!slug) return console.log("Instagram (carruseles): ya se publicaron todos; toca hacer más.");
    const dir = path.join(FOTOS, slug);
    const fotos = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
    const pie = fs.readFileSync(path.join(dir, "pie.txt"), "utf8").trim();
    console.log(`${apply ? "→" : "(prueba)"} ${h.clave} · ${slug} · ${fotos.length} fotos`);
    if (!apply) { usados.add(slug); continue; }
    const esc = (t: string) => JSON.stringify(t);
    const assets = fotos.map((f) => `{ image: { url: ${esc(`${RAW}/${slug}/${f}`)} } }`).join(", ");
    const d = await buffer(`mutation { createPost(input: {
      text: ${esc(`${pie}\n\n${COMENTARIO}`)}, channelId: ${esc(canal)}, schedulingType: automatic, mode: customScheduled, dueAt: ${esc(h.cuando.toISOString())},
      assets: [${assets}], metadata: { instagram: { type: post, shouldShareToFeed: true } }
    }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`);
    if (d.createPost?.message) throw new Error("buffer: " + d.createPost.message);
    reg.publicados.push({ slug, hueco: h.clave, id: d.createPost.post.id, fecha: new Date().toISOString() });
    usados.add(slug);
    fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + "\n");
    console.log(`  ✓ programado en Buffer (${d.createPost.post.id})`);
  }
})();

export {};
