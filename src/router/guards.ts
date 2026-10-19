import type { NavigationGuardWithThis, RouteLocationRaw } from 'vue-router';

export interface SessionState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  restoreSession(): Promise<void>;
}

/**
 * - Rutas privadas (todas salvo meta.public): exigen sesión; si no, van al login con ?redirect.
 * - meta.guestOnly (login): si ya hay sesión, va al inicio.
 * - meta.requiresAdmin: un empleado vuelve al inicio.
 * - En la app Android, sin dirección del servidor todo lleva a configurarla.
 */
export function createAuthGuard(
  getSession: () => SessionState,
  needsServerSetup: () => boolean = () => false,
): NavigationGuardWithThis<undefined> {
  return async (to): Promise<true | RouteLocationRaw> => {
    // App Android sin dirección del servidor: lo primero es configurarla.
    if (needsServerSetup()) return to.name === 'server-setup' ? true : { name: 'server-setup' };

    const session = getSession();
    await session.restoreSession();

    if (to.meta.public) {
      return to.meta.guestOnly && session.isAuthenticated ? { name: 'dashboard' } : true;
    }
    if (!session.isAuthenticated) {
      return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
    }
    if (to.meta.requiresAdmin && !session.isAdmin) {
      return { name: 'dashboard' };
    }
    return true;
  };
}
