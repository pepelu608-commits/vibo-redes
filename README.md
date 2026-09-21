# vibo-redes

Publicador automático de VIBO en redes. Repositorio **público** a propósito:
en GitHub los minutos de Actions de un repo público son gratis, así que
publica cada 2 horas aunque el Mac esté apagado. Aquí no hay secretos: las
claves van en Settings → Secrets del repo. Los vídeos viven en `social/videos/`.

## Puesta en marcha (una vez)

1. Crear el repositorio público `vibo-redes` en GitHub y subir esta carpeta.
2. Settings → Secrets and variables → Actions → **Secrets**: los mismos que en el repo `vibo`
   (BUFFER_TOKEN, BUFFER_TOKEN_EN, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, YT_REFRESH_TOKEN_EN,
   X_CLIENT_ID, X_CLIENT_SECRET, X_REFRESH_TOKEN, IG_USER_ID, IG_ACCESS_TOKEN, TIKTOK_CLIENT_KEY,
   TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
3. **Variables**: `SOCIAL_APPLY` = `true`, `SABADO_PARTIDA` = `2026-10-17`, `CALENTAMIENTO_DIAS` = `16`.
4. En el repo `vibo`, dejar `SOCIAL_APPLY` sin poner (para no publicar dos veces).

## Tercera cuenta de Buffer (X, Facebook, Threads)
Buffer gratis admite 3 canales por cuenta. Las dos cuentas que hay llevan TikTok + Instagram.
Para X, Facebook y Threads: otra cuenta gratuita de Buffer (con viboapp1@gmail.com), conectar los
tres canales, crear un token en buffer.com/developers/apps y guardarlo como secret `BUFFER_TOKEN_EXTRA`
(en el Mac: línea `BUFFER_TOKEN_EXTRA=...` en .env.local y `npx tsx scripts/mac/subir-llaves-vibo-redes.ts`).

## Actualizar vídeos o textos

Desde el repo `vibo`: `sh scripts/social/sincronizar-mirror.sh`, y luego en esta carpeta
`git add -A && git commit -m "sync" && git push`.
