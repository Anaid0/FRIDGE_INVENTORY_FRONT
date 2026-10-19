<script setup lang="ts">
import { computed } from 'vue';
import { initials as initialsOf } from '@/utils/format';

/**
 * Iniciales de una persona sobre un tono suave (azul, naranja, verde, violeta o rosa), como en los mockups.
 * El tono sale del id: la misma persona siempre tiene el mismo color.
 */
const props = withDefaults(
  defineProps<{
    person: { id: string; name: string; lastname: string };
    size?: 'sm' | 'md' | 'lg' | 'xl';
    locked?: boolean;
  }>(),
  { size: 'md', locked: false },
);

const TONES = [
  'bg-brand-100 text-brand-600',
  'bg-accent-100 text-accent-700',
  'bg-success-50 text-success-800',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
];

const tone = computed(() => {
  let hash = 0;
  for (const char of props.person.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
});
const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-[76px] text-3xl',
  xl: 'size-[120px] text-5xl',
};
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-full font-black"
    :class="[SIZES[size], locked ? 'bg-ink-200 text-ink-500' : tone]"
    aria-hidden="true"
  >
    <svg
      v-if="locked"
      viewBox="0 0 24 24"
      class="size-[38%]"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
    <template v-else>{{ initialsOf(person) }}</template>
  </span>
</template>
