import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createMemoryStore } from '@/native/keyValueStore';
import { provideServerConfig } from '@/services/container';
import { createServerConfig } from '@/services/serverConfig';
import { setupFakeServices } from '@/testing/fakeServices';
import ServerSetupView from './ServerSetupView.vue';

async function setup(fetchResult: () => Promise<Response>) {
  setupFakeServices();
  const pinia = createPinia();
  setActivePinia(pinia);
  const config = createServerConfig({ configurable: true, store: createMemoryStore(), defaultUrl: '/api' });
  await config.load();
  provideServerConfig(config);
  vi.stubGlobal('fetch', vi.fn(fetchResult));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<p>tablet</p>' } },
      { path: '/configurar-servidor', component: ServerSetupView },
    ],
  });
  await router.push('/configurar-servidor');
  const wrapper = mount(ServerSetupView, { global: { plugins: [pinia, router] } });
  return { wrapper, router, config };
}

afterEach(() => vi.unstubAllGlobals());

describe('ServerSetupView', () => {
  it('prueba la conexión, guarda la dirección normalizada y vuelve a la tablet', async () => {
    const { wrapper, router, config } = await setup(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'ok', database: true }))),
    );
    await wrapper.get('#server-url').setValue('192.168.1.50:3000');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith('http://192.168.1.50:3000/api/health', expect.anything());
    expect(config.apiUrl()).toBe('http://192.168.1.50:3000/api');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('si no conecta, explica el problema y no guarda nada', async () => {
    const { wrapper, config } = await setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await wrapper.get('#server-url').setValue('192.168.1.99:3000');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('misma red');
    expect(config.needsSetup()).toBe(true);
  });

  it('rechaza direcciones inválidas sin intentar conectar', async () => {
    const { wrapper } = await setup(() => Promise.resolve(new Response('{}')));
    await wrapper.get('#server-url').setValue('ftp://servidor');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('192.168.1.50:3000');
  });
});
