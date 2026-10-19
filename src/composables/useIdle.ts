import { onBeforeUnmount, onMounted } from 'vue';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * Llama a `onIdle` tras `timeoutMs` sin interacción (toques, teclas, scroll). `shouldWatch` permite
 * desactivarlo cuando no hay nada que limpiar (p. ej. la tablet ya está en el inicio).
 */
export function useIdle(timeoutMs: number, onIdle: () => void, shouldWatch: () => boolean = () => true) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (shouldWatch()) onIdle();
      reset();
    }, timeoutMs);
  }

  onMounted(() => {
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true });
    reset();
  });
  onBeforeUnmount(() => {
    clearTimeout(timer);
    for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
  });

  return { reset };
}
