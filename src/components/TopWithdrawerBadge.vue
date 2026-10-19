<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useStatsStore } from '@/stores/stats';
import { formatNumber, fullName } from '@/utils/format';
import Icon from './ui/Icon.vue';

const stats = useStatsStore();
</script>

<template>
  <RouterLink
    to="/admin/ranking"
    class="inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand-200 bg-brand-50 py-1 pr-4 pl-1.5 text-sm hover:border-brand-300"
    :aria-label="
      stats.topWithdrawer
        ? `Quien más retira: ${fullName(stats.topWithdrawer.user)}, ${stats.topWithdrawer.totalWithdrawn} unidades`
        : 'Aún no hay retiros'
    "
  >
    <span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
      <Icon name="trophy" :size="15" />
    </span>
    <span v-if="stats.topWithdrawer" class="flex min-w-0 items-baseline gap-1.5 truncate">
      <span class="hidden text-ink-500 sm:inline">Quien más retira:</span>
      <strong class="truncate font-semibold text-ink-900">{{ fullName(stats.topWithdrawer.user) }}</strong>
      <span class="shrink-0 text-ink-500 tabular-nums"
        >· {{ formatNumber(stats.topWithdrawer.totalWithdrawn) }} und.</span
      >
    </span>
    <span v-else-if="stats.loaded" class="text-ink-500">Aún no hay retiros</span>
    <span v-else class="h-4 w-40 animate-pulse rounded bg-brand-100" />
  </RouterLink>
</template>
