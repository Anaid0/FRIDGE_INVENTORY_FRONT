import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { PeriodSummary, Product } from '@/domain/models';
import { useAuthStore } from '@/stores/auth';
import { adminUser, anaUser, setupFakeServices } from '@/testing/fakeServices';
import PurchaseFormView from './PurchaseFormView.vue';

const product = (id: string, name: string): Product => ({
  id,
  code: null,
  name,
  description: null,
  unit: 'unidad',
  quantity: 0,
  minStock: 0,
  isLowStock: true,
  categoryId: null,
  referencePrice: null,
  currentPrice: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});

const openPeriod: PeriodSummary = {
  periodId: 'q1',
  name: 'Octubre 2ª',
  startDate: '2026-10-16',
  endDate: '2026-10-31',
  status: 'OPEN',
  collected: '100000.00',
  spent: '0.00',
  balance: '100000.00',
  isOverspent: false,
};

async function setup() {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue(adminUser);
  vi.mocked(services.funding.list).mockResolvedValue([openPeriod]);
  vi.mocked(services.users.options).mockResolvedValue([adminUser, anaUser]);
  vi.mocked(services.catalog.listProducts).mockResolvedValue([
    product('g', 'Gaseosa'),
    product('y', 'Yogur'),
  ]);
  await useAuthStore().restoreSession();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/compras/nueva', component: PurchaseFormView },
      { path: '/admin/compras/:id', component: { template: '<p>detalle</p>' } },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/admin/compras/nueva');
  const wrapper = mount(PurchaseFormView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, services, router };
}

describe('PurchaseFormView', () => {
  it('calcula subtotales y total en vivo y envía los precios normalizados', async () => {
    const { wrapper, services, router } = await setup();
    await wrapper.get('[id^="pl-product-"]').setValue('g');
    await wrapper.get('[id^="pl-qty-"]').setValue(12);
    await wrapper.get('[id^="pl-price-"]').setValue('2.500');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Agregar producto'))!
      .trigger('click');
    const products = wrapper.findAll('[id^="pl-product-"]');
    await products[1]!.setValue('y');
    await wrapper.findAll('[id^="pl-qty-"]')[1]!.setValue(6);
    await wrapper.findAll('[id^="pl-price-"]')[1]!.setValue('3000');

    expect(wrapper.text().replace(/\s/g, ' ')).toContain('$ 48.000');

    vi.mocked(services.purchases.register).mockResolvedValue({ id: 'c1', total: '48000.00' } as never);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.purchases.register).toHaveBeenCalledWith(
      expect.objectContaining({
        periodId: 'q1',
        buyerId: adminUser.id,
        items: [
          { productId: 'g', quantity: 12, unitPrice: '2500' },
          { productId: 'y', quantity: 6, unitPrice: '3000' },
        ],
        receipt: null,
      }),
    );
    expect(router.currentRoute.value.fullPath).toBe('/admin/compras/c1');
  });

  it('no envía si hay líneas inválidas o productos repetidos', async () => {
    const { wrapper, services } = await setup();
    await wrapper.get('form').trigger('submit');
    expect(wrapper.text()).toContain('Elige un producto');

    await wrapper.get('[id^="pl-product-"]').setValue('g');
    await wrapper.get('[id^="pl-price-"]').setValue('1000');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Agregar producto'))!
      .trigger('click');
    await wrapper.findAll('[id^="pl-product-"]')[1]!.setValue('g');
    await wrapper.findAll('[id^="pl-price-"]')[1]!.setValue('1000');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.text()).toContain('Producto repetido');
    expect(services.purchases.register).not.toHaveBeenCalled();
  });

  it('por paquete: calcula unidades y precio por unidad; el total pagado admite descuentos', async () => {
    const { wrapper, services } = await setup();
    await wrapper.get('[id^="pl-product-"]').setValue('g');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Paquete')!
      .trigger('click');
    await wrapper.get('[id^="pl-packs-"]').setValue(2);
    await wrapper.get('[id^="pl-per-"]').setValue(5);
    await wrapper.get('[id^="pl-pack-price-"]').setValue('15000');
    const calc = () => wrapper.get('[id^="pl-calc-"]').text().replace(/\s/g, ' ');
    expect(calc()).toMatch(/Entran 10 unidades.*\$ 3\.000 c\/u/);

    // Descuento en el segundo paquete: 15.000 + 9.000
    await wrapper.get('[id^="pl-total-"]').setValue('24.000');
    expect(calc()).toMatch(/\$ 2\.400 c\/u/);

    vi.mocked(services.purchases.register).mockResolvedValue({ id: 'c1', total: '24000.00' } as never);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.purchases.register).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ productId: 'g', packageCount: 2, unitsPerPackage: 5, total: '24000.00' }],
      }),
    );
  });
});
