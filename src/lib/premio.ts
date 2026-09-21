/**
 * Un solo punto de verdad para mostrar el premio de una edición, sea
 * dinero o no. 'dinero' sigue mostrando "20 €" como siempre; el resto de
 * tipos muestra la descripción que puso el patrocinador (nunca se
 * inventa un valor en € para algo que no es dinero).
 */
export type PremioTipo =
  | "dinero"
  | "tarjeta_regalo"
  | "producto"
  | "entradas"
  | "experiencia"
  | "suscripcion"
  | "merchandising"
  | "puntos"
  | "comodines";

/** Céntimos → "11,25 €" / "€11.25"; sin decimales cuando son euros
 *  enteros ("25 €"). ÚNICO formateador (auditoría 6 sep 2026): con bote 25 €
 *  el 3º cobra 3,75 y todas las pantallas —y el panel desde el que se paga
 *  a mano— decían "4 €". */
export function formatoEuros(cents: number, locale: "es" | "en" = "es"): string {
  const entero = cents % 100 === 0;
  const n = new Intl.NumberFormat(locale === "en" ? "en-IE" : "es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: entero ? 0 : 2,
  }).format(cents / 100);
  return n;
}

export function formatoPremio(game: {
  bote_cents: number;
  premio_tipo?: string | null;
  premio_descripcion?: string | null;
}, locale: "es" | "en" = "es"): string {
  const tipo = (game.premio_tipo as PremioTipo) ?? "dinero";
  if (tipo === "dinero" || !game.premio_descripcion) {
    return formatoEuros(game.bote_cents, locale);
  }
  return game.premio_descripcion;
}
