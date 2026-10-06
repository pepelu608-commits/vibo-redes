/**
 * Cuándo es la partida, en una frase, a partir de su fecha REAL (día de la semana y hora de Madrid).
 * "Este domingo a las 20:00" solo cuando cae en los próximos 7 días; si no, la fecha ("el domingo 18
 * de octubre a las 20:00"). Decisión 22 sep 2026: la cuenta atrás decía 25 días al lado de "este
 * sábado" y eso resta credibilidad.
 *
 * 6 oct 2026 (fundador: domingos a las 20:00 desde la 002): nada de días ni horas fijos. La 001 (sábado
 * 10 a las 18:00) sale como «este sábado a las 18:00» y la 002 como «el domingo 18 de octubre a las
 * 20:00». El nombre de la función se queda para no tocar a quien la llama.
 */
const ZONA = "Europe/Madrid";
const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Día de la semana (0 = domingo) y hora («20:00» / «8 PM») de un instante, en Madrid. */
export function diaYHoraMadrid(d: Date, locale: "es" | "en"): { dia: string; hora: string } {
  const corto = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "short" }).format(d);
  const n = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(corto);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hour12: false }).format(d));
  const m = Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, minute: "2-digit" }).format(d));
  const hora = locale === "en"
    ? `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { dia: locale === "en" ? DIAS_EN[n] : DIAS_ES[n], hora };
}

/** La cita por defecto cuando aún no hay partida programada: domingos a las 20:00 (6 oct 2026). */
export const CITA = { es: { dia: "domingo", hora: "20:00" }, en: { dia: "Sunday", hora: "8 PM" } };

export function cuandoSabado(empiezaEn: string | Date | null | undefined, locale: "es" | "en"): { esteSabado: boolean; frase: string } {
  const en = locale === "en";
  if (!empiezaEn) return { esteSabado: true, frase: en ? `This ${CITA.en.dia} at ${CITA.en.hora}` : `Este ${CITA.es.dia} a las ${CITA.es.hora}` };
  const d = new Date(empiezaEn);
  const { dia, hora } = diaYHoraMadrid(d, locale);
  const dias = (d.getTime() - Date.now()) / 86400000;
  if (dias <= 7) return { esteSabado: true, frase: en ? `This ${dia} at ${hora}` : `Este ${dia} a las ${hora}` };
  const fecha = d.toLocaleDateString(en ? "en-GB" : "es-ES", { day: "numeric", month: "long", timeZone: ZONA });
  return { esteSabado: false, frase: en ? `On ${dia} ${fecha} at ${hora}` : `El ${dia} ${fecha} a las ${hora}` };
}
