import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Product } from '@/domain/models';
import { useAuthStore } from '@/stores/auth';
import { adminUser, setupFakeServices } from '@/testing/fakeServices';
import ProductsView from './ProductsView.vue';

const product = (over: Partial<Product>): Product => ({
  id: 'p',
  code: null,
  name: 'Producto',
  description: null,
  unit: 'unidad',
  quantity: 5,
  minStock: 2,
  isLowStock: false,
  categoryId: null,
  referencePrice: null,
  currentPrice: '2000.00',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

async function setup() {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue(adminUser);
  vi.mocked(services.catalog.listCategories).mockResolvedValue([{ id: 'c1', name: 'Bebidas' }] as never);
  vi.mocked(services.catalog.listProducts).mockResolvedValue([
    product({
      id: 'a',
      code: '11',
      name: 'Agua',
      quantity: 1,
      minStock: 3,
      isLowStock: true,
      categoryId: 'c1',
    }),
    product({
      id: 'g',
      code: '22',
      name: 'Guaro',
      quantity: 0,
      minStock: 1,
      isLowStock: true,
      categoryId: 'c1',
    }),
    product({ id: 'l', code: '24', name: 'Leche', quantity: 6 }),
    product({ id: 'x', code: '30', name: 'Viejo', isActive: false }),
  ]);
  await useAuthStore().restoreSession();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/productos', component: ProductsView },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/admin/productos');
  const wrapper = mount(ProductsView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, services };
}

const codes = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper.findAll('li [data-code]').map((c) => c.text());

describe('ProductsView', () => {
  it('muestra el resumen, los chips con conteos y las filas con código, stock y enlaces', async () => {
    const { wrapper } = await setup();
    const text = wrapper.text().replace(/\s+/g, ' ');
    expect(text).toContain('3 activos · 7 unidades · 2 por reponer');
    expect(text).toContain('Todas · 3');
    expect(text).toContain('Por reponer · 2');
    expect(text).toContain('Bebidas · 2');
    expect(text).toContain('Agotado');

    const rows = wrapper.findAll('li');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.get('[data-code]').text()).toBe('11');
    expect(rows[0]!.get('a').attributes('href')).toBe('/admin/productos/a/editar');
    expect(rows[0]!.get('[aria-label="Ingresar Agua"]').attributes('href')).toBe(
      '/admin/ingresar?producto=a',
    );
  });

  it('busca por nombre o por código y filtra por reponer', async () => {
    const { wrapper } = await setup();
    const search = wrapper.get('input[type="search"]');
    await search.setValue('2');
    expect(codes(wrapper)).toEqual(['22', '24']);
    await search.setValue('agu');
    expect(codes(wrapper)).toEqual(['11']);
    await search.setValue('');

    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Por reponer'))!
      .trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(2);
  });

  it('muestra los desactivados solo si se pide', async () => {
    const { wrapper } = await setup();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Mostrar desactivados (1)'))!
      .trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(4);
    expect(wrapper.text()).toContain('Desactivado');
  });
});
