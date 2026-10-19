import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@/native/keyValueStore';
import { createLocalTokenStorage, createPersistentTokenStorage } from './tokenStorage';

describe('createLocalTokenStorage', () => {
  it('guarda, lee y borra el token en localStorage', () => {
    const tokens = createLocalTokenStorage(window.localStorage);
    tokens.set('abc');
    expect(window.localStorage.getItem('fridgeya.token')).toBe('abc');
    expect(tokens.get()).toBe('abc');
    tokens.clear();
    expect(tokens.get()).toBeNull();
  });

  it('si el almacenamiento falla, sigue funcionando en memoria', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    } as unknown as Storage;
    const tokens = createLocalTokenStorage(broken);
    tokens.set('abc');
    expect(tokens.get()).toBe('abc');
    tokens.clear();
    expect(tokens.get()).toBeNull();
  });
});

describe('claves separadas', () => {
  it('la sesión del admin y la tablet no se pisan', () => {
    const admin = createLocalTokenStorage(window.localStorage);
    const kiosk = createLocalTokenStorage(window.localStorage, 'fridgeya.kioskToken');
    admin.set('admin');
    kiosk.set('tablet');
    admin.clear();
    expect(kiosk.get()).toBe('tablet');
    kiosk.clear();
  });
});

describe('createPersistentTokenStorage (Preferences en Android)', () => {
  it('precarga el token guardado y escribe los cambios', async () => {
    const store = createMemoryStore({ 'fridgeya.kioskToken': 'guardado' });
    const tokens = createPersistentTokenStorage(store, 'fridgeya.kioskToken');
    expect(tokens.get()).toBeNull(); // antes de load()
    await tokens.load();
    expect(tokens.get()).toBe('guardado');

    tokens.set('nuevo');
    expect(tokens.get()).toBe('nuevo');
    await Promise.resolve();
    expect(await store.get('fridgeya.kioskToken')).toBe('nuevo');

    tokens.clear();
    await Promise.resolve();
    expect(await store.get('fridgeya.kioskToken')).toBeNull();
  });

  it('si el almacenamiento falla, sigue funcionando en memoria', async () => {
    const failing = {
      get: () => Promise.reject(new Error('x')),
      set: () => Promise.reject(new Error('x')),
      remove: () => Promise.reject(new Error('x')),
    };
    const tokens = createPersistentTokenStorage(failing, 'k');
    await tokens.load();
    tokens.set('t');
    expect(tokens.get()).toBe('t');
  });
});
