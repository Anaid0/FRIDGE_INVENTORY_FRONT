<script setup lang="ts">
import { computed } from 'vue';
import { initials as initialsOf } from '@/utils/format';

/**
 * Iniciales de una persona sobre un tono suave (azul, naranja, verde, violeta o rosa), como en los mockups.
 * El tono sale del id: la misma persona siempre tiene el mismo color.
 * `solid`: azul de la marca con letras blancas (el primer puesto del ranking, el administrador en Más).
 */
const props = withDefaults(
  defineProps<{
    person: { id: string; name: string; lastname: string };
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    locked?: boolean;
    solid?: boolean;
  }>(),
  { size: 'md', locked: false, solid: false },
);

const TONES = [
  'bg-brand-100 text-brand-700',
  'bg-accent-100 text-accent-700',
  'bg-success-50 text-success-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
];

const tone = computed(() => {
  if (props.locked) return 'bg-ink-200 text-ink-500';
  if (props.solid) return 'bg-brand-600 text-white';
  let hash = 0;
  for (const char of props.person.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
});
const SIZES = {
  xs: 'size-[34px] text-xs',
  sm: 'size-9 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-[76px] text-3xl',
  xl: 'size-[120px] text-5xl',
};
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-full font-display font-black"
    :class="[SIZES[size], tone]"
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
