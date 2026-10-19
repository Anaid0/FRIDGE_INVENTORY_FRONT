<script setup lang="ts">
import { computed } from 'vue';
import type { TopWithdrawer } from '@/domain/models';
import { formatNumber, fullName } from '@/utils/format';
import HungriestMonkey from './HungriestMonkey.vue';

/** El primer lugar con la ilustración "Más hambriento" (varias personas si empatan). */
const props = withDefaults(
  defineProps<{ leaders: TopWithdrawer[]; caption: string; title?: string; size?: 'md' | 'lg' }>(),
  { title: 'Más hambriento', size: 'md' },
);

const names = computed(() => {
  const list = props.leaders.map((l) => fullName(l.user));
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}` : (list[0] ?? '');
});
const first = computed(() => props.leaders[0] ?? null);
</script>

<template>
  <div class="flex items-center gap-4 rounded-3xl bg-accent-50/80 p-3 pr-5 ring-1 ring-accent-100 sm:gap-6">
    <HungriestMonkey decorative class="shrink-0" :class="size === 'lg' ? 'w-28 sm:w-44' : 'w-28 sm:w-40'" />
    <div class="min-w-0">
      <p class="font-display text-sm font-extrabold tracking-wide text-accent-700 uppercase">
        {{ title }}
      </p>
      <template v-if="first">
        <p class="font-display text-2xl font-black text-ink-900 sm:text-3xl">
          {{ names }}
        </p>
        <p class="mt-0.5 text-ink-600">
          <span v-if="leaders.length > 1">Empate · </span>Sacó
          <strong class="text-ink-900 tabular-nums">{{ formatNumber(first.totalWithdrawn) }} und.</strong>
          <span v-if="leaders.length > 1"> cada uno</span>
        </p>
        <p class="text-sm text-ink-500">{{ caption }}</p>
      </template>
      <template v-else>
        <p class="font-display text-xl font-bold text-ink-600">Nadie sacó nada</p>
        <p class="text-sm text-ink-500">{{ caption }}</p>
      </template>
    </div>
  </div>
</template>
