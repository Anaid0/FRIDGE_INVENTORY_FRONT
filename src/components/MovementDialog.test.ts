import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, User } from '@/domain/models';
import { ApiError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { adminUser, anaUser, setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import MovementDialog from './MovementDialog.vue';

const gaseosa: Product = {
  id: 'p1',
  name: 'Gaseosa',
  description: null,
  unit: 'unidad',
  quantity: 5,
  minStock: 1,
  isLowStock: false,
  categoryId: null,
  referencePrice: null,
  currentPrice: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

async function setup(user: User) {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue(user);
  vi.mocked(services.users.options).mockResolvedValue([adminUser, anaUser]);
  vi.mocked(services.movements.topWithdrawers).mockResolvedValue([]);
  await useAuthStore().restoreSession();
  const wrapper = mount(MovementDialog, {
    props: { open: true, type: 'OUT', product: gaseosa },
    global: { plugins: [pinia], stubs: dialogStubs },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, services };
}

function result(performedBy: string) {
  return {
    product: { ...gaseosa, quantity: 3 },
    movement: {
      id: 'm1',
      productId: 'p1',
      type: 'OUT' as const,
      source: 'MANUAL' as const,
      quantity: 2,
      stockBefore: 5,
      stockAfter: 3,
      performedBy,
      registeredBy: 'u-admin',
      note: null,
      purchaseItemId: null,
      unitPrice: null,
      createdAt: '',
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('MovementDialog', () => {
  it('un empleado no ve el selector de "quién lo realizó" y no envía performedBy', async () => {
    const { wrapper, services } = await setup(anaUser);
    expect(wrapper.find('#mv-performer').exists()).toBe(false);
    vi.mocked(services.movements.stockOut).mockResolvedValue(result(anaUser.id));
    await wrapper.get('#mv-quantity').setValue(2);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.movements.stockOut).toHaveBeenCalledWith({
      productId: 'p1',
      quantity: 2,
      note: null,
      performedBy: null,
    });
    expect(wrapper.emitted('done')?.[0]?.[0]).toMatchObject({ quantity: 3 });
    expect(services.movements.topWithdrawers).toHaveBeenCalled(); // refresca el indicador de la cabecera
  });

  it('el admin puede registrar a nombre de otra persona', async () => {
    const { wrapper, services } = await setup(adminUser);
    const select = wrapper.get('#mv-performer');
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Admin Pérez (yo)', 'Ana Pérez']);
    vi.mocked(services.movements.stockOut).mockResolvedValue(result(anaUser.id));
    await select.setValue(anaUser.id);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.movements.stockOut).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: anaUser.id }),
    );
  });

  it('no deja sacar más de lo que hay y muestra los errores de la API', async () => {
    const { wrapper, services } = await setup(anaUser);
    await wrapper.get('#mv-quantity').setValue(9);
    expect(wrapper.text()).toContain('Solo hay 5 disponibles.');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

    vi.mocked(services.movements.stockOut).mockRejectedValue(
      new ApiError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente: hay 1 y se intentan retirar 2'),
    );
    await wrapper.get('#mv-quantity').setValue(2);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Stock insuficiente');
    expect(wrapper.emitted('done')).toBeUndefined();
  });
});
