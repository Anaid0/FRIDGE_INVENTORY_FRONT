<script setup lang="ts">
import { computed } from 'vue';
import type { TopWithdrawer } from '@/domain/models';
import { formatNumber, fullName } from '@/utils/format';

/**
 * Tarjeta marina del ranking (mockup Ranking): el mono con corona, una etiqueta en mayúsculas (`title`),
 * el nombre del primer lugar (varias personas si empatan) y sus unidades en naranja. `unitsLabel` completa
 * esa línea ("esta quincena"); `caption`, una línea gris clara debajo (fechas). El slot va al pie de la
 * tarjeta: el botón de calcular y su explicación.
 */
const props = withDefaults(
  defineProps<{
    leaders: TopWithdrawer[];
    caption: string;
    title?: string;
    size?: 'md' | 'lg';
    unitsLabel?: string;
    emptyLabel?: string;
  }>(),
  { title: 'Más hambriento', size: 'md', unitsLabel: '', emptyLabel: 'Nadie sacó nada' },
);

const names = computed(() => {
  const list = props.leaders.map((l) => fullName(l.user));
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}` : (list[0] ?? '');
});
const first = computed(() => props.leaders[0] ?? null);
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-[20px] bg-[linear-gradient(160deg,rgb(10_74_117/0.96),rgb(6_48_77/0.96))] p-3.5 text-white shadow-[0_12px_28px_rgb(7_59_94/0.25)] sm:p-4"
  >
    <div class="flex items-center gap-3">
      <!-- Mono con corona (feliz, boca abierta) -->
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        class="shrink-0"
        :class="size === 'lg' ? 'size-16 sm:size-20' : 'size-16'"
      >
        <circle cx="100" cy="106" r="94" fill="rgba(255,255,255,0.10)" />
        <g transform="translate(10,24) scale(0.9)">
          <circle cx="28" cy="100" r="24" fill="#0b79c3" />
          <circle cx="172" cy="100" r="24" fill="#0b79c3" />
          <circle cx="28" cy="100" r="11" fill="#ffffff" />
          <circle cx="172" cy="100" r="11" fill="#ffffff" />
          <circle cx="100" cy="100" r="74" fill="#0b79c3" />
          <circle cx="78" cy="90" r="28" fill="#ffffff" />
          <circle cx="122" cy="90" r="28" fill="#ffffff" />
          <ellipse cx="100" cy="128" rx="40" ry="32" fill="#ffffff" />
          <circle cx="80" cy="88" r="12" fill="#073b5e" />
          <circle cx="120" cy="88" r="12" fill="#073b5e" />
          <circle cx="84" cy="84" r="4" fill="#ffffff" />
          <circle cx="124" cy="84" r="4" fill="#ffffff" />
          <ellipse cx="100" cy="136" rx="20" ry="16" fill="#073b5e" />
          <ellipse cx="100" cy="144" rx="11" ry="7" fill="#ff7a8a" />
        </g>
        <path
          d="M68 42 L68 16 L84 30 L100 8 L116 30 L132 16 L132 42 Z"
          fill="#ffc93c"
          stroke="#d9a21b"
          stroke-width="4"
          stroke-linejoin="round"
        />
      </svg>
      <div class="flex min-w-0 flex-1 flex-col gap-px">
        <p class="text-[11px] font-extrabold tracking-[0.08em] text-[#9FD3F5] uppercase">{{ title }}</p>
        <template v-if="first">
          <p
            class="font-display leading-tight font-black break-words"
            :class="size === 'lg' ? 'text-[21px] sm:text-2xl' : 'text-xl'"
          >
            {{ names }}
          </p>
          <p class="text-[13px] font-extrabold text-[#FFB46B]">
            <span v-if="leaders.length > 1">Empate · </span
            ><span class="font-mono">{{ formatNumber(first.totalWithdrawn) }}</span>
            {{ first.totalWithdrawn === 1 ? 'unidad' : 'unidades' }}
            <template v-if="leaders.length > 1">cada uno</template>
            {{ unitsLabel }}
          </p>
        </template>
        <p v-else class="font-display text-lg font-black text-white/80">{{ emptyLabel }}</p>
        <p v-if="caption" class="text-xs text-[#CFE3F1]">{{ caption }}</p>
      </div>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <slot />
    </div>
  </div>
</template>
