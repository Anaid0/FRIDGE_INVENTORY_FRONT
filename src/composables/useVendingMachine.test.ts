import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/domain/models';
import { useVendingMachine } from './useVendingMachine';

const product = (code: string, name: string, quantity: number): Product => ({
  id: `p-${code}`,
  code,
  name,
  description: null,
  unit: 'unidad',
  quantity,
  minStock: 0,
  isLowStock: false,
  categoryId: null,
  referencePrice: null,
  currentPrice: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});

const AGUA = product('11', 'Agua', 2);
const GUARO = product('22', 'Guaro', 0);

function setup() {
  const onWithdraw = vi.fn();
  const onAdmin = vi.fn();
  const machine = useVendingMachine({ onWithdraw, onAdmin });
  const type = (digits: string) => [...digits].forEach((d) => machine.digit(d));
  return { machine, type, onWithdraw, onAdmin };
}

describe('useVendingMachine', () => {
  it('sin nada elegido pide tocar los productos', () => {
    const { machine } = setup();
    expect(machine.display.value).toMatchObject({ sub: 'Toca los productos que vas a llevar', showLock: true });
  });

  it('tocar productos los agrega, sin pasar de lo disponible', () => {
    const { machine } = setup();
    machine.add(AGUA);
    machine.add(AGUA);
    machine.add(AGUA);
    expect(machine.cart.quantityOf(AGUA.id)).toBe(2);
    expect(machine.display.value).toMatchObject({ sub: 'Ya tienes todos los Agua disponibles', isError: true });
    machine.add(GUARO);
    expect(machine.cart.quantityOf(GUARO.id)).toBe(0);
    expect(machine.display.value.sub).toBe('Guaro está agotado');
  });

  it('con productos elegidos el teclado pide el PIN y OK retira', () => {
    const { machine, type, onWithdraw } = setup();
    machine.add(AGUA);
    expect(machine.display.value).toMatchObject({ label: 'TU PIN', sub: '1 producto · escribe tu PIN para retirar' });
    type('258');
    expect(machine.okEnabled.value).toBe(false);
    type('09'); // máximo 4 dígitos
    expect(machine.entry.value).toBe('2580');
    machine.ok();
    expect(onWithdraw).toHaveBeenCalledWith('2580');
  });

  it('un PIN rechazado se muestra en la pantalla y se pide de nuevo', () => {
    const { machine, type } = setup();
    machine.add(AGUA);
    type('1111');
    machine.rejectEntry('PIN incorrecto · te quedan 4 intentos');
    expect(machine.entry.value).toBe('');
    expect(machine.display.value).toMatchObject({ sub: 'PIN incorrecto · te quedan 4 intentos', isError: true });
    machine.digit('1');
    expect(machine.display.value.isError).toBe(false);
  });

  it('con el retiro vacío, lo marcado es un código de administrador', () => {
    const { machine, type, onAdmin } = setup();
    type('482');
    expect(machine.display.value).toMatchObject({ label: 'ADMINISTRADOR', big: '● ● ●' });
    expect(machine.okEnabled.value).toBe(false);
    type('9157'); // máximo 6 dígitos
    expect(machine.okAction.value).toBe('admin');
    machine.ok();
    expect(onAdmin).toHaveBeenCalledWith('482915');
  });

  it('tocar un producto mientras se escribía un código de admin lo descarta', () => {
    const { machine, type } = setup();
    type('48');
    machine.add(AGUA);
    expect(machine.entry.value).toBe('');
    expect(machine.step.value).toBe('pin');
  });
});
