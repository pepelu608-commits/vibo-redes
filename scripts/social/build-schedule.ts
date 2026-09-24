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
async function boteReal(args: string[]): Promise<{ sabado: number; mes: number; empieza?: string } | undefined> {
  const i = args.indexOf("--bote");
  if (i >= 0) {
    const eur = Number(String(args[i + 1]).replace(",", "."));
    if (!(eur > 0)) throw new Error("--bote N: euros del bote, por ejemplo --bote 20");
    const j = args.indexOf("--mes");
    return { sabado: Math.round(eur * 100), mes: Math.round((j >= 0 ? Number(args[j + 1]) : eur) * 100) };
  }
  // Sin llave maestra (24 sep 2026): la cifra del bote es pública; se lee
  // de VIBO (/api/redes/datos), como la portada.
  const vibo = process.env.VIBO_URL ?? "https://vibo-azure.vercel.app";
  const d = await fetch(`${vibo}/api/redes/datos`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const p = d?.proxima as { edicion: string; bote_cents: number; empieza_en: string; ligas_cents: number } | null;
  if (!p?.bote_cents) { console.log("⚠ No hay partida programada con bote (o VIBO no responde): pies de foto sin cifra."); return undefined; }
  console.log(`Bote real de la edición ${p.edicion}: ${p.bote_cents / 100} € · ligas: ${p.ligas_cents / 100} € · este mes: ${(p.bote_cents + p.ligas_cents) / 100} € · empieza ${p.empieza_en}`);
  return { sabado: p.bote_cents, mes: p.bote_cents + p.ligas_cents, empieza: p.empieza_en };
}

async function main() {
  const args = process.argv.slice(2);
  const botes = await boteReal(args);
  const idx = args.indexOf("--sabado");
  let sabado = idx >= 0 ? new Date(`${args[idx + 1]}T12:00:00`) : proximoSabado(new Date());
  // 24 sep 2026: el robot de la nube lleva la fecha fija (SABADO_PARTIDA). Pasada
  // esa partida, el calendario salta solo al sábado siguiente: así el domingo
  // salen el resumen y la repetición sin que nadie cambie la variable.
  if (idx >= 0 && sabado.getTime() < Date.now() - 12 * 3600000) sabado = proximoSabado(new Date());
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

  const filas = construirFilas(sabado, catalogo, estado, plan, botes?.sabado, botes?.mes, botes?.empieza);
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
