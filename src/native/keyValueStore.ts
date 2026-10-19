import { Preferences } from '@capacitor/preferences';

/** Almacenamiento clave-valor asíncrono (Preferences de Capacitor en el dispositivo). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * En Android usa SharedPreferences: a diferencia de localStorage del WebView, el sistema no lo borra
 * para liberar espacio. Así la tablet no pierde su autorización ni la dirección del servidor.
 */
export const preferencesStore: KeyValueStore = {
  async get(key) {
    return (await Preferences.get({ key })).value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
};

/** Para el navegador y los tests. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
