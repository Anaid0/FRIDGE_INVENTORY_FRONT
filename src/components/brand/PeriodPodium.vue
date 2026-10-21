<script setup lang="ts">
import { computed } from 'vue';
import type { PeriodRankingEntry } from '@/domain/models';
import { formatNumber, fullName } from '@/utils/format';
import RankingPodium from './RankingPodium.vue';

/**
 * El podio de la ilustración "Ranking" con los nombres de los tres primeros debajo de cada escalón.
 * Los escalones siguen el orden de la lista (2.º a la izquierda, 1.º al centro, 3.º a la derecha);
 * si hay empate, el puesto real se indica bajo el nombre.
 */
const props = defineProps<{ podium: PeriodRankingEntry[] }>();

// En el DOM van 1.º, 2.º, 3.º (orden de lectura); en pantalla, con `order`, quedan 2.º · 1.º · 3.º.
const steps = computed(() =>
  [0, 1, 2].map((index) => ({ step: index + 1, entry: props.podium[index] ?? null })),
);
</script>

<template>
  <figure class="m-0">
    <RankingPodium decorative class="w-full" />
    <!-- Columnas alineadas con los escalones del dibujo (x 70–460 de 520). -->
    <ol
      class="mr-[11.5%] ml-[13.5%] grid list-none grid-cols-3 p-0 gap-1 text-center"
      aria-label="Podio de la quincena"
    >
      <li
        v-for="{ step, entry } in steps"
        :key="step"
        :style="{ order: step === 1 ? 2 : step === 2 ? 1 : 3 }"
        class="min-w-0"
      >
        <template v-if="entry">
          <p class="sr-only">Puesto {{ entry.position }}:</p>
          <p
            class="truncate font-display font-black text-ink-900"
            :class="step === 1 ? 'text-base sm:text-xl' : 'text-sm sm:text-base'"
            :title="fullName(entry.user)"
          >
            {{ entry.user.name }}
          </p>
          <p class="font-mono text-xs font-bold text-ink-500 tabular-nums sm:text-sm">
            {{ formatNumber(entry.totalWithdrawn) }} und.<span v-if="entry.position !== step">
              · puesto {{ entry.position }}</span
            >
          </p>
        </template>
        <p v-else class="text-sm font-bold text-ink-400">—</p>
      </li>
    </ol>
  </figure>
</template>
