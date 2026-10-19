import { describe, expect, it } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { createAuthGuard, type SessionState } from './guards';

function session(overrides: Partial<SessionState> = {}): SessionState {
  return { isAuthenticated: false, isAdmin: false, restoreSession: async () => undefined, ...overrides };
}

function route(fullPath: string, meta: RouteLocationNormalized['meta'] = {}) {
  return { fullPath, meta } as RouteLocationNormalized;
}

async function navigate(state: SessionState, to: RouteLocationNormalized, needsSetup = false) {
  const guard = createAuthGuard(
    () => state,
    () => needsSetup,
  );
  return guard.call(undefined, to, route('/'), () => undefined);
}

describe('createAuthGuard', () => {
  it('sin sesión, una ruta privada redirige al login con ?redirect', async () => {
    expect(await navigate(session(), route('/compras?x=1'))).toEqual({
      name: 'login',
      query: { redirect: '/compras?x=1' },
    });
    expect(await navigate(session(), route('/'))).toEqual({ name: 'login', query: {} });
  });

  it('las rutas públicas pasan; el login redirige al inicio si ya hay sesión', async () => {
    expect(await navigate(session(), route('/login', { public: true, guestOnly: true }))).toBe(true);
    expect(
      await navigate(session({ isAuthenticated: true }), route('/login', { public: true, guestOnly: true })),
    ).toEqual({ name: 'dashboard' });
  });

  it('las rutas de admin rechazan a los empleados', async () => {
    const adminRoute = route('/usuarios', { requiresAdmin: true });
    expect(await navigate(session({ isAuthenticated: true }), adminRoute)).toEqual({ name: 'dashboard' });
    expect(await navigate(session({ isAuthenticated: true, isAdmin: true }), adminRoute)).toBe(true);
  });

  it('espera a recuperar la sesión antes de decidir', async () => {
    const state = session();
    state.restoreSession = async () => {
      state.isAuthenticated = true;
    };
    expect(await navigate(state, route('/'))).toBe(true);
  });
});

describe('configuración del servidor (app Android)', () => {
  it('sin dirección del servidor todo lleva a configurarla', async () => {
    expect(await navigate(session({ isAuthenticated: true }), route('/admin'), true)).toEqual({
      name: 'server-setup',
    });
    const setup = {
      ...route('/configurar-servidor', { public: true }),
      name: 'server-setup',
    } as RouteLocationNormalized;
    expect(await navigate(session(), setup, true)).toBe(true);
  });
});
