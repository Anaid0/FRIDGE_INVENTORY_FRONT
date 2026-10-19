import { onIonViewWillEnter } from '@ionic/vue';
import { onMounted } from 'vue';

/**
 * Ionic deja las páginas montadas en memoria al navegar (para animar el "atrás"), así que `onMounted`
 * solo corre la primera vez. Esto ejecuta `fn` al montar y cada vez que se vuelve a la página.
 * Fuera de un ion-router-outlet (tests) solo corre al montar.
 */
export function useOnEnter(fn: () => unknown): void {
  let first = true;
  onMounted(() => {
    first = false;
    void fn();
  });
  onIonViewWillEnter(() => {
    if (first) return;
    void fn();
  });
}
