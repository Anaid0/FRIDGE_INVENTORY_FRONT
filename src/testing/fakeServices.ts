import { vi } from 'vitest';
import type { User } from '@/domain/models';
import { provideServices } from '@/services/container';
import type { Services, TokenStorage } from '@/services/ports';

export const anaUser: User = {
  id: 'u-ana',
  name: 'Ana',
  lastname: 'Pérez',
  fullName: 'Ana Pérez',
  email: 'ana@oficina.com',
  role: 'EMPLOYEE',
  isActive: true,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
};

export const adminUser: User = {
  ...anaUser,
  id: 'u-admin',
  name: 'Admin',
  fullName: 'Admin Pérez',
  role: 'ADMIN',
};

/** Todos los métodos son vi.fn() que fallan si no se configuran en el test. */
function stubs<T extends object>(names: (keyof T)[]): T {
  return Object.fromEntries(
    names.map((name) => [name, vi.fn().mockRejectedValue(new Error(`${String(name)} no configurado`))]),
  ) as T;
}

export function createFakeServices(): Services {
  return {
    auth: stubs(['login', 'me']),
    users: stubs(['list', 'options', 'createAdmin', 'update']),
    people: stubs(['list', 'create', 'update', 'resetPin']),
    kioskAdmin: stubs(['listDevices', 'pair', 'revoke']),
    kiosk: stubs(['me', 'people', 'products', 'topWithdrawers', 'latestMovements', 'register', 'changePin']),
    catalog: stubs([
      'listCategories',
      'createCategory',
      'listProducts',
      'getProduct',
      'createProduct',
      'updateProduct',
    ]),
    movements: stubs(['stockIn', 'stockOut', 'list', 'topWithdrawers', 'dashboard']),
    funding: stubs(['list', 'current', 'detail', 'open', 'close', 'contribute']),
    purchases: stubs(['list', 'detail', 'register', 'void', 'receipt']),
    reports: stubs(['spendingByProduct', 'spendingByCategory', 'priceHistory']),
  };
}

export function createMemoryTokens(initial: string | null = null): TokenStorage {
  let token = initial;
  return {
    get: () => token,
    set: (value) => {
      token = value;
    },
    clear: () => {
      token = null;
    },
  };
}

/** Registra servicios falsos y devuelve las piezas para configurarlos en cada test. */
export function setupFakeServices(
  initialToken: string | null = null,
  initialKioskToken: string | null = null,
) {
  const services = createFakeServices();
  const tokens = createMemoryTokens(initialToken);
  const kioskTokens = createMemoryTokens(initialKioskToken);
  provideServices(services, tokens, kioskTokens);
  return { services, tokens, kioskTokens };
}
