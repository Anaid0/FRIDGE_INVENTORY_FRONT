import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Product } from '@/domain/models';
import { setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import StockInView from './StockInView.vue';

const product = (id: string, name: string, quantity: number): Product => ({
  id,
  code: null,
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

const agua = product('a', 'Agua', 1);
const leche = product('l', 'Leche', 6);

async function setup(query = '') {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.catalog.listProducts).mockResolvedValue([agua, leche]);
  vi.mocked(services.catalog.listCategories).mockResolvedValue([]);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/ingresar', component: StockInView },
      { path: '/admin', component: { template: '<p>inicio</p>' } },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push(`/admin/ingresar${query}`);
  const wrapper = mount(StockInView, { global: { plugins: [pinia, router], stubs: dialogStubs } });
  await flushPromises();
  return { wrapper, services, router };
}

const button = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], label: string) =>
  wrapper.get(`button[aria-label="${label}"]`);

const continueButton = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper.findAll('button').find((b) => b.text().includes('Continuar'))!;

const confirmButton = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper
    .get('[role="dialog"]')
    .findAll('button')
    .find((b) => b.text() === 'Ingresar')!;

describe('StockInView', () => {
  it('preselecciona el producto de ?producto= y muestra cuánto quedará', async () => {
    const { wrapper } = await setup('?producto=a');
    expect(wrapper.text()).toContain('Hay 1 → quedarán 2');
    expect(wrapper.text()).toContain('1 Agua');
  });

  it('registra cada línea en orden, avisa y vuelve al inicio', async () => {
    const { wrapper, services, router } = await setup();
    vi.mocked(services.movements.stockIn).mockImplementation(async (input) => ({
      movement: {} as never,
      product: { ...(input.productId === 'a' ? agua : leche) },
    }));
    await button(wrapper, 'Agregar Agua').trigger('click');
    await button(wrapper, 'Agregar un Agua').trigger('click');
    await button(wrapper, 'Agregar Leche').trigger('click');
    expect(wrapper.text()).toContain('2 Agua · 1 Leche');
    expect(continueButton(wrapper).text()).toContain('3 productos');

    await continueButton(wrapper).trigger('click');
    await wrapper.get('#stock-in-note').setValue('Regalo');
    await confirmButton(wrapper).trigger('click');
    await flushPromises();

    expect(services.movements.stockIn).toHaveBeenNthCalledWith(1, {
      productId: 'a',
      quantity: 2,
      note: 'Regalo',
    });
    expect(services.movements.stockIn).toHaveBeenNthCalledWith(2, {
      productId: 'l',
      quantity: 1,
      note: 'Regalo',
    });
    expect(router.currentRoute.value.path).toBe('/admin');
  });

  it('si una línea falla se detiene y conserva las que faltan', async () => {
    const { wrapper, services, router } = await setup();
    vi.mocked(services.movements.stockIn)
      .mockResolvedValueOnce({ movement: {} as never, product: { ...agua, quantity: 2 } })
      .mockRejectedValueOnce(new Error('Sin conexión'));
    await button(wrapper, 'Agregar Agua').trigger('click');
    await button(wrapper, 'Agregar Leche').trigger('click');
    await continueButton(wrapper).trigger('click');
    await confirmButton(wrapper).trigger('click');
    await flushPromises();

    expect(services.movements.stockIn).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[role="alert"]').text()).toContain('Se guardaron 1 de 2');
    expect(wrapper.text()).toContain('1 Leche');
    expect(wrapper.text()).toContain('Hay 2');
    expect(router.currentRoute.value.path).toBe('/admin/ingresar');
  });
});
