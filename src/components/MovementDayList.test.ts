import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { MovementView } from '@/domain/models';
import { formatMoney } from '@/utils/format';
import MovementDayList from './MovementDayList.vue';

const luis = { id: 'u1', name: 'Luis', lastname: 'Díaz' };
const movement = (over: Partial<MovementView>): MovementView => ({
  id: 'm1',
  type: 'OUT',
  source: 'MANUAL',
  quantity: 1,
  stockBefore: 10,
  stockAfter: 9,
  note: null,
  createdAt: '2026-10-19T17:40:00.000Z',
  product: { id: 'p1', name: 'Coca cola 250ml', unit: 'unidad' },
  performedBy: luis,
  registeredBy: luis,
  purchaseId: null,
  unitPrice: '2400.00',
  ...over,
});

function mountList(movements: MovementView[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<p/>' } }],
  });
  return mount(MovementDayList, {
    props: { movements, now: new Date('2026-10-19T20:00:00.000Z') },
    global: { plugins: [router] },
  });
}

describe('MovementDayList', () => {
  it('retiro: flecha roja hacia arriba, −N en rojo y el precio unitario', () => {
    const wrapper = mountList([movement({ quantity: 2 })]);
    const tile = wrapper.get('li > span[aria-hidden="true"]');
    expect(tile.classes()).toEqual(expect.arrayContaining(['bg-danger-50', 'text-danger-700']));
    expect(tile.find('path').attributes('d')).toBe('M12 19V5M6 11l6-6 6 6');
    const qty = wrapper.get('li p.num');
    expect(qty.text()).toBe('−2');
    expect(qty.classes()).toContain('text-danger-700');
    expect(wrapper.text()).toContain(`${formatMoney('2400.00')} c/u`);
    expect(wrapper.text()).toContain('Luis Díaz ·');
  });

  it('ingreso: flecha verde hacia abajo, +N en verde; sin precio cuando no lo tiene', () => {
    const wrapper = mountList([movement({ type: 'IN', source: 'PURCHASE', quantity: 6, unitPrice: null })]);
    const tile = wrapper.get('li > span[aria-hidden="true"]');
    expect(tile.classes()).toEqual(expect.arrayContaining(['bg-success-50', 'text-success-700']));
    expect(tile.find('path').attributes('d')).toBe('M12 5v14M6 13l6 6 6-6');
    const qty = wrapper.get('li p.num');
    expect(qty.text()).toBe('+6');
    expect(qty.classes()).toContain('text-success-700');
    expect(wrapper.text()).toContain('sin precio');
    expect(wrapper.text()).not.toContain('c/u');
  });
});
