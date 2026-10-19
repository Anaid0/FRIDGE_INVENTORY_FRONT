<script setup lang="ts">
import { computed } from 'vue';
import type { PeriodSummary } from '@/domain/models';
import { formatPeriodRange, remainingLabel } from '@/utils/dates';
import { formatMoney } from '@/utils/format';
import PeriodStatusBadge from './PeriodStatusBadge.vue';
import Icon from './ui/Icon.vue';

/**
 * Tarjeta de una quincena (mockup del inicio): nombre, fechas y días que quedan, cuánto se gastó de lo
 * recaudado (barra) y recaudado / gastado / saldo. Avisa si se gastó de más.
 */
const props = defineProps<{ summary: PeriodSummary; compact?: boolean }>();

const spentPercent = computed(() => {
  const collected = Number(props.summary.collected);
  if (!collected) return Number(props.summary.spent) > 0 ? 100 : 0;
  return Math.round((Number(props.summary.spent) / collected) * 100);
});
const dates = computed(() => {
  const range = formatPeriodRange(props.summary.startDate, props.summary.endDate, true);
  return props.summary.status === 'OPEN' ? `${range} · ${remainingLabel(props.summary.endDate)}` : range;
});
</script>

<template>
  <div class="card flex flex-col gap-3.5 px-6 py-[22px]">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-[19px] leading-tight font-black text-ink-900">{{ summary.name }}</p>
        <p class="mt-0.5 text-[13px] text-ink-500">{{ dates }}</p>
      </div>
      <PeriodStatusBadge :status="summary.status" />
    </div>

    <div>
      <div class="mb-1.5 flex justify-between text-sm">
        <span class="text-ink-500">Gastado de lo recaudado</span>
        <span class="font-extrabold text-ink-900 tabular-nums">{{ spentPercent }} %</span>
      </div>
      <div
        class="h-2.5 overflow-hidden rounded-full bg-ink-200/70"
        role="progressbar"
        aria-label="Gastado de lo recaudado"
        :aria-valuenow="Math.min(spentPercent, 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full"
          :class="summary.isOverspent ? 'bg-danger-600' : 'bg-brand-600'"
          :style="{ width: `${Math.min(spentPercent, 100)}%` }"
        />
      </div>
    </div>

    <dl class="grid grid-cols-3 gap-2">
      <div class="min-w-0">
        <dt class="text-[13px] text-ink-500">Recaudado</dt>
        <dd
          class="font-extrabold whitespace-nowrap text-ink-900 tabular-nums"
          :class="compact ? 'text-[17px]' : 'text-xl'"
        >
          {{ formatMoney(summary.collected) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-[13px] text-ink-500">Gastado</dt>
        <dd
          class="font-extrabold whitespace-nowrap text-ink-900 tabular-nums"
          :class="compact ? 'text-[17px]' : 'text-xl'"
        >
          {{ formatMoney(summary.spent) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-[13px] text-ink-500">Saldo</dt>
        <dd
          class="font-extrabold whitespace-nowrap tabular-nums"
          :class="[
            compact ? 'text-[17px]' : 'text-xl',
            summary.isOverspent ? 'text-danger-700' : 'text-success-800',
          ]"
        >
          {{ formatMoney(summary.balance) }}
        </dd>
      </div>
    </dl>
    <p
      v-if="summary.isOverspent"
      class="flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700"
      role="alert"
    >
      <Icon name="alert" :size="14" /> Se gastó más de lo recaudado en esta quincena.
    </p>
  </div>
</template>
