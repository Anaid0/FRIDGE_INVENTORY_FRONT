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
