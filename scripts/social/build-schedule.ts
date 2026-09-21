/**
 * Genera schedule.csv — el calendario de publicación de los 10 días previos
 * a una partida (S-9 jueves → S sábado), importable en Metricool.
 *
 * El plan NO es algorítmico a propósito: el calendario de lanzamiento se
 * diseñó a mano vídeo a vídeo (qué mecánica, qué día, por qué) y aquí está
 * codificado tal cual. Las reglas editoriales (70/30 pregunta vs
 * bote-ritual, no repetir mecánica en el día, ES 08/14/21 h y EN 17/23 h)
 * ya están cumplidas EN el plan; el script solo lo materializa con fechas
 * reales y lo valida al final por si alguien lo edita.
 *
 * Uso:
 *   npx tsx scripts/social/build-schedule.ts                # próximo sábado
 *   npx tsx scripts/social/build-schedule.ts --sabado 2026-09-12
 *
 * Siempre es dry-run en el sentido de que solo escribe schedule.csv en
 * esta carpeta; no publica nada (eso es publish.ts).
 */
import * as fs from "fs";
import * as path from "path";
import { PLAN, planCalentamiento, construirFilas, elegirPreguntas, proximoSabado, fechaMas, type Video, type Estado } from "../../src/lib/redes";

const CARPETA = __dirname;

/** Bote real de la próxima partida (--bote 20 en euros, o la base de datos). Los pies de foto abren con él. */
async function boteReal(args: string[]): Promise<{ sabado: number; mes: number } | undefined> {
  const i = args.indexOf("--bote");
  if (i >= 0) {
    const eur = Number(String(args[i + 1]).replace(",", "."));
    if (!(eur > 0)) throw new Error("--bote N: euros del bote, por ejemplo --bote 20");
    const j = args.indexOf("--mes");
    return { sabado: Math.round(eur * 100), mes: Math.round((j >= 0 ? Number(args[j + 1]) : eur) * 100) };
  }
  const { config } = require("dotenv");
  config({ path: path.join(CARPETA, "..", "..", ".env.local") });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.log("⚠ Sin acceso a la base de datos: pies de foto sin cifra del bote (pasa --bote N)."); return undefined; }
  const r = await fetch(`${url}/rest/v1/game?select=edicion,bote_cents,empieza_en&edicion=not.ilike.ENSAYO*&estado=eq.programada&order=empieza_en.asc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const rows = (await r.json()) as { edicion: string; bote_cents: number; empieza_en: string }[];
  if (!rows?.[0]?.bote_cents) { console.log("⚠ No hay partida programada con bote: pies de foto sin cifra."); return undefined; }
  const rl = await fetch(`${url}/rest/v1/bote_liga?select=temporada,bote_cents&order=temporada.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const ligas = (await rl.json()) as { temporada: number; bote_cents: number }[];
  const temporada = ligas?.[0]?.temporada;
  const ligaCents = (ligas ?? []).filter((l) => l.temporada === temporada).reduce((a, l) => a + (l.bote_cents ?? 0), 0);
  console.log(`Bote real de la edición ${rows[0].edicion}: ${rows[0].bote_cents / 100} € · ligas: ${ligaCents / 100} € · este mes: ${(rows[0].bote_cents + ligaCents) / 100} € · empieza ${rows[0].empieza_en}`);
  return { sabado: rows[0].bote_cents, mes: rows[0].bote_cents + ligaCents };
}

async function main() {
  const args = process.argv.slice(2);
  const botes = await boteReal(args);
  const idx = args.indexOf("--sabado");
  const sabado = idx >= 0 ? new Date(`${args[idx + 1]}T12:00:00`) : proximoSabado(new Date());
  if (isNaN(sabado.getTime())) throw new Error("Fecha inválida en --sabado (formato: YYYY-MM-DD)");
  if (sabado.getDay() !== 6) throw new Error(`${sabado.toISOString().slice(0, 10)} no es sábado`);

  // --calentamiento N: N días de siembra ANTES del plan de 10 días, para
  // cuentas nuevas (18 sep 2026). Solo preguntas; el plan de 10 días va
  // detrás igual que siempre.
  const iCal = args.indexOf("--calentamiento");
  const diasCal = iCal >= 0 ? Number(args[iCal + 1]) : 0;
  if (iCal >= 0 && (!Number.isInteger(diasCal) || diasCal < 1 || diasCal > 40)) throw new Error("--calentamiento N: N entre 1 y 40 días");
  const plan = diasCal > 0 ? [...planCalentamiento(-9 - diasCal, -10), ...PLAN] : PLAN;

  const catalogo: Video[] = JSON.parse(fs.readFileSync(path.join(CARPETA, "videos.json"), "utf8")).videos;
  const porFile = new Map(catalogo.map((v) => [v.file, v]));

  // "No repetir mecánica en el día" (por mecánica+idioma; ES y EN del
  // mismo vídeo pueden ir el mismo día porque van a públicos distintos).
  const porDia = new Map<number, string[]>();
  const estado: Estado = JSON.parse(fs.readFileSync(path.join(CARPETA, "publicados.json"), "utf8"));
  const elegidos = elegirPreguntas(sabado, catalogo, estado, plan);
  for (const p of plan) {
    const v = p.pool ? elegidos.get(p) : porFile.get(p.file!);
    if (!v) throw new Error(`PLAN usa un vídeo que no está en videos.json: ${p.file}`);
    const clave = `${v.mecanica}:${v.lang}`;
    const mecs = porDia.get(p.dia) ?? [];
    if (!p.pool && v.mecanica !== "countdown" && mecs.includes(clave)) throw new Error(`Mecánica '${clave}' repetida el día S${p.dia}`);
    mecs.push(clave);
    porDia.set(p.dia, mecs);
  }

  const filas = construirFilas(sabado, catalogo, estado, plan, botes?.sabado, botes?.mes);
  const linea = (f: (typeof filas)[number]) =>
    [f.date, f.time, f.networks.join(";"), f.video, `"${f.caption.replace(/"/g, '""')}"`, `"${f.hashtags}"`].join(",");
  const cabecera = "date,time,network,video,caption,hashtags";
  for (const lang of ["es", "en"] as const) {
    const propias = filas.filter((f) => porFile.get(f.video.replace(/^videos\//, ""))!.lang === lang).map(linea);
    fs.writeFileSync(path.join(CARPETA, `schedule-${lang}.csv`), [cabecera, ...propias].join("\n") + "\n");
  }
  fs.writeFileSync(path.join(CARPETA, "schedule.csv"), [cabecera, ...filas.map(linea)].join("\n") + "\n");

  const tipos = plan.map((p) => (p.pool ? elegidos.get(p) : porFile.get(p.file!))!.tipo);
  console.log(`Partida: sábado ${fechaMas(sabado, 0)} 18:00 (Europe/Madrid)`);
  console.log(`Posts: ${plan.length} (${diasCal > 0 ? `${diasCal} d de calentamiento + ` : ""}10 días de campaña) (${tipos.filter((t) => t === "pregunta").length} pregunta / ${tipos.filter((t) => t === "bote" || t === "ritual").length} bote-ritual / resto countdown-promo)`);
  for (const f of filas.filter((x) => x.nota)) console.log(`  ⚠ ${f.date} ${f.time} — ${f.nota}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
