import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Product } from '@/domain/models';
import { ApiError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { adminUser, setupFakeServices } from '@/testing/fakeServices';
import ProductFormView from './ProductFormView.vue';

const coca: Product = {
  id: 'p1',
  code: '21',
  name: 'Coca cola 250ml',
  description: null,
  unit: 'unidad',
  quantity: 9,
  minStock: 4,
  isLowStock: false,
  categoryId: 'c1',
  referencePrice: '2000.00',
  currentPrice: '2000.00',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

async function setup(id?: string) {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue(adminUser);
  vi.mocked(services.catalog.listCategories).mockResolvedValue([
    { id: 'c1', name: 'Bebidas' },
    { id: 'c2', name: 'Snacks' },
  ] as never);
  vi.mocked(services.catalog.listProducts).mockResolvedValue([coca]);
  vi.mocked(services.catalog.getProduct).mockResolvedValue({ product: coca, latestMovements: [] });
  vi.mocked(services.movements.topWithdrawers).mockResolvedValue([]);
  await useAuthStore().restoreSession();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/productos/nuevo', component: ProductFormView },
      { path: '/admin/productos/:id/editar', component: ProductFormView, props: true },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push(id ? `/admin/productos/${id}/editar` : '/admin/productos/nuevo');
  const wrapper = mount(ProductFormView, {
    props: id ? { id } : {},
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, services, router };
}

const button = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))!;

describe('ProductFormView', () => {
  it('crear: el código es opcional y se envía null si queda vacío', async () => {
    const { wrapper, services, router } = await setup();
    expect(wrapper.text()).toContain('Si lo dejas vacío se asigna solo');
    expect(wrapper.text()).not.toContain('EN LA NEVERA');
    await wrapper.get('#p-name').setValue('Agua');
    await button(wrapper, 'Snacks').trigger('click');
    vi.mocked(services.catalog.createProduct).mockResolvedValue({ ...coca, name: 'Agua', code: '11' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.catalog.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Agua', code: null, categoryId: 'c2' }),
    );
    expect(router.currentRoute.value.fullPath).toBe('/admin/productos');
    wrapper.unmount();
  });

  it('editar: muestra el error de código ocupado junto al campo', async () => {
    const { wrapper, services } = await setup('p1');
    expect(wrapper.text()).toContain('Coca cola 250ml');
    const code = wrapper.get('#p-code');
    expect((code.element as HTMLInputElement).value).toBe('21');
    await code.setValue('3a5');
    expect((code.element as HTMLInputElement).value).toBe('35');

    vi.mocked(services.catalog.updateProduct).mockRejectedValue(
      new ApiError(409, 'PRODUCT_CODE_TAKEN', 'El código 35 ya lo tiene Agua'),
    );
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.catalog.updateProduct).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ code: '35', isActive: true, referencePrice: '2000' }),
    );
    expect(wrapper.get('#p-code-error').text()).toContain('El código 35 ya lo tiene Agua');
    expect(wrapper.get('#p-code').attributes('aria-invalid')).toBe('true');
    wrapper.unmount();
  });

  it('editar: ingresa N unidades a la nevera y actualiza el stock', async () => {
    const { wrapper, services } = await setup('p1');
    await wrapper.get('[aria-label="Más"]').trigger('click');
    await wrapper.get('[aria-label="Más"]').trigger('click');
    const stockIn = button(wrapper, 'Ingresar 3 a la nevera');
    expect(stockIn.text()).toContain('quedarán 12');
    vi.mocked(services.movements.stockIn).mockResolvedValue({
      movement: { quantity: 3 } as never,
      product: { ...coca, quantity: 12 },
    });
    await stockIn.trigger('click');
    await flushPromises();
    expect(services.movements.stockIn).toHaveBeenCalledWith({ productId: 'p1', quantity: 3 });
    expect(wrapper.get('[data-stock]').text()).toBe('12');
    wrapper.unmount();
  });

  it('editar: desactivar pide confirmación', async () => {
    const { wrapper, services } = await setup('p1');
    vi.mocked(services.catalog.updateProduct).mockResolvedValue({ ...coca, isActive: false });
    await button(wrapper, 'Desactivar producto').trigger('click');
    await flushPromises();
    expect(services.catalog.updateProduct).not.toHaveBeenCalled();
    const confirm = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Desactivar',
    );
    confirm!.click();
    await flushPromises();
    expect(services.catalog.updateProduct).toHaveBeenCalledWith('p1', { isActive: false });
    wrapper.unmount();
  });
});
