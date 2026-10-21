import type { KeyValueStore } from '@/native/keyValueStore';

export const SERVER_URL_KEY = 'fridgeya.serverUrl';
/** Con qué dirección de fábrica se guardó la del usuario: si el APK trae otra, la guardada se descarta. */
export const SERVER_PRESET_KEY = 'fridgeya.serverUrl.preset';

/**
 * Cabeceras extra según el servidor. Los túneles de desarrollo de VS Code (*.devtunnels.ms) muestran una
 * página de aviso antes de dejar pasar; con esta cabecera la API responde directo.
 */
export function serverHeaders(apiUrl: string | undefined): Record<string, string> {
  try {
    const host = new URL(apiUrl ?? '').hostname;
    return host.endsWith('.devtunnels.ms') ? { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' } : {};
  } catch {
    return {};
  }
}

/**
 * Dirección de la API escrita por el usuario → URL base normalizada que termina en /api.
 * Acepta "192.168.1.50:3000", "http://servidor:3000", "https://fridgeya.miempresa.com/api".
 * Devuelve null si no es una dirección http(s) válida.
 */
export function normalizeServerUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `http://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path.endsWith('/api') ? path : `${path}/api`}`;
}

export type ServerCheck = { ok: true } | { ok: false; message: string };

/** Comprueba que en esa dirección responda la API de FridgeYA (GET /api/health). */
export async function checkServer(
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<ServerCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${apiUrl}/health`, {
      signal: controller.signal,
      headers: serverHeaders(apiUrl),
    });
    const body = (await response.json().catch(() => null)) as { status?: string; database?: boolean } | null;
    // /api/health responde 503 con database:false si el servidor no llega a MySQL: mensaje específico.
    if (body?.status !== undefined && body.database === false) {
      return { ok: false, message: 'El servidor responde, pero no tiene conexión a la base de datos.' };
    }
    if (!response.ok || body?.status === undefined) {
      return { ok: false, message: 'En esa dirección no responde FridgeYA. Revisa la IP y el puerto.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'No se pudo conectar. ¿La tablet está en la misma red que el servidor?' };
  } finally {
    clearTimeout(timer);
  }
}

export interface ServerConfig {
  /** En la app nativa hace falta una dirección; en el navegador se usa la misma web (/api). */
  readonly configurable: boolean;
  load(): Promise<void>;
  needsSetup(): boolean;
  apiUrl(): string;
  /** URL escrita por el usuario (para mostrarla), o null si no hay. */
  storedUrl(): string | null;
  save(apiUrl: string): Promise<void>;
  onChange(listener: (apiUrl: string) => void): void;
}

/**
 * - Navegador: la API vive junto a la web (`/api`, o VITE_API_URL); no hay nada que configurar.
 * - Android (Capacitor): la app no tiene servidor propio. Si el APK trae una dirección de fábrica
 *   (`presetUrl`, de VITE_NATIVE_API_URL) se usa directamente; si no, se pide la primera vez y se guarda.
 *   "Cambiar servidor" sigue funcionando: lo que guarde el usuario gana hasta que llegue un APK con otra
 *   dirección de fábrica.
 */
export function createServerConfig(options: {
  configurable: boolean;
  store: KeyValueStore;
  defaultUrl: string;
  presetUrl?: string | null;
}): ServerConfig {
  const preset = options.presetUrl ?? null;
  let stored: string | null = null;
  const listeners: ((apiUrl: string) => void)[] = [];
  return {
    configurable: options.configurable,
    async load() {
      if (!options.configurable) return;
      const [url, savedWith] = await Promise.all([
        options.store.get(SERVER_URL_KEY).catch(() => null),
        options.store.get(SERVER_PRESET_KEY).catch(() => null),
      ]);
      // Una dirección guardada con otro APK (otra dirección de fábrica, o ninguna) ya no vale.
      stored = preset && savedWith !== preset ? null : url;
    },
    needsSetup: () => options.configurable && !stored && !preset,
    apiUrl: () => stored ?? (options.configurable ? preset : null) ?? options.defaultUrl,
    storedUrl: () => stored ?? (options.configurable ? preset : null),
    async save(apiUrl) {
      stored = apiUrl;
      await options.store.set(SERVER_URL_KEY, apiUrl);
      await options.store.set(SERVER_PRESET_KEY, preset ?? '');
      for (const listener of listeners) listener(apiUrl);
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
