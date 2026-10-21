import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { MovementView, PeriodSummary } from '@/domain/models';
import { setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import { endOfDayISO, startOfDayISO } from '@/utils/dates';
import MovementsView from './MovementsView.vue';

const openPeriod: PeriodSummary = {
  periodId: 'q1',
  name: 'Octubre 2ª',
  startDate: '2026-10-16',
  endDate: '2026-10-31',
  status: 'OPEN',
  collected: '0.00',
  spent: '0.00',
  balance: '0.00',
  isOverspent: false,
};

const david = { id: 'u1', name: 'David', lastname: 'Ospino' };
const movement = (n: number): MovementView => ({
  id: `m${n}`,
  type: 'OUT',
  source: 'MANUAL',
  quantity: 1,
  stockBefore: 10,
  stockAfter: 9,
  note: null,
  createdAt: '2026-10-19T17:40:00.000Z',
  product: { id: 'p1', name: 'Coca cola 250ml', unit: 'unidad' },
  performedBy: david,
  registeredBy: david,
  purchaseId: null,
  unitPrice: null,
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function setup(path = '/admin/movimientos', period: PeriodSummary | null = openPeriod) {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.funding.current).mockResolvedValue(period);
  vi.mocked(services.catalog.listProducts).mockResolvedValue([]);
  vi.mocked(services.users.options).mockResolvedValue([]);
  vi.mocked(services.movements.list).mockImplementation(async (filter) => {
    const page = filter?.page ?? 1;
    const items = page === 1 ? Array.from({ length: 20 }, (_, i) => movement(i)) : [movement(20)];
    return { items, total: 21, page, pageSize: 20 };
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/movimientos', name: 'movements', component: MovementsView },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push(path);
  const wrapper = mount(MovementsView, { global: { plugins: [pinia, router], stubs: dialogStubs } });
  await flushPromises();
  return { wrapper, services, router };
}

describe('MovementsView', () => {
  it('sin filtros abre en la quincena actual y "Cargar más" agrega la página siguiente', async () => {
    const { wrapper, services } = await setup();
    expect(services.movements.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: startOfDayISO('2026-10-16'),
        to: endOfDayISO('2026-10-31'),
        page: 1,
        pageSize: 20,
      }),
    );
    expect(wrapper.text()).toContain('Esta quincena · 16 – 31 oct');
    expect(wrapper.text()).toContain('21 movimientos');
    const more = wrapper.findAll('button').find((b) => b.text().startsWith('Cargar más'))!;
    expect(more.text()).toBe('Cargar más · quedan 1');

    await more.trigger('click');
    await flushPromises();
    expect(services.movements.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(wrapper.findAll('li')).toHaveLength(21);
    expect(wrapper.findAll('button').some((b) => b.text().startsWith('Cargar más'))).toBe(false);
  });

  it('sin quincena abierta, el rango por defecto son los últimos 30 días', async () => {
    const { wrapper, services } = await setup('/admin/movimientos', null);
    const filter = vi.mocked(services.movements.list).mock.calls.at(-1)![0]!;
    expect(filter.from).toBeTruthy();
    expect(filter.to).toBeUndefined();
    expect(wrapper.text()).toContain('Últimos 30 días');
  });

  it('el segmentado filtra retiros y los filtros de la URL se respetan (sin rango por defecto)', async () => {
    const { wrapper, services, router } = await setup('/admin/movimientos?productId=p1');
    expect(services.movements.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ productId: 'p1', from: undefined, to: undefined }),
    );
    // El filtro de producto cuenta en el botón "Filtros".
    expect(wrapper.find('[aria-label="Filtros (1 activos)"]').exists()).toBe(true);

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retiros')!
      .trigger('click');
    await flushPromises();
    expect(services.movements.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'OUT', source: 'MANUAL', productId: 'p1', page: 1 }),
    );
    expect(router.currentRoute.value.query).toMatchObject({ kind: 'out', productId: 'p1', all: '1' });
  });

  it('el diálogo "Filtros" tiene tipo, producto, persona y fechas', async () => {
    const { wrapper } = await setup();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Filtros'))!
      .trigger('click');
    const dialog = wrapper.get('[role="dialog"]');
    for (const label of ['Tipo de movimiento', 'Producto', 'Persona', 'Fechas']) {
      expect(dialog.text()).toContain(label);
    }
  });
});
