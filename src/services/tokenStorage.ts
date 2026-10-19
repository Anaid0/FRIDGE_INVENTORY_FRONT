import type { KeyValueStore } from '@/native/keyValueStore';
import type { TokenStorage } from './ports';

/** Sesión del administrador. */
export const ADMIN_TOKEN_KEY = 'fridgeya.token';
/** Token de tablet (autorización del dispositivo, independiente de la sesión del admin). */
export const KIOSK_TOKEN_KEY = 'fridgeya.kioskToken';

/**
 * Token en localStorage. Si el navegador bloquea el almacenamiento (modo privado, políticas),
 * se usa memoria: la sesión funciona pero no sobrevive a recargar la página.
 */
export function createLocalTokenStorage(
  storage: Storage | undefined = globalThis.localStorage,
  key: string = ADMIN_TOKEN_KEY,
): TokenStorage & { load(): Promise<void> } {
  let memory: string | null = null;
  return {
    /** localStorage es síncrono: no hay nada que precargar. */
    async load() {},
    get() {
      try {
        return storage?.getItem(key) ?? memory;
      } catch {
        return memory;
      }
    },
    set(token) {
      memory = token;
      try {
        storage?.setItem(key, token);
      } catch {
        /* sin almacenamiento persistente */
      }
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(key);
      } catch {
        /* sin almacenamiento persistente */
      }
    },
  };
}

/**
 * Token sobre un almacenamiento asíncrono (Preferences en Android). La interfaz TokenStorage es síncrona,
 * así que se mantiene una copia en memoria: `load()` la llena al arrancar (antes de montar la app) y cada
 * cambio se escribe en segundo plano.
 */
export function createPersistentTokenStorage(
  store: KeyValueStore,
  key: string,
): TokenStorage & { load(): Promise<void> } {
  let value: string | null = null;
  const persist = (write: Promise<void>) => write.catch(() => undefined);
  return {
    async load() {
      value = await store.get(key).catch(() => null);
    },
    get: () => value,
    set(token) {
      value = token;
      void persist(store.set(key, token));
    },
    clear() {
      value = null;
      void persist(store.remove(key));
    },
  };
}
