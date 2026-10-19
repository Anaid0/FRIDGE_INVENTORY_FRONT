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
  referencePrice: null,
  currentPrice: null,
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
    expect(wrapper.text()).toContain('Sacaste 2 Gaseosa, 1 Yogur y 3 Manzanas.');
  });

  it('muestra cómo va en el ranking de la quincena', () => {
    const wrapper = mount(KioskSuccess, { props: { result, standing: { units: 10, position: 1 } } });
    expect(wrapper.text()).toMatch(/Llevas 10 unidades esta quincena\.\s+Vas de #1 en el ranking\./);
    const third = mount(KioskSuccess, { props: { result, standing: { units: 4, position: 3 } } });
    expect(third.text()).toContain('Vas #3 en el ranking.');
  });

  it('dice cuánto suma lo que sacó a su aporte (al precio guardado en cada retiro)', () => {
    const priced = {
      ...result,
      movements: [
        { ...movement('g', 2), unitPrice: '2500.00' },
        { ...movement('y', 1), unitPrice: '3000.00' },
        { ...movement('m', 3), unitPrice: null },
      ],
    };
    const wrapper = mount(KioskSuccess, { props: { result: priced } });
    expect(wrapper.text()).toMatch(/Esto suma \$\s?8\.000 a tu aporte para el siguiente mercado/);

    const unpriced = mount(KioskSuccess, { props: { result } });
    expect(unpriced.text()).not.toContain('Esto suma');
  });

  it('vuelve solo al inicio al terminar la cuenta regresiva', async () => {
    vi.useFakeTimers();
    const wrapper = mount(KioskSuccess, { props: { result: { ...result, type: 'IN' }, seconds: 3 } });
    expect(wrapper.text()).toContain('Metiste 2 Gaseosa');
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });
});
