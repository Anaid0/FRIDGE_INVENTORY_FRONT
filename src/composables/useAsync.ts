import { ref, shallowRef } from 'vue';
import { errorMessage } from '@/services/errors';

/**
 * Estado de una carga asíncrona. Mientras recarga conserva los datos anteriores
 * (sin parpadeos) y descarta respuestas viejas si se lanzó una carga más nueva.
 */
export function useAsync<T, A extends unknown[] = []>(fn: (...args: A) => Promise<T>) {
  const data = shallowRef<T | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  let latest = 0;

  async function run(...args: A): Promise<T | null> {
    const id = ++latest;
    loading.value = true;
    error.value = null;
    try {
      const result = await fn(...args);
      if (id === latest) data.value = result;
      return result;
    } catch (e) {
      if (id === latest) error.value = errorMessage(e);
      return null;
    } finally {
      if (id === latest) loading.value = false;
    }
  }

  return { data, error, loading, run };
}
