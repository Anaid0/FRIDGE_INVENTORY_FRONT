const LOCALE = import.meta.env.VITE_LOCALE ?? 'es-CO';
const CURRENCY = import.meta.env.VITE_CURRENCY ?? 'COP';

/** "48000.00" -> "$ 48.000"; "2500.50" -> "$ 2.500,50". */
export function formatMoney(value: string | number | null | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** Fecha sin hora ('2026-10-16'): se formatea en UTC para que no se corra un día por la zona horaria. */
export function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

/** "hace 5 min", "hace 2 h", "hace 3 días". */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

export function fullName(user: { name: string; lastname: string }): string {
  return `${user.name} ${user.lastname}`;
}

export function initials(user: { name: string; lastname: string }): string {
  return `${user.name.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase();
}

/**
 * Convierte lo que escribe el usuario a un decimal para la API ("50.000" -> "50000", "2.500,50" -> "2500.50").
 * Reglas: si hay coma, los puntos son de miles y la coma es decimal; si solo hay puntos en grupos de 3
 * ("1.250.000"), son de miles; en otro caso el punto es decimal ("2500.5").
 * Devuelve null si no es un número válido.
 */
export function parseMoneyInput(raw: string): string | null {
  let text = raw.replace(/[\s$]/g, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  return /^\d+(\.\d{1,2})?$/.test(text) ? text : null;
}

/** Centavos enteros de un decimal ya validado ("2500.5" -> 250050), para sumar sin errores de coma flotante. */
export function toCents(decimal: string): number {
  const [int = '0', frac = ''] = decimal.split('.');
  return Number(int) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
}

/** "1 botella", "3 botellas", "2 unidades", "4 paquetes" (plural simple en español). */
export function withUnit(quantity: number, unit: string): string {
  if (quantity === 1 || !unit) return `${quantity} ${unit}`.trim();
  const plural = /[aeiouáéó]$/i.test(unit) ? `${unit}s` : `${unit}es`;
  return `${quantity} ${plural}`;
}

/** PIN aleatorio de 4 dígitos que el backend acepta (no trivial: ni repetido ni consecutivo). */
export function randomPin(random: () => number = Math.random): string {
  for (;;) {
    const pin = String(Math.floor(random() * 10_000)).padStart(4, '0');
    if (!isTrivialPin(pin)) return pin;
  }
}

/** Misma regla que el backend: todos iguales o una secuencia ascendente/descendente (0000, 1234, 4321). */
export function isTrivialPin(pin: string): boolean {
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, i) => digit - (digits[i] ?? 0));
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1);
}
