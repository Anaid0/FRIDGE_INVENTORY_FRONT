import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KioskDevice, Product } from '@/domain/models';
import { ApiError } from '@/services/errors';
import { setupFakeServices } from '@/testing/fakeServices';
import { useKioskStore } from './kiosk';

const device: KioskDevice = {
  id: 'k1',
  name: 'Tablet cocina',
  isActive: true,
  createdBy: null,
  createdAt: '',
  lastSeenAt: null,
  revokedAt: null,
};
const product = (id: string, quantity: number): Product => ({
  id,
  name: id,
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

function setup(kioskToken: string | null = 'tablet-token') {
  setActivePinia(createPinia());
  const fakes = setupFakeServices(null, kioskToken);
  const { kiosk } = fakes.services;
  vi.mocked(kiosk.me).mockResolvedValue(device);
  vi.mocked(kiosk.products).mockResolvedValue([product('gaseosa', 5), product('yogur', 2)]);
  vi.mocked(kiosk.topWithdrawers).mockResolvedValue([
    { user: { id: 'u', name: 'Ana', lastname: 'G' }, totalWithdrawn: 9, withdrawals: 3 },
  ]);
  vi.mocked(kiosk.latestMovements).mockResolvedValue([]);
  vi.mocked(kiosk.people).mockResolvedValue([
    { id: 'u', name: 'Ana', lastname: 'G', initials: 'AG', pinLockedUntil: null },
  ]);
  return { ...fakes, store: useKioskStore() };
}

beforeEach(() => vi.restoreAllMocks());

describe('kiosk store', () => {
  it('sin token la tablet no está autorizada (y no llama a la API)', async () => {
    const { store, services } = setup(null);
    await store.init();
    expect(store.status).toBe('unpaired');
    expect(services.kiosk.me).not.toHaveBeenCalled();
  });

  it('con token carga el dispositivo, el stock y quién más retira', async () => {
    const { store } = setup();
    await store.init();
    expect(store.status).toBe('ready');
    expect(store.device?.name).toBe('Tablet cocina');
    expect(store.products.map((p) => p.id)).toEqual(['gaseosa', 'yogur']);
    expect(store.topWithdrawer?.user.name).toBe('Ana');
    expect(store.people.map((p) => p.initials)).toEqual(['AG']); // listas para "¿Quién eres?"
  });

  it('si la tablet fue revocada, olvida el token y lo muestra', async () => {
    const { store, services, kioskTokens } = setup();
    vi.mocked(services.kiosk.me).mockRejectedValue(new ApiError(401, 'DEVICE_REVOKED', 'revocada'));
    await store.init();
    expect(store.status).toBe('revoked');
    expect(kioskTokens.get()).toBeNull();
  });

  it('sin conexión queda en modo offline (conserva el token)', async () => {
    const { store, services, kioskTokens } = setup();
    vi.mocked(services.kiosk.me).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Sin conexión'));
    await store.init();
    expect(store.status).toBe('offline');
    expect(store.offlineMessage).toBe('Sin conexión');
    expect(kioskTokens.get()).toBe('tablet-token');
  });

  it('registrar actualiza el stock de inmediato', async () => {
    const { store, services } = setup();
    await store.init();
    // Tras registrar, el refresco trae el stock ya actualizado (como la API real).
    vi.mocked(services.kiosk.products).mockResolvedValue([product('gaseosa', 3), product('yogur', 2)]);
    vi.mocked(services.kiosk.register).mockResolvedValue({
      person: { id: 'u', name: 'Ana', lastname: 'G' },
      type: 'OUT',
      movements: [],
      products: [product('gaseosa', 3)],
    });
    await store.register({
      personId: 'u',
      pin: '2580',
      type: 'OUT',
      items: [{ productId: 'gaseosa', quantity: 2 }],
    });
    expect(store.products.find((p) => p.id === 'gaseosa')?.quantity).toBe(3);
  });

  it('adopt guarda el token al autorizar y unpair lo borra', async () => {
    const { store, kioskTokens, tokens } = setup(null);
    await store.adopt('nuevo-token', device);
    expect(kioskTokens.get()).toBe('nuevo-token');
    expect(tokens.get()).toBeNull(); // la sesión del admin es otra cosa
    expect(store.status).toBe('ready');
    store.unpair();
    expect(kioskTokens.get()).toBeNull();
    expect(store.status).toBe('unpaired');
  });
});
