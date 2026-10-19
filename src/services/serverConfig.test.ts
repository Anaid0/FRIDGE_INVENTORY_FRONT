import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@/native/keyValueStore';
import { checkServer, createServerConfig, normalizeServerUrl, SERVER_URL_KEY } from './serverConfig';

describe('normalizeServerUrl', () => {
  it.each([
    ['192.168.1.50:3000', 'http://192.168.1.50:3000/api'],
    ['  http://192.168.1.50:3000/  ', 'http://192.168.1.50:3000/api'],
    ['http://servidor:3000/api', 'http://servidor:3000/api'],
    ['https://fridgeya.miempresa.com', 'https://fridgeya.miempresa.com/api'],
    ['https://miempresa.com/fridgeya/api/', 'https://miempresa.com/fridgeya/api'],
  ])('%j → %s', (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'ftp://servidor', 'http://', 'no es una url con espacios'])('rechaza %j', (input) => {
    expect(normalizeServerUrl(input)).toBeNull();
  });
});

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

describe('checkServer', () => {
  it('acepta un servidor de FridgeYA sano', async () => {
    const fetchMock = vi.fn(() => jsonResponse(200, { status: 'ok', database: true }));
    expect(await checkServer('http://x/api', fetchMock)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/health', expect.anything());
  });

  it('distingue servidor sin BD, otra cosa en esa dirección y sin conexión', async () => {
    expect(
      await checkServer('http://x/api', () => jsonResponse(503, { status: 'degraded', database: false })),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('base de datos'),
    });
    expect(await checkServer('http://x/api', () => jsonResponse(404, { error: 'nope' }))).toMatchObject({
      ok: false,
      message: expect.stringContaining('no responde FridgeYA'),
    });
    expect(
      await checkServer('http://x/api', () => Promise.reject(new TypeError('Failed to fetch'))),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('misma red'),
    });
  });
});

describe('createServerConfig', () => {
  it('en el navegador usa /api y no pide configuración', async () => {
    const config = createServerConfig({
      configurable: false,
      store: createMemoryStore(),
      defaultUrl: '/api',
    });
    await config.load();
    expect(config.needsSetup()).toBe(false);
    expect(config.apiUrl()).toBe('/api');
  });

  it('en Android pide la dirección la primera vez, la guarda y avisa del cambio', async () => {
    const store = createMemoryStore();
    const config = createServerConfig({ configurable: true, store, defaultUrl: '/api' });
    await config.load();
    expect(config.needsSetup()).toBe(true);

    const listener = vi.fn();
    config.onChange(listener);
    await config.save('http://192.168.1.50:3000/api');
    expect(config.needsSetup()).toBe(false);
    expect(config.apiUrl()).toBe('http://192.168.1.50:3000/api');
    expect(listener).toHaveBeenCalledWith('http://192.168.1.50:3000/api');
    expect(await store.get(SERVER_URL_KEY)).toBe('http://192.168.1.50:3000/api');

    // Al reiniciar la app se recupera lo guardado.
    const again = createServerConfig({ configurable: true, store, defaultUrl: '/api' });
    await again.load();
    expect(again.storedUrl()).toBe('http://192.168.1.50:3000/api');
  });
});
