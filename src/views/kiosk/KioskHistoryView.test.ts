import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { MovementView } from '@/domain/models';
import { ApiError } from '@/services/errors';
import { setupFakeServices } from '@/testing/fakeServices';
import KioskHistoryView from './KioskHistoryView.vue';

const luis = { id: 'u1', name: 'Luis', lastname: 'Díaz' };
const movement = (n: number): MovementView => ({
  id: `m${n}`,
  type: 'OUT',
  source: 'MANUAL',
  quantity: 1,
  stockBefore: 10,
  stockAfter: 9,
  note: null,
  createdAt: '2026-10-19T17:40:00.000Z',
  product: { id: 'p1', name: `Producto ${n}`, unit: 'unidad' },
  performedBy: luis,
  registeredBy: luis,
  purchaseId: null,
  unitPrice: '2400.00',
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function setup(total = 45) {
  const { services } = setupFakeServices(null, 'kiosk-token');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.kiosk.movements).mockImplementation(async ({ page, pageSize }) => {
    const start = (page - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - start));
    return { items: Array.from({ length: count }, (_, i) => movement(start + i)), total, page, pageSize };
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/historial', component: KioskHistoryView },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/historial');
  const wrapper = mount(KioskHistoryView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, services };
}

const button = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], name: string) =>
  wrapper.findAll('button').find((b) => b.text() === name || b.attributes('aria-label') === name)!;

describe('KioskHistoryView', () => {
  it('pide de a 20 y pagina con "Siguiente"', async () => {
    const { wrapper, services } = await setup();
    expect(services.kiosk.movements).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, type: undefined });
    expect(wrapper.findAll('li')).toHaveLength(20);
    expect(wrapper.text()).toContain('Luis Díaz ·');
    expect(wrapper.text()).toMatch(/Mostrando\s*1–20\s*de\s*45/);

    await button(wrapper, 'Página siguiente').trigger('click');
    await flushPromises();
    expect(services.kiosk.movements).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, type: undefined });
    expect(wrapper.text()).toMatch(/Mostrando\s*21–40\s*de\s*45/);
  });

  it('el filtro Retiros/Ingresos va al servidor y vuelve a la página 1', async () => {
    const { wrapper, services } = await setup();
    await button(wrapper, 'Página siguiente').trigger('click');
    await flushPromises();

    await button(wrapper, 'Retiros').trigger('click');
    await flushPromises();
    expect(services.kiosk.movements).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, type: 'OUT' });
    expect(button(wrapper, 'Retiros').attributes('aria-pressed')).toBe('true');

    await button(wrapper, 'Ingresos').trigger('click');
    await flushPromises();
    expect(services.kiosk.movements).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, type: 'IN' });

    await button(wrapper, 'Todo').trigger('click');
    await flushPromises();
    expect(services.kiosk.movements).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, type: undefined });
  });

  it('sin movimientos muestra el estado vacío y sin paginación', async () => {
    const { wrapper } = await setup(0);
    expect(wrapper.text()).toContain('Todavía no hay movimientos.');
    expect(wrapper.find('nav[aria-label="Paginación"]').exists()).toBe(false);
  });

  it('si falla, muestra el error y "Reintentar" vuelve a pedir', async () => {
    const { wrapper, services } = await setup();
    vi.mocked(services.kiosk.movements).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'Se cayó el servidor'),
    );
    await button(wrapper, 'Retiros').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Se cayó el servidor');

    await button(wrapper, 'Reintentar').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.findAll('li')).toHaveLength(20);
  });

  it('tiene la leyenda de las flechas en el encabezado', async () => {
    const { wrapper } = await setup();
    expect(wrapper.find('button[aria-label="Qué significan las flechas"]').exists()).toBe(true);
  });
});
