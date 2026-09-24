/**
 * "LA PARTIDA, PREGUNTA A PREGUNTA" (24 sep 2026, fundador: "grabar todas
 * las partidas y subirlas a YouTube"): la repetición del sábado como la de
 * un concurso de la tele, con los DATOS REALES. Cada pregunta con su
 * respuesta, el % que falló y cuántos quedaban; al final, quién ganó y qué
 * se repartió. ES y EN. Unos 50 s, vertical. Lo fabrica el robot el domingo
 * por la mañana, detrás de "Así fue la partida" (resumen-partida.ts).
 *
 * Reglas: NADA inventado. Sin partida terminada en las últimas 36 h, o con
 * menos de 20 inscritos, no se fabrica. El % solo con 10 respuestas o más.
 * NUNCA sale la cara ni el vídeo de nadie (la grabación de los jugadores no
 * se publica jamás). El ganador sale por su alias solo si no pidió quedarse
 * fuera del salón de ganadores (mostrar_en_ganadores); si no, "el ganador".
 *
 *   npx tsx scripts/social/repeticion-partida.ts            # HTML
 *   npx tsx scripts/social/repeticion-partida.ts --grabar   # y MP4 con sonido
 *   npx tsx scripts/social/repeticion-partida.ts --prueba   # datos de ejemplo (para ver el diseño; NO publicar)
 */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { config } from "dotenv";

const RAIZ = path.resolve(__dirname, "../..");
config({ path: path.join(RAIZ, ".env.local") });
const ORIGEN = path.join(RAIZ, "social/videos-src");
const VIDEOS = path.join(RAIZ, "social/videos");
const NOMBRE = { es: "Vibo Repeticion - La Partida Pregunta A Pregunta", en: "Vibo Repeticion EN - The Whole Game" };
const FIJAS = 10;

type Lang = "es" | "en";
type Q = { orden: number; texto: string; opciones: string[]; correcta: number; pctFallo: number | null; quedan: number };
type Datos = { edicion: string; empezaron: number; preguntas: Q[]; ganador: string | null; repartidoCents: number; sinGanador: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const euros = (c: number, lang: Lang) => (lang === "es" ? `${Math.round(c / 100)} €` : `€${Math.round(c / 100)}`);
const T = {
  es: {
    gancho: "LA PARTIDA,<br>PREGUNTA A PREGUNTA", empezaron: (n: number) => `EMPEZARON ${n}`, pregunta: (n: number) => (n > FIJAS ? "MUERTE SÚBITA" : `PREGUNTA ${n} / ${FIJAS}`),
    fallo: (p: number) => `EL ${p} % FALLÓ`, quedan: (n: number) => (n === 1 ? "QUEDA 1" : `QUEDAN ${n}`),
    gano: (a: string | null) => (a ? `GANÓ ${a}` : "HUBO GANADOR"), reparto: (e: string) => `SE REPARTIERON ${e}`,
    nadie: "NADIE LLEGÓ AL FINAL", acumula: "EL BOTE SE ACUMULA", c1: "EL SÁBADO, TE TOCA", c2: "18:00 · GRATIS · CON PREMIO",
  },
  en: {
    gancho: "THE WHOLE GAME,<br>QUESTION BY QUESTION", empezaron: (n: number) => `${n} STARTED`, pregunta: (n: number) => (n > FIJAS ? "SUDDEN DEATH" : `QUESTION ${n} / ${FIJAS}`),
    fallo: (p: number) => `${p}% GOT IT WRONG`, quedan: (n: number) => `${n} LEFT`,
    gano: (a: string | null) => (a ? `${a} WON` : "WE HAD A WINNER"), reparto: (e: string) => `${e} PAID OUT`,
    nadie: "NOBODY MADE IT", acumula: "THE POT ROLLS OVER", c1: "SATURDAY, IT'S YOUR TURN", c2: "6 PM CET · FREE · REAL PRIZE",
  },
};

// Tiempos (ms): gancho 2200 · cada pregunta 4200 (a los 2200 la buena, a los 2800 el % y los que quedan) · final 3500 · cierre 2000.
const T_GANCHO = 2200, T_PREG = 4200, T_REVELA = 2200, T_DATO = 2800, T_FINAL = 3500, T_CIERRE = 2000;
const duracionMs = (n: number) => T_GANCHO + n * T_PREG + T_FINAL + T_CIERRE;

function html(d: Datos, lang: Lang): string {
  const t = T[lang];
  const pant = d.preguntas.map((q, i) => {
    const ops = q.opciones.map((o, k) => `<div class="op" data-bien="${k === q.correcta ? 1 : 0}"><span>${"ABCD"[k] ?? ""}</span>${esc(o)}</div>`).join("");
    return `<div class="pant" id="q${i}"><div class="num anton">${t.pregunta(q.orden)}</div><div class="preg">${esc(q.texto)}</div><div class="ops">${ops}</div>
      <div class="dato">${q.pctFallo != null ? `<div class="fallo anton">${t.fallo(q.pctFallo)}</div>` : ""}<div class="quedan anton">${t.quedan(q.quedan)}</div></div></div>`;
  }).join("\n");
  const final = d.sinGanador
    ? `<div class="f1 anton">${t.nadie}</div><div class="f2 anton">${t.acumula}</div>`
    : `<div class="f1 anton">${esc(t.gano(d.ganador))}</div><div class="f2 anton">${d.repartidoCents > 0 ? t.reparto(euros(d.repartidoCents, lang)) : ""}</div>`;
  const total = duracionMs(d.preguntas.length);
  return `<!DOCTYPE html>
<!-- Fabricado por scripts/social/repeticion-partida.ts · edición ${esc(d.edicion)} · ${lang} -->
<html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1920px;overflow:hidden;background:#0b0f2b;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;position:relative}
  .pant{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;opacity:0;transition:opacity .2s}
  .pant.on{opacity:1}
  #logo{position:absolute;top:100px;left:0;right:0;text-align:center;font-family:Anton,sans-serif;font-size:64px;letter-spacing:12px;z-index:2}
  #logo b{color:#ff3d8a;font-weight:normal}
  .anton{font-family:Anton,sans-serif;text-transform:uppercase;line-height:1.02}
  #gancho{font-size:112px}
  #ed{font-size:44px;color:#8b93c7;margin-top:40px;letter-spacing:6px}
  #emp{font-size:96px;color:#2ee6a8;margin-top:70px}
  .num{font-size:44px;color:#ffd166;letter-spacing:5px;margin-bottom:40px}
  .preg{font-size:64px;font-weight:800;line-height:1.15;margin-bottom:50px;text-wrap:balance}
  .ops{display:grid;grid-template-columns:1fr 1fr;gap:22px;width:100%}
  .op{background:rgba(255,255,255,.08);border:3px solid rgba(255,255,255,.14);border-radius:28px;padding:30px 18px;font-size:42px;font-weight:800;transition:all .25s}
  .op span{display:block;font-size:24px;color:#8b93c7;margin-bottom:8px;letter-spacing:3px}
  .revela .op[data-bien="1"]{background:#2ee6a8;color:#0b0f2b;border-color:#2ee6a8}.revela .op[data-bien="1"] span{color:#0b0f2b}
  .revela .op[data-bien="0"]{opacity:.28}
  .dato{margin-top:60px;opacity:0;transition:opacity .2s}.muestra .dato{opacity:1}
  .fallo{font-size:76px;color:#ff3d8a}
  .quedan{font-size:120px;color:#2ee6a8;margin-top:18px}
  .f1{font-size:104px;color:#ffd166}.f2{font-size:80px;margin-top:40px}
  #cierre .c1{font-size:100px}#cierre .c2{font-size:56px;color:#2ee6a8;margin-top:36px;letter-spacing:4px}
  #cierre .c3{font-size:150px;letter-spacing:18px;margin-top:120px}#cierre .c3 b{color:#ff3d8a;font-weight:normal}
  #negro{background:#000}
</style></head><body data-duracion="${Math.ceil(total / 1000)}">
  <div id="logo">V<b>I</b>B<b>O</b></div>
  <div class="pant on" id="p0"><div id="gancho" class="anton">${t.gancho}</div><div id="ed" class="anton">${esc(d.edicion)}</div><div id="emp" class="anton">${t.empezaron(d.empezaron)}</div></div>
  ${pant}
  <div class="pant" id="pf">${final}</div>
  <div class="pant" id="negro"><div id="cierre"><div class="c1 anton">${t.c1}</div><div class="c2 anton">${t.c2}</div><div class="c3 anton">V<b>I</b>B<b>O</b></div></div></div>
<script>
  const $ = (id) => document.getElementById(id);
  const ir = (de, a) => { $(de).classList.remove('on'); $(a).classList.add('on'); };
  const n = ${d.preguntas.length};
  let t = ${T_GANCHO};
  let previa = 'p0';
  for (let i = 0; i < n; i++) {
    const id = 'q' + i, de = previa;
    setTimeout(() => ir(de, id), t);
    setTimeout(() => $(id).classList.add('revela'), t + ${T_REVELA});
    setTimeout(() => $(id).classList.add('muestra'), t + ${T_DATO});
    previa = id; t += ${T_PREG};
  }
  const ult = previa;
  setTimeout(() => ir(ult, 'pf'), t);
  setTimeout(() => ir('pf', 'negro'), t + ${T_FINAL});
  setTimeout(() => location.reload(), ${total});
</script></body></html>`;
}

/** Golpe al cambiar de pantalla y "ding" al revelar cada respuesta. */
function pegarSonido(mp4: string, n: number) {
  const ffmpeg = require("ffmpeg-static") as string;
  const golpe = (ms: number) => `sine=f=220:d=0.12,afade=t=out:st=0.03:d=0.09,adelay=${ms}|${ms},volume=0.9`;
  const ding = (ms: number) => `sine=f=1568:d=0.3,afade=t=out:st=0.08:d=0.22,adelay=${ms}|${ms},volume=0.7`;
  const capas: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = T_GANCHO + i * T_PREG;
    capas.push(golpe(t), ding(t + T_REVELA));
  }
  capas.push(golpe(T_GANCHO + n * T_PREG), golpe(T_GANCHO + n * T_PREG + T_FINAL));
  const inputs = capas.map((c, i) => `${c}[a${i}]`).join(";");
  const mix = capas.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${capas.length}:normalize=0,volume=0.6,apad[aud]`;
  const tmp = mp4.replace(/\.mp4$/, ".tmp.mp4");
  const segundos = (duracionMs(n) / 1000).toFixed(1);
  execFileSync(ffmpeg, ["-y", "-i", mp4, "-f", "lavfi", "-t", String(Number(segundos) + 3), "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `${inputs};${mix}`,
    "-map", "0:v", "-map", "[aud]", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-t", segundos, tmp], { stdio: "pipe" });
  fs.renameSync(tmp, mp4);
}

async function datosReales(): Promise<{ es: Datos; en: Datos } | null> {
  // Sin llave maestra (24 sep 2026): la última partida TERMINADA es pública
  // (sale en esta misma repetición); se lee de VIBO (/api/redes/datos).
  const vibo = process.env.VIBO_URL ?? "https://vibo-azure.vercel.app";
  const r = await fetch(`${vibo}/api/redes/datos`);
  if (!r.ok) throw new Error(`VIBO no responde (${r.status})`);
  const game = (await r.json()).ultima;
  if (!game || new Date(game.empieza_en).getTime() < Date.now() - 36 * 3600000) { console.log("No hay partida terminada en las últimas 36 h: no se fabrica la repetición."); return null; }
  const empezaron = game.inscritos_total ?? 0;
  if (empezaron < 20) { console.log(`Solo ${empezaron} inscritos: sin repetición (mínimo 20).`); return null; }

  const qs: any[] = game.preguntas;
  const caidas: Record<string, number> = game.caidas_por_pregunta ?? {};
  const caidosHasta = (orden: number) => Object.entries(caidas).filter(([o]) => Number(o) <= orden).reduce((s, [, n]) => s + n, 0);
  const repartidoCents: number = game.repartido_cents;
  const ganador: string | null = game.ganador;
  const preguntas = (lang: Lang): Q[] => (qs ?? [])
    // Las de reflejos (el color que no salió) no se entienden sin el estímulo:
    // fuera del vídeo. "Quedan N" sigue siendo exacto (se cuenta por número).
    .filter((q) => q.tipo !== "reaccion" && q.correcta != null && Array.isArray(q.opciones))
    .slice(0, 14) // una muerte súbita eterna no alarga el vídeo sin fin
    .map((q) => ({
      orden: q.orden,
      texto: lang === "en" && q.texto_en ? q.texto_en : q.texto,
      opciones: lang === "en" && (q.opciones_en as string[] | null)?.length === (q.opciones as string[]).length ? (q.opciones_en as string[]) : (q.opciones as string[]),
      correcta: q.correcta as number,
      pctFallo: (q.total_respuestas ?? 0) >= 10 ? Math.round(((q.total_respuestas - (q.total_correctas ?? 0)) / q.total_respuestas) * 100) : null,
      quedan: Math.max(0, empezaron - caidosHasta(q.orden)),
    }));
  const base = { edicion: String(game.edicion), empezaron, ganador, repartidoCents, sinGanador: !game.ganador_player_id && repartidoCents === 0 };
  return { es: { ...base, preguntas: preguntas("es") }, en: { ...base, preguntas: preguntas("en") } };
}

function ejemplo(): { es: Datos; en: Datos } {
  const qs: Q[] = [
    { orden: 2, texto: "¿Cuál es el planeta más cercano al Sol?", opciones: ["Venus", "Mercurio", "Marte", "Tierra"], correcta: 1, pctFallo: 12, quedan: 262 },
    { orden: 3, texto: "¿Qué animal es el símbolo del WWF?", opciones: ["Koala", "Tigre", "Oso panda", "Elefante"], correcta: 2, pctFallo: 9, quedan: 238 },
  ];
  const d: Datos = { edicion: "001", empezaron: 312, preguntas: qs, ganador: "Laura", repartidoCents: 2000, sinGanador: false };
  return { es: d, en: { ...d, preguntas: qs.map((q) => ({ ...q })) } };
}

async function main() {
  const args = process.argv.slice(2);
  const grabar = args.includes("--grabar");
  const prueba = args.includes("--prueba");
  const d = prueba ? ejemplo() : await datosReales();
  if (!d) return;
  fs.mkdirSync(ORIGEN, { recursive: true });
  for (const lang of ["es", "en"] as Lang[]) {
    fs.writeFileSync(path.join(ORIGEN, `${NOMBRE[lang]}.html`), html(d[lang], lang));
    console.log(`✓ ${NOMBRE[lang]}.html (${d[lang].preguntas.length} preguntas, ${Math.round(duracionMs(d[lang].preguntas.length) / 1000)} s)`);
  }
  if (!grabar) { console.log("Para grabar: --grabar"); return; }
  execFileSync("npx", ["tsx", path.join(RAIZ, "scripts/grabar-videos.ts"), "Vibo Repeticion"], { stdio: "inherit", cwd: RAIZ });
  for (const lang of ["es", "en"] as Lang[]) {
    const mp4 = path.join(VIDEOS, `${NOMBRE[lang]}.mp4`);
    pegarSonido(mp4, d[lang].preguntas.length);
    console.log(`✓ ${path.basename(mp4)} con sonido`);
  }
  if (prueba) console.log("\n⚠ Son datos de EJEMPLO: no publicar. Borra los MP4 o vuelve a fabricar con datos reales.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
