import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KioskMovementResult, Movement, Product } from '@/domain/models';
import KioskSuccess from './KioskSuccess.vue';

const product = (id: string, name: string, unit: string): Product => ({
  id,
  name,
  description: null,
  unit,
  quantity: 1,
  minStock: 0,
  isLowStock: false,
  categoryId: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});
const movement = (productId: string, quantity: number) => ({ productId, quantity }) as Movement;

const result: KioskMovementResult = {
  person: { id: 'u', name: 'Ana', lastname: 'Gómez' },
  type: 'OUT',
  movements: [movement('g', 2), movement('y', 1), movement('m', 3)],
  products: [
    product('g', 'Gaseosa', 'botella'),
    product('y', 'Yogur', 'unidad'),
    product('m', 'Manzanas', 'unidad'),
  ],
};

afterEach(() => vi.useRealTimers());

describe('KioskSuccess', () => {
  it('resume lo que se sacó en una frase', () => {
    const wrapper = mount(KioskSuccess, { props: { result } });
    expect(wrapper.text()).toContain('¡Listo, Ana!');
    expect(wrapper.text()).toContain(
      'Ana sacó 2 botellas de Gaseosa, 1 unidad de Yogur y 3 unidades de Manzanas.',
    );
  });

  it('vuelve solo al inicio al terminar la cuenta regresiva', async () => {
    vi.useFakeTimers();
    const wrapper = mount(KioskSuccess, { props: { result: { ...result, type: 'IN' }, seconds: 3 } });
    expect(wrapper.text()).toContain('Ana metió');
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });
});
