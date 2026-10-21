<script setup lang="ts">
import type { PeriodRanking } from '@/domain/models';
import { formatDateOnly, formatDateTime } from '@/utils/format';
import HungriestCard from './HungriestCard.vue';
import PeriodPodium from './PeriodPodium.vue';

/**
 * Resultado calculado de una quincena: la tarjeta marina del más hambriento (con quién lo calculó y el slot
 * `actions` al pie, p. ej. "Volver a calcular") y el podio en una tarjeta de vidrio.
 */
defineProps<{ ranking: PeriodRanking; showMeta?: boolean }>();
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <HungriestCard
      size="lg"
      title="Más hambriento de la quincena"
      :leaders="ranking.hungriest"
      :caption="`${formatDateOnly(ranking.period.startDate)} – ${formatDateOnly(ranking.period.endDate)}`"
    >
      <slot name="actions" />
      <p v-if="showMeta" class="text-xs leading-snug text-[#CFE3F1]">
        Calculado el {{ formatDateTime(ranking.computedAt) }}
        {{
          ranking.computedBy.kind === 'kiosk'
            ? `desde la tablet «${ranking.computedBy.name}»`
            : `por ${ranking.computedBy.name}`
        }}
      </p>
    </HungriestCard>
    <div v-if="ranking.podium.length" class="card px-4 pt-3 pb-4">
      <h3 class="section-title">Podio · {{ ranking.period.name }}</h3>
      <PeriodPodium :podium="ranking.podium" class="mx-auto mt-1 w-full max-w-sm" />
    </div>
  </div>
</template>
