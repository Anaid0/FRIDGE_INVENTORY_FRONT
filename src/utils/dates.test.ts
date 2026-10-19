import { describe, expect, it } from 'vitest';
import { daysUntil, formatPeriodRange, remainingLabel } from './dates';

describe('fechas de la quincena', () => {
  it('formatea el rango como en los mockups', () => {
    expect(formatPeriodRange('2026-10-16', '2026-10-31')).toBe('16 – 31 de octubre');
    expect(formatPeriodRange('2026-10-16', '2026-10-31', true)).toBe('16 – 31 oct 2026');
    expect(formatPeriodRange('2026-09-28', '2026-10-12')).toBe('28 de septiembre – 12 de octubre');
  });

  it('cuenta los días que quedan', () => {
    const today = new Date(2026, 9, 19, 15, 30);
    expect(daysUntil('2026-10-31', today)).toBe(12);
    expect(remainingLabel('2026-10-31', today)).toBe('quedan 12 días');
    expect(remainingLabel('2026-10-20', today)).toBe('queda 1 día');
    expect(remainingLabel('2026-10-19', today)).toBe('termina hoy');
    expect(remainingLabel('2026-10-15', today)).toBe('ya terminó');
  });
});
