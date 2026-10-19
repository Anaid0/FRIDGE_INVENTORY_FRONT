/** 'YYYY-MM-DD' de una fecha en la zona horaria local (para <input type="date">). */
export function toLocalDateInput(date: Date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Fecha de un <input type="date"> a ISO, al mediodía local (así no cambia de día por la zona horaria). */
export function dateInputToISO(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/** Inicio del día local de un <input type="date">, en ISO (para filtros "desde"). */
export function startOfDayISO(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

/** Fin del día local de un <input type="date">, en ISO (para filtros "hasta"). */
export function endOfDayISO(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

const MONTH_LONG = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' });
const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const utcDay = (value: string) => new Date(`${value}T00:00:00Z`);

/**
 * Rango de una quincena (fechas sin hora): "16 – 31 de octubre"; con `short`, "16 – 31 oct 2026".
 * Si cruza de mes: "28 de septiembre – 12 de octubre" / "28 sept – 12 oct 2026".
 */
export function formatPeriodRange(start: string, end: string, short = false): string {
  const from = utcDay(start);
  const to = utcDay(end);
  const month = (date: Date) => (short ? MONTH_SHORT : MONTH_LONG).format(date).replace('.', '');
  const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  if (short) {
    const left = sameMonth ? `${from.getUTCDate()}` : `${from.getUTCDate()} ${month(from)}`;
    return `${left} – ${to.getUTCDate()} ${month(to)} ${to.getUTCFullYear()}`;
  }
  const left = sameMonth ? `${from.getUTCDate()}` : `${from.getUTCDate()} de ${month(from)}`;
  return `${left} – ${to.getUTCDate()} de ${month(to)}`;
}

/** Días que faltan hasta `end` (fecha sin hora) contando desde hoy (0 = termina hoy; negativo = ya terminó). */
export function daysUntil(end: string, today: Date = new Date()): number {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((utcDay(end).getTime() - todayUtc) / 86_400_000);
}

/** "quedan 12 días", "queda 1 día", "termina hoy", "ya terminó". */
export function remainingLabel(end: string, today: Date = new Date()): string {
  const days = daysUntil(end, today);
  if (days < 0) return 'ya terminó';
  if (days === 0) return 'termina hoy';
  return days === 1 ? 'queda 1 día' : `quedan ${days} días`;
}

/** Inicio del día local de hoy, en ISO (filtro "desde hoy"). */
export function startOfTodayISO(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}
