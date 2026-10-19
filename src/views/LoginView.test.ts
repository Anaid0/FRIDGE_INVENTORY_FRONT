import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiError } from '@/services/errors';
import { anaUser, setupFakeServices } from '@/testing/fakeServices';
import LoginView from './LoginView.vue';

async function mountLogin(query = '') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/admin', name: 'dashboard', component: { template: '<p>inicio</p>' } },
      { path: '/admin/compras', component: { template: '<p>compras</p>' } },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push(`/login${query}`);
  const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } });
  return { wrapper, router };
}

async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper']) {
  await wrapper.get('#email').setValue('ana@oficina.com');
  await wrapper.get('#password').setValue('Nevera123');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('LoginView', () => {
  let services: ReturnType<typeof setupFakeServices>['services'];
  beforeEach(() => {
    services = setupFakeServices().services;
  });

  it('con credenciales correctas vuelve a la ruta pedida', async () => {
    vi.mocked(services.auth.login).mockResolvedValue({ token: 't', user: anaUser });
    const { wrapper, router } = await mountLogin('?redirect=/admin/compras');
    await fillAndSubmit(wrapper);
    expect(router.currentRoute.value.fullPath).toBe('/admin/compras');
  });

  it('muestra el error de la API', async () => {
    vi.mocked(services.auth.login).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos'),
    );
    const { wrapper, router } = await mountLogin();
    await fillAndSubmit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Email o contraseña incorrectos');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('avisa si la sesión expiró y pide los datos si faltan', async () => {
    const { wrapper } = await mountLogin('?expired=1');
    expect(wrapper.get('[role="status"]').text()).toContain('sesión terminó');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[role="alert"]').text()).toBe('Escribe tu email y tu contraseña.');
    expect(services.auth.login).not.toHaveBeenCalled();
  });

  it('usa los valores autocompletados por el navegador aunque no haya evento input', async () => {
    vi.mocked(services.auth.login).mockResolvedValue({ token: 't', user: anaUser });
    const { wrapper, router } = await mountLogin();
    (wrapper.get('#email').element as HTMLInputElement).value = 'ana@oficina.com';
    (wrapper.get('#password').element as HTMLInputElement).value = 'Nevera123';
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.auth.login).toHaveBeenCalledWith('ana@oficina.com', 'Nevera123');
    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it.each(['https://malo.com', '//malo.com'])('ignora la redirección externa %s', async (target) => {
    vi.mocked(services.auth.login).mockResolvedValue({ token: 't', user: anaUser });
    const { wrapper, router } = await mountLogin(`?redirect=${encodeURIComponent(target)}`);
    await fillAndSubmit(wrapper);
    expect(router.currentRoute.value.fullPath).toBe('/admin');
  });
});
