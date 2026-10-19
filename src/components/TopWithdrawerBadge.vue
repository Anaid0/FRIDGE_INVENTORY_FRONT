<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useStatsStore } from '@/stores/stats';
import { formatNumber, fullName } from '@/utils/format';
import Icon from './ui/Icon.vue';

/** "Quien más retira" (requisito: siempre visible). `compact`: versión discreta sobre el contenido (escritorio). */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
const stats = useStatsStore();
</script>

<template>
  <RouterLink
    to="/admin/ranking"
    class="inline-flex max-w-full items-center gap-2 rounded-full glass py-1 pr-3.5 pl-1 hover:bg-white/90"
    :class="compact ? 'text-[13px]' : 'text-sm'"
    :aria-label="
      stats.topWithdrawer
        ? `Quien más retira: ${fullName(stats.topWithdrawer.user)}, ${stats.topWithdrawer.totalWithdrawn} unidades`
        : 'Aún no hay retiros'
    "
  >
    <span
      class="grid shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700"
      :class="compact ? 'size-6' : 'size-7'"
    >
      <Icon name="trophy" :size="compact ? 13 : 15" :stroke="2" />
    </span>
    <span v-if="stats.topWithdrawer" class="flex min-w-0 items-baseline gap-1.5 truncate">
      <span class="hidden text-ink-500 sm:inline">Quien más retira:</span>
      <strong class="truncate font-extrabold text-ink-900">{{ fullName(stats.topWithdrawer.user) }}</strong>
      <span class="shrink-0 text-ink-500 tabular-nums"
        >· {{ formatNumber(stats.topWithdrawer.totalWithdrawn) }} und.</span
      >
    </span>
    <span v-else-if="stats.loaded" class="text-ink-500">Aún no hay retiros</span>
    <span v-else class="h-4 w-40 animate-pulse rounded bg-brand-100" />
  </RouterLink>
</template>
