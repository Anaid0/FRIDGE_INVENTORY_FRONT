import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/errors';
import { adminUser, anaUser, setupFakeServices } from '@/testing/fakeServices';
import { useAuthStore } from './auth';

beforeEach(() => setActivePinia(createPinia()));

describe('auth store', () => {
  it('login guarda token y usuario', async () => {
    const { services, tokens } = setupFakeServices();
    vi.mocked(services.auth.login).mockResolvedValue({ token: 't1', user: adminUser });
    const auth = useAuthStore();

    await auth.login(' admin@oficina.com ', 'Clave1234');

    expect(services.auth.login).toHaveBeenCalledWith('admin@oficina.com', 'Clave1234');
    expect(tokens.get()).toBe('t1');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isAdmin).toBe(true);
  });

  it('un login fallido no deja sesión', async () => {
    const { services } = setupFakeServices();
    vi.mocked(services.auth.login).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrecto'));
    const auth = useAuthStore();
    await expect(auth.login('a@b.co', 'x')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(auth.isAuthenticated).toBe(false);
  });

  it('restoreSession carga el usuario del token guardado (una sola vez)', async () => {
    const { services } = setupFakeServices('guardado');
    vi.mocked(services.auth.me).mockResolvedValue(anaUser);
    const auth = useAuthStore();
    await auth.restoreSession();
    await auth.restoreSession();
    expect(services.auth.me).toHaveBeenCalledOnce();
    expect(auth.user?.name).toBe('Ana');
    expect(auth.isAdmin).toBe(false);
  });

  it('si el token guardado ya no sirve, cierra la sesión', async () => {
    const { services, tokens } = setupFakeServices('vencido');
    vi.mocked(services.auth.me).mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'x'));
    const auth = useAuthStore();
    await auth.restoreSession();
    expect(auth.isAuthenticated).toBe(false);
    expect(tokens.get()).toBeNull();
  });

  it('sin token no llama a la API', async () => {
    const { services } = setupFakeServices();
    await useAuthStore().restoreSession();
    expect(services.auth.me).not.toHaveBeenCalled();
  });

  it('logout limpia todo', async () => {
    const { services, tokens } = setupFakeServices();
    vi.mocked(services.auth.login).mockResolvedValue({ token: 't1', user: anaUser });
    const auth = useAuthStore();
    await auth.login('ana@oficina.com', 'x');
    auth.logout();
    expect(auth.user).toBeNull();
    expect(tokens.get()).toBeNull();
  });
});
