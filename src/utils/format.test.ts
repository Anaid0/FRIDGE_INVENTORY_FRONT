import { describe, expect, it } from 'vitest';
import {
  formatDateOnly,
  formatMoney,
  formatNumber,
  formatRelative,
  initials,
  parseMoneyInput,
  withUnit,
} from './format';

const normalize = (text: string) => text.replace(/\s/g, ' ');

describe('format', () => {
  it('formatMoney muestra pesos sin decimales salvo que haya centavos', () => {
    expect(normalize(formatMoney('48000.00'))).toBe('$ 48.000');
    expect(normalize(formatMoney('2500.50'))).toBe('$ 2.500,50');
    expect(normalize(formatMoney('-2000.00'))).toBe('-$ 2.000');
    expect(formatMoney('abc')).toBe('—');
  });

  it('formatDateOnly no corre la fecha por la zona horaria', () => {
    expect(formatDateOnly('2026-10-16')).toContain('16');
    expect(formatDateOnly('2026-10-01')).toContain('1');
  });

  it('formatRelative y utilidades de nombres', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(formatRelative('2026-10-16T11:55:00Z', now)).toBe('hace 5 minutos');
    expect(formatRelative('2026-10-14T12:00:00Z', now)).toBe('anteayer');
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(initials({ name: 'ana', lastname: 'pérez' })).toBe('AP');
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['50000', '50000'],
    ['50.000', '50000'],
    ['$ 1.250.000', '1250000'],
    ['2.500,50', '2500.50'],
    ['2500,5', '2500.5'],
    ['2500.50', '2500.50'],
    ['2500.5', '2500.5'],
  ])('%s -> %s', (raw, expected) => {
    expect(parseMoneyInput(raw)).toBe(expected);
  });

  it.each(['', 'abc', '-100', '1.2.3', '2500.555'])('rechaza %j', (raw) => {
    expect(parseMoneyInput(raw)).toBeNull();
  });
});

describe('withUnit', () => {
  it.each([
    [1, 'botella', '1 botella'],
    [3, 'botella', '3 botellas'],
    [2, 'unidad', '2 unidades'],
    [4, 'paquete', '4 paquetes'],
  ])('%i %s -> %s', (n, unit, expected) => {
    expect(withUnit(n, unit)).toBe(expected);
  });
});
