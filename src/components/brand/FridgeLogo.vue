<script setup lang="ts">
/**
 * Ícono de FridgeYA: el mono de MonkeyJobs asomándose sobre la nevera (design-assets/, "Logo").
 * - `full`: con todos los detalles (pantallas grandes, ≥ 96px).
 * - `small`: trazos más gruesos para tamaños medianos (32–96px).
 * - `mini`: simplificado para tamaños chicos (< 32px).
 * Decorativo por defecto (va junto al nombre de la app); con `label` se anuncia como imagen.
 */
withDefaults(defineProps<{ variant?: 'full' | 'small' | 'mini'; label?: string }>(), {
  variant: 'small',
  label: undefined,
});
</script>

<template>
  <svg
    viewBox="0 0 400 400"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <rect width="400" height="400" rx="92" fill="#0b79c3" />
    <g transform="translate(168,6) scale(0.62)">
      <circle cx="28" cy="100" r="31" fill="#ffffff" />
      <circle cx="172" cy="100" r="31" fill="#ffffff" />
      <circle cx="100" cy="100" r="81" fill="#ffffff" />
      <circle cx="28" cy="100" r="24" fill="#0b79c3" />
      <circle cx="172" cy="100" r="24" fill="#0b79c3" />
      <template v-if="variant !== 'mini'">
        <circle cx="28" cy="100" r="11" fill="#ffffff" />
        <circle cx="172" cy="100" r="11" fill="#ffffff" />
      </template>
      <circle cx="100" cy="100" r="74" fill="#0b79c3" />
      <circle cx="78" cy="90" r="28" fill="#ffffff" />
      <circle cx="122" cy="90" r="28" fill="#ffffff" />
      <ellipse cx="100" cy="128" rx="40" ry="32" fill="#ffffff" />
      <circle cx="80" cy="90" :r="variant === 'mini' ? 10 : 9" fill="#073b5e" />
      <circle cx="120" cy="90" :r="variant === 'mini' ? 10 : 9" fill="#073b5e" />
      <template v-if="variant === 'full'">
        <circle cx="83" cy="87" r="3" fill="#ffffff" />
        <circle cx="123" cy="87" r="3" fill="#ffffff" />
        <circle cx="94" cy="114" r="3" fill="#0b79c3" />
        <circle cx="106" cy="114" r="3" fill="#0b79c3" />
      </template>
      <path
        v-if="variant !== 'mini'"
        d="M84 130 Q100 146 116 130"
        stroke="#0b79c3"
        :stroke-width="variant === 'full' ? 5 : 6"
        fill="none"
        stroke-linecap="round"
      />
    </g>
    <rect x="96" y="96" width="208" height="262" rx="30" fill="#ffffff" />
    <line
      x1="96"
      y1="178"
      x2="304"
      y2="178"
      stroke="#0b79c3"
      :stroke-width="variant === 'full' ? 8 : variant === 'small' ? 10 : 12"
    />
    <template v-if="variant !== 'mini'">
      <rect
        x="118"
        y="118"
        :width="variant === 'full' ? 12 : 14"
        height="40"
        :rx="variant === 'full' ? 6 : 7"
        fill="#0b79c3"
      />
      <rect
        x="118"
        y="198"
        :width="variant === 'full' ? 12 : 14"
        height="72"
        :rx="variant === 'full' ? 6 : 7"
        fill="#0b79c3"
      />
      <circle cx="190" cy="98" r="15" fill="#0b79c3" stroke="#ffffff" stroke-width="6" />
      <circle cx="276" cy="98" r="15" fill="#0b79c3" stroke="#ffffff" stroke-width="6" />
    </template>
    <circle cx="292" cy="330" r="40" fill="#ff8a1f" stroke="#0b79c3" stroke-width="8" />
    <path
      v-if="variant !== 'mini'"
      d="M273 331 L286 344 L310 318"
      stroke="#ffffff"
      :stroke-width="variant === 'full' ? 10 : 12"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
