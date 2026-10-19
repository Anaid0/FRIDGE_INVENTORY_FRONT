import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TopWithdrawer } from '@/domain/models';
import { useServices } from '@/services/container';

/** "Quién más retira": se muestra siempre en la cabecera y se refresca tras cada movimiento. */
export const useStatsStore = defineStore('stats', () => {
  const { movements } = useServices();
  const topWithdrawer = ref<TopWithdrawer | null>(null);
  const loaded = ref(false);

  async function refresh(): Promise<void> {
    try {
      const [first] = await movements.topWithdrawers('all', 1);
      topWithdrawer.value = first ?? null;
    } catch {
      // Indicador secundario: si falla, se conserva el último valor.
    } finally {
      loaded.value = true;
    }
  }

  return { topWithdrawer, loaded, refresh };
});
