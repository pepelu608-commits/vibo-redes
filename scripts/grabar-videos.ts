/**
 * Graba los vídeos HTML de social/videos-src/ a MP4 1080x1920, listos
 * para TikTok/Reels/Shorts. Sin sonido a propósito (regla editorial: el
 * audio en tendencia se elige al publicar).
 *
 * Cómo: Chrome headless a 1080x1920 + screencast de puppeteer (usa el
 * ffmpeg de ffmpeg-static) → WebM → segunda pasada a MP4 H.264 (el
 * formato que aceptan las plataformas y el editor del iPhone).
 *
 * Uso:  npx tsx scripts/grabar-videos.ts            # todos los .html
 *       npx tsx scripts/grabar-videos.ts 45         # solo el Ad 45
 * Deja los MP4 en social/videos/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import ffmpeg from "ffmpeg-static";

// En el Mac del fundador, el Chrome de Aplicaciones; en GitHub Actions
// (ubuntu-latest trae google-chrome) o donde sea, CHROME_PATH.
const CHROME = process.env.CHROME_PATH
  ?? (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome");
// VIDEOS_SRC=videos-design para regrabar los diseños antiguos (18 sep 2026:
// salieron a 360p estirados; el screencast de hoy ya captura a 1080x1920).
const ORIGEN = new URL(`../social/${process.env.VIDEOS_SRC ?? "videos-src"}`, import.meta.url).pathname;
const SALIDA = new URL("../social/videos", import.meta.url).pathname;
const SEGUNDOS = 15; // los bucles duran 12-14 s; 15 garantiza el ciclo entero

async function main() {
  const filtro = process.argv[2];
  mkdirSync(SALIDA, { recursive: true });
  const ficheros = readdirSync(ORIGEN)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => !filtro || f.includes(filtro));
  if (!ficheros.length) throw new Error("No hay .html que grabar en social/videos-src/");

  // El screencast de puppeteer busca "ffmpeg" en el PATH (ignora
  // FFMPEG_PATH): se le antepone la carpeta de ffmpeg-static.
  process.env.PATH = `${path.dirname(ffmpeg as unknown as string)}:${process.env.PATH}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1"],
  });

  try {
    for (const f of ficheros) {
      const nombre = f.replace(/\.html$/, "");
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920 });
      await page.goto(`file://${path.join(ORIGEN, f)}`, { waitUntil: "networkidle0" });

      // Los formatos de varias preguntas (~24 s) dicen su duración en el HTML.
      const segundos = Number(await page.evaluate(() => document.body.dataset.duracion ?? "")) || SEGUNDOS;
      const webm = path.join(SALIDA, `${nombre}.webm`);
      const grabadora = await page.screencast({ path: webm as `${string}.webm` });
      // La página lleva ~1 s corriendo desde el goto (fuentes, arranque del
      // screencast) y el vídeo se comía el gancho. Recargar justo al empezar
      // a grabar pone el reloj del HTML a cero con la grabación ya en marcha.
      await page.reload({ waitUntil: "domcontentloaded" });
      await new Promise((r) => setTimeout(r, segundos * 1000));
      await grabadora.stop();
      await page.close();

      // WebM (VP8/9) → MP4 H.264: el códec que tragan TikTok/IG/YT y el
      // carrete del iPhone. 30 fps y yuv420p por compatibilidad máxima.
      const mp4 = path.join(SALIDA, `${nombre}.mp4`);
      execFileSync(ffmpeg as unknown as string, [
        "-y", "-i", webm,
        // crf 18 (18 sep 2026): texto nítido; las redes recomprimen igual.
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", "30",
        "-vf", "scale=1080:1920",
        "-movflags", "+faststart",
        mp4,
      ], { stdio: "pipe" });
      rmSync(webm);
      console.log(`✓ ${nombre}.mp4`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\nListo: MP4 en ${SALIDA}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
