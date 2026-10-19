<script setup lang="ts">
import type { PeriodRanking } from '@/domain/models';
import { formatDateOnly, formatDateTime } from '@/utils/format';
import HungriestCard from './HungriestCard.vue';
import PeriodPodium from './PeriodPodium.vue';

/** Resultado calculado de una quincena: el más hambriento y el podio. */
defineProps<{ ranking: PeriodRanking; showMeta?: boolean }>();
</script>

<template>
  <div class="grid grid-cols-1 items-center gap-6 xl:grid-cols-[1.2fr_1fr]">
    <div>
      <HungriestCard
        size="lg"
        title="Más hambriento de la quincena"
        :leaders="ranking.hungriest"
        :caption="`${formatDateOnly(ranking.period.startDate)} – ${formatDateOnly(ranking.period.endDate)}`"
      />
      <p v-if="showMeta" class="mt-3 text-xs text-ink-500">
        Calculado el {{ formatDateTime(ranking.computedAt) }}
        {{
          ranking.computedBy.kind === 'kiosk'
            ? `desde la tablet «${ranking.computedBy.name}»`
            : `por ${ranking.computedBy.name}`
        }}
      </p>
    </div>
    <PeriodPodium v-if="ranking.podium.length" :podium="ranking.podium" class="mx-auto w-full max-w-md" />
  </div>
</template>
