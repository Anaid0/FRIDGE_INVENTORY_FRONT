<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { TopWithdrawer } from '@/domain/models';
import { formatNumber, fullName } from '@/utils/format';

/** Cabecera de la tablet: quién más retira (siempre visible) y la hora. */
defineProps<{ top: TopWithdrawer | null }>();

const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 10_000)));
onBeforeUnmount(() => clearInterval(timer));

const time = computed(() =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(now.value),
);
/** "Lunes 19 de octubre". */
const date = computed(() => {
  const text = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(now.value)
    .replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
});
</script>

<template>
  <header class="flex min-h-14 items-center justify-between gap-4">
    <div
      class="glass flex min-h-14 max-w-full min-w-0 items-center gap-3 rounded-full py-1.5 pr-5 pl-2"
      aria-live="polite"
    >
      <span class="grid size-[42px] shrink-0 place-items-center rounded-full bg-[#ffe2c4]" aria-hidden="true">
        <!-- Cabeza del mono (de la ilustración "Más hambriento") -->
        <svg viewBox="0 18 200 164" class="size-8">
          <circle cx="28" cy="100" r="24" fill="#0b79c3" />
          <circle cx="172" cy="100" r="24" fill="#0b79c3" />
          <circle cx="100" cy="100" r="74" fill="#0b79c3" />
          <circle cx="78" cy="90" r="28" fill="#fff" />
          <circle cx="122" cy="90" r="28" fill="#fff" />
          <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
          <circle cx="80" cy="90" r="11" fill="#073b5e" />
          <circle cx="120" cy="90" r="11" fill="#073b5e" />
          <ellipse cx="100" cy="136" rx="18" ry="14" fill="#073b5e" />
        </svg>
      </span>
      <span class="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-3">
        <span class="shrink-0 text-sm text-ink-500 sm:text-[15px]">Quien más retira</span>
        <span v-if="top" class="flex min-w-0 items-baseline gap-2">
          <span class="truncate text-lg font-black text-ink-900">{{ fullName(top.user) }}</span>
          <span class="shrink-0 text-[15px] font-extrabold text-accent-700 tabular-nums">
            {{ formatNumber(top.totalWithdrawn) }} und.
          </span>
        </span>
        <span v-else class="text-lg font-black text-ink-500">Aún nadie</span>
      </span>
    </div>

    <div class="hidden shrink-0 flex-col items-end sm:flex">
      <time
        class="text-[22px] leading-tight font-black text-ink-900 tabular-nums"
        :datetime="now.toISOString()"
      >
        {{ time }}
      </time>
      <span class="text-sm text-ink-500">{{ date }}</span>
    </div>
  </header>
</template>
