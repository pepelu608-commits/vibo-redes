/**
 * "ASÍ FUE LA PARTIDA": el vídeo del domingo con los DATOS REALES del
 * sábado (15 sep 2026, auditoría de marketing). Cuántos jugaron, la
 * pregunta que tumbó a más gente con su porcentaje de fallo real, cuántos
 * llegaron al final y qué se repartió. ES y EN. Lo fabrica el robot
 * (social.yml, domingos ~08 UTC) y el calendario lo publica el domingo.
 *
 * Reglas: NADA inventado. Sin partida terminada en las últimas 36 h, o con
 * menos de 20 inscritos, no se fabrica (se avisa y se sale a 0). El
 * porcentaje solo se pinta si esa pregunta tuvo 10 respuestas o más.
 *
 *   npx tsx scripts/social/resumen-partida.ts            # HTML + videos.json
 *   npx tsx scripts/social/resumen-partida.ts --grabar   # y MP4 con sonido
 *   npx tsx scripts/social/resumen-partida.ts --prueba   # con datos de ejemplo (para ver el diseño; NO publicar)
 */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const RAIZ = path.resolve(__dirname, "../..");
config({ path: path.join(RAIZ, ".env.local") });
const ORIGEN = path.join(RAIZ, "social/videos-src");
const VIDEOS = path.join(RAIZ, "social/videos");
const NOMBRE = { es: "Vibo Resumen - Asi Fue La Partida", en: "Vibo Resumen EN - How It Went" };

type Lang = "es" | "en";
type Datos = {
  edicion: string; jugaron: number; finalistas: number; boteCents: number;
  pregunta: { texto: string; opciones: string[]; correcta: number; pctFallo: number | null } | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const euros = (c: number, lang: Lang) => (lang === "es" ? `${Math.round(c / 100)} €` : `€${Math.round(c / 100)}`);
const T = {
  es: { gancho: "ASÍ FUE LA PARTIDA", jugaron: "JUGARON", tumbo: "LA PREGUNTA QUE TUMBÓ A MÁS GENTE", fallo: (p: number) => `EL ${p} % FALLÓ`, final: (n: number) => `LLEGARON AL FINAL: ${n}`, reparto: (e: string) => `SE REPARTIERON ${e}`, sinReparto: "SIN BOTE REPARTIDO", c1: "PRÓXIMA: SÁBADO · 18:00", c2: "GRATIS · CON PREMIO" },
  en: { gancho: "HOW THE GAME WENT", jugaron: "PLAYED", tumbo: "THE QUESTION THAT KNOCKED OUT THE MOST", fallo: (p: number) => `${p}% GOT IT WRONG`, final: (n: number) => `MADE IT TO THE END: ${n}`, reparto: (e: string) => `${e} SPLIT BETWEEN THEM`, sinReparto: "NO POT PAID OUT", c1: "NEXT: SATURDAY · 6 PM CET", c2: "FREE · REAL PRIZE" },
};

function html(d: Datos, lang: Lang): string {
  const t = T[lang];
  const q = d.pregunta;
  const ops = q ? q.opciones.map((o, i) => `<div class="op ${i === q.correcta ? "bien" : "mal"}"><span>${"ABCD"[i]}</span>${esc(o)}</div>`).join("") : "";
  // Tiempos (ms): gancho 1200 → jugaron 2000 → pregunta 5300 → final/reparto 2300 → cierre 1500 = 12300
  return `<!DOCTYPE html>
<!-- Fabricado por scripts/social/resumen-partida.ts · edición ${esc(d.edicion)} · ${lang} -->
<html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1920px;overflow:hidden;background:#0b0f2b;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;position:relative}
  .pant{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;opacity:0;transition:opacity .25s}
  .pant.on{opacity:1}
  #logo{position:absolute;top:100px;left:0;right:0;text-align:center;font-family:Anton,sans-serif;font-size:64px;letter-spacing:12px}
  #logo b{color:#ff3d8a;font-weight:normal}
  .anton{font-family:Anton,sans-serif;text-transform:uppercase;line-height:1.02}
  #gancho{font-size:118px}
  #ed{font-size:44px;color:#8b93c7;margin-top:40px;letter-spacing:6px}
  #big{font-size:340px;color:#2ee6a8;font-variant-numeric:tabular-nums;line-height:1}
  #big2{font-size:84px;margin-top:10px}
  #tumbo{font-size:40px;color:#ffd166;letter-spacing:4px;margin-bottom:40px}
  #preg{font-size:66px;font-weight:800;line-height:1.15;margin-bottom:50px;text-wrap:balance}
  #ops{display:grid;grid-template-columns:1fr 1fr;gap:24px;width:100%}
  .op{background:rgba(255,255,255,.08);border:3px solid rgba(255,255,255,.14);border-radius:28px;padding:34px 20px;font-size:44px;font-weight:800}
  .op span{display:block;font-size:26px;color:#8b93c7;margin-bottom:8px;letter-spacing:3px}
  .op.bien{background:#2ee6a8;color:#0b0f2b;border-color:#2ee6a8}.op.bien span{color:#0b0f2b}
  .op.mal{opacity:.3}
  #fallo{font-size:110px;color:#ff3d8a;margin-top:70px;opacity:0;transition:opacity .2s}
  #fin1{font-size:96px}#fin2{font-size:78px;color:#ffd166;margin-top:50px}
  #cierre .c1{font-size:96px}#cierre .c2{font-size:60px;color:#2ee6a8;margin-top:36px;letter-spacing:4px}
  #cierre .c3{font-size:150px;letter-spacing:18px;margin-top:120px}#cierre .c3 b{color:#ff3d8a;font-weight:normal}
  #negro{background:#000}
</style></head><body>
  <div id="logo">V<b>I</b>B<b>O</b></div>
  <div class="pant on" id="p1"><div id="gancho" class="anton">${t.gancho}</div><div id="ed" class="anton">${esc(d.edicion)}</div></div>
  <div class="pant" id="p2"><div id="big" class="anton">${d.jugaron}</div><div id="big2" class="anton">${t.jugaron}</div></div>
  ${q ? `<div class="pant" id="p3"><div id="tumbo" class="anton">${t.tumbo}</div><div id="preg">${esc(q.texto)}</div><div id="ops">${ops}</div>${q.pctFallo != null ? `<div id="fallo" class="anton">${t.fallo(q.pctFallo)}</div>` : ""}</div>` : ""}
  <div class="pant" id="p4"><div id="fin1" class="anton">${t.final(d.finalistas)}</div><div id="fin2" class="anton">${d.boteCents > 0 ? t.reparto(euros(d.boteCents, lang)) : t.sinReparto}</div></div>
  <div class="pant" id="negro"><div id="cierre"><div class="c1 anton">${t.c1}</div><div class="c2 anton">${t.c2}</div><div class="c3 anton">V<b>I</b>B<b>O</b></div></div></div>
<script>
  const $ = (id) => document.getElementById(id);
  const ir = (de, a) => { $(de).classList.remove('on'); $(a).classList.add('on'); };
  const hayP3 = !!$('p3');
  setTimeout(() => ir('p1','p2'), 1200);
  setTimeout(() => ir('p2', hayP3 ? 'p3' : 'p4'), 3200);
  if (hayP3) { setTimeout(() => { if ($('fallo')) $('fallo').style.opacity = 1; }, 6200); setTimeout(() => ir('p3','p4'), 8500); }
  setTimeout(() => ir('p4','negro'), 10800);
  setTimeout(() => location.reload(), 12300);
</script></body></html>`;
}

/** Sonido: golpe al pasar de pantalla y ding cuando aparece el porcentaje (t=6,2 s). */
function pegarSonido(mp4: string) {
  const ffmpeg = require("ffmpeg-static") as string;
  const golpe = (t: number) => `sine=f=220:d=0.12,afade=t=out:st=0.03:d=0.09,adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=0.9`;
  const capas = [golpe(1.2), golpe(3.2), `sine=f=1568:d=0.35,afade=t=out:st=0.1:d=0.25,adelay=6200|6200,volume=0.8`, golpe(8.5), golpe(10.8)];
  const inputs = capas.map((c, i) => `${c}[a${i}]`).join(";");
  const mix = capas.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${capas.length}:normalize=0,volume=0.6,apad[aud]`;
  const tmp = mp4.replace(/\.mp4$/, ".tmp.mp4");
  execFileSync(ffmpeg, ["-y", "-i", mp4, "-f", "lavfi", "-t", "15", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `${inputs};${mix}`,
    "-map", "0:v", "-map", "[aud]", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-t", "12.3", tmp], { stdio: "pipe" });
  fs.renameSync(tmp, mp4);
}

async function datosReales(): Promise<Datos | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key);
  const desde = new Date(Date.now() - 36 * 3600000).toISOString();
  const { data: game } = await admin.from("game").select("id,edicion,bote_cents,inscritos_total,empieza_en")
    .eq("estado", "terminada").not("edicion", "ilike", "ENSAYO%").gte("empieza_en", desde)
    .order("empieza_en", { ascending: false }).limit(1).maybeSingle();
  if (!game) { console.log("No hay partida terminada en las últimas 36 h: no se fabrica el resumen."); return null; }
  if ((game.inscritos_total ?? 0) < 20) { console.log(`Solo ${game.inscritos_total} inscritos: sin resumen (mínimo 20 para que las cifras signifiquen algo).`); return null; }

  const { data: qs } = await admin.from("question").select("orden,texto,texto_en,opciones,opciones_en,correcta,total_respuestas,total_correctas")
    .eq("game_id", game.id).not("cerrada_en", "is", null);
  const { count: finalistas } = await admin.from("player").select("id", { count: "exact", head: true }).eq("game_id", game.id).not("puesto_final", "is", null);
  const { data: premios } = await admin.from("player").select("premio_cents").eq("game_id", game.id).not("premio_cents", "is", null);
  const repartido = (premios ?? []).reduce((s, p) => s + (p.premio_cents ?? 0), 0);

  // La pregunta con más fallos ABSOLUTOS (la que tumbó a más gente), con % real.
  let peor: any = null;
  for (const q of qs ?? []) {
    const fallos = (q.total_respuestas ?? 0) - (q.total_correctas ?? 0);
    if (q.correcta == null || !Array.isArray(q.opciones)) continue;
    if (!peor || fallos > (peor.total_respuestas - peor.total_correctas)) peor = q;
  }
  const pregunta = (lang: Lang) => peor ? {
    texto: lang === "en" ? (peor.texto_en ?? peor.texto) : peor.texto,
    opciones: lang === "en" ? (peor.opciones_en ?? peor.opciones) : peor.opciones,
    correcta: peor.correcta,
    pctFallo: (peor.total_respuestas ?? 0) >= 10 ? Math.round(((peor.total_respuestas - peor.total_correctas) / peor.total_respuestas) * 100) : null,
  } : null;
  return { edicion: game.edicion, jugaron: game.inscritos_total, finalistas: finalistas ?? 0, boteCents: repartido, pregunta: pregunta("es"), ...( { _en: pregunta("en") } as any) };
}

async function main() {
  const args = process.argv.slice(2);
  const grabar = args.includes("--grabar");
  const prueba = args.includes("--prueba");
  const d: any = prueba
    ? { edicion: "S-01", jugaron: 312, finalistas: 5, boteCents: 2500, pregunta: { texto: "¿Cuántos husos horarios tiene Rusia?", opciones: ["7", "9", "11", "13"], correcta: 2, pctFallo: 68 }, _en: { texto: "How many time zones does Russia have?", opciones: ["7", "9", "11", "13"], correcta: 2, pctFallo: 68 } }
    : await datosReales();
  if (!d) return;
  fs.mkdirSync(ORIGEN, { recursive: true });
  for (const lang of ["es", "en"] as Lang[]) {
    const datos: Datos = { ...d, pregunta: lang === "en" ? d._en : d.pregunta };
    fs.writeFileSync(path.join(ORIGEN, `${NOMBRE[lang]}.html`), html(datos, lang));
    console.log(`✓ ${NOMBRE[lang]}.html`);
  }
  console.log(`Edición ${d.edicion}: ${d.jugaron} jugaron · ${d.finalistas} al final · ${d.boteCents / 100} € repartidos · pregunta: ${d.pregunta?.texto ?? "(sin datos)"} (${d.pregunta?.pctFallo ?? "?"} % fallo)`);
  if (!grabar) { console.log("Para grabar: --grabar"); return; }
  execFileSync("npx", ["tsx", path.join(RAIZ, "scripts/grabar-videos.ts"), "Vibo Resumen"], { stdio: "inherit", cwd: RAIZ });
  for (const lang of ["es", "en"] as Lang[]) {
    const mp4 = path.join(VIDEOS, `${NOMBRE[lang]}.mp4`);
    pegarSonido(mp4);
    console.log(`✓ ${path.basename(mp4)} con sonido`);
  }
  if (prueba) console.log("\n⚠ Son datos de EJEMPLO: no publicar. Borra los MP4 o vuelve a fabricar con datos reales.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
