<script setup lang="ts">
import type { PeriodSummary } from '@/domain/models';
import { formatDateOnly, formatMoney } from '@/utils/format';
import PeriodStatusBadge from './PeriodStatusBadge.vue';
import Icon from './ui/Icon.vue';

/** Recaudado, gastado y saldo de una quincena (con alerta si se gastó de más). */
defineProps<{ summary: PeriodSummary; compact?: boolean }>();
</script>

<template>
  <div class="card p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="font-semibold text-ink-900">{{ summary.name }}</p>
        <p class="text-xs text-ink-500">
          {{ formatDateOnly(summary.startDate) }} – {{ formatDateOnly(summary.endDate) }}
        </p>
      </div>
      <PeriodStatusBadge :status="summary.status" />
    </div>
    <dl class="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3">
      <div>
        <dt class="text-xs text-ink-500">Recaudado</dt>
        <dd
          class="mt-0.5 font-semibold whitespace-nowrap text-ink-900 tabular-nums"
          :class="compact ? 'text-base' : 'text-xl'"
        >
          {{ formatMoney(summary.collected) }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-ink-500">Gastado</dt>
        <dd
          class="mt-0.5 font-semibold whitespace-nowrap text-ink-900 tabular-nums"
          :class="compact ? 'text-base' : 'text-xl'"
        >
          {{ formatMoney(summary.spent) }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-ink-500">Saldo</dt>
        <dd
          class="mt-0.5 font-semibold whitespace-nowrap tabular-nums"
          :class="[
            compact ? 'text-base' : 'text-xl',
            summary.isOverspent ? 'text-danger-700' : 'text-brand-800',
          ]"
        >
          {{ formatMoney(summary.balance) }}
        </dd>
      </div>
    </dl>
    <p
      v-if="summary.isOverspent"
      class="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700"
      role="alert"
    >
      <Icon name="alert" :size="14" /> Se gastó más de lo recaudado en esta quincena.
    </p>
  </div>
</template>
