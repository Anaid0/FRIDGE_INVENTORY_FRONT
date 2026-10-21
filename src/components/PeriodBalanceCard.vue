<script setup lang="ts">
import { computed } from 'vue';
import type { PeriodSummary } from '@/domain/models';
import { formatPeriodRange, remainingLabel } from '@/utils/dates';
import { formatMoney } from '@/utils/format';
import PeriodStatusBadge from './PeriodStatusBadge.vue';
import Icon from './ui/Icon.vue';

/**
 * Tarjeta azul marino del dinero de una quincena (mockup Quincena): saldo disponible en grande, cuánto
 * se gastó de lo recaudado (barra naranja) y dos recuadros con lo recaudado y lo gastado. Avisa si se
 * gastó de más.
 * `withTitle`: muestra también el nombre, las fechas y el estado (lista de quincenas). Sin él es la región
 * "Dinero de la quincena" del detalle, que ya tiene su propio encabezado.
 */
const props = withDefaults(
  defineProps<{ summary: PeriodSummary; collectedHint?: string; spentHint?: string; withTitle?: boolean }>(),
  { collectedHint: undefined, spentHint: undefined, withTitle: false },
);

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
  <component
    :is="withTitle ? 'div' : 'section'"
    :aria-label="withTitle ? undefined : 'Dinero de la quincena'"
    class="hero flex flex-col gap-2.5 rounded-[20px] p-3 text-white lg:gap-3.5 lg:p-5"
  >
    <div v-if="withTitle" class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-display text-[17px] leading-tight font-black">{{ summary.name }}</p>
        <p class="mt-0.5 text-[11px] text-brand-200">{{ dates }}</p>
      </div>
      <PeriodStatusBadge :status="summary.status" :class="{ 'bg-white/90!': summary.status !== 'OPEN' }" />
    </div>

    <div class="flex items-end justify-between gap-2">
      <span class="flex min-w-0 flex-col">
        <span class="text-[11px] text-brand-200 lg:text-[13px]">Saldo disponible</span>
        <span
          class="num text-[28px] leading-[1.1] break-all lg:text-[36px]"
          :class="{ 'text-[#FFB4A8]': summary.isOverspent }"
          >{{ formatMoney(summary.balance) }}</span
        >
      </span>
      <span class="shrink-0 text-right text-[11px] text-[#9FD3F5] lg:text-[13px]"
        >{{ spentPercent }} % gastado</span
      >
    </div>
    <div
      class="h-1.5 overflow-hidden rounded-full bg-white/16"
      role="progressbar"
      aria-label="Gastado de lo recaudado"
      :aria-valuenow="Math.min(spentPercent, 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full rounded-full"
        :class="summary.isOverspent ? 'bg-[#FF6B5B]' : 'bg-accent-500'"
        :style="{ width: `${Math.min(spentPercent, 100)}%` }"
      />
    </div>

    <dl class="grid grid-cols-2 gap-2">
      <div class="flex min-w-0 flex-col rounded-xl bg-white/10 px-2.5 py-2">
        <dt class="truncate text-[10px] text-brand-200 lg:text-xs">
          Recaudado<template v-if="collectedHint"> · {{ collectedHint }}</template>
        </dt>
        <dd class="num truncate text-[15px] lg:text-lg">{{ formatMoney(summary.collected) }}</dd>
      </div>
      <div class="flex min-w-0 flex-col rounded-xl bg-white/10 px-2.5 py-2">
        <dt class="truncate text-[10px] text-brand-200 lg:text-xs">
          Gastado<template v-if="spentHint"> · {{ spentHint }}</template>
        </dt>
        <dd class="num truncate text-[15px] lg:text-lg">{{ formatMoney(summary.spent) }}</dd>
      </div>
    </dl>
    <p
      v-if="summary.isOverspent"
      class="flex items-center gap-2 rounded-xl bg-[#B42318]/45 px-2.5 py-2 text-xs font-bold"
      role="alert"
    >
      <Icon name="alert" :size="14" /> Se gastó más de lo recaudado en esta quincena.
    </p>
  </component>
</template>

<style scoped>
.hero {
  background: linear-gradient(160deg, rgb(10 74 117 / 0.95), rgb(6 48 77 / 0.95));
  box-shadow: 0 12px 28px rgb(7 59 94 / 0.25);
}
</style>
