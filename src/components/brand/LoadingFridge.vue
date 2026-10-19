<script setup lang="ts">
/**
 * "Cargando…" de design-assets/: el mono se asoma sobre la nevera mientras gira el anillo de puntos.
 * Misma animación del diseño (giro de 1,4 s y asomo); se detiene si el sistema pide reducir el movimiento.
 */
withDefaults(defineProps<{ title?: string; subtitle?: string }>(), {
  title: 'Cargando…',
  subtitle: 'Revisando qué hay en la nevera',
});
</script>

<template>
  <div class="flex flex-col items-center text-center" role="status" aria-live="polite">
    <svg viewBox="0 0 520 440" class="w-full max-w-[16rem]" aria-hidden="true">
      <g class="fy-spin">
        <circle cx="450" cy="215" r="14" fill="#0b79c3" />
        <circle cx="394.4" cy="349.4" r="13" fill="#0b79c3" opacity="0.85" />
        <circle cx="260" cy="405" r="12" fill="#0b79c3" opacity="0.7" />
        <circle cx="125.6" cy="349.4" r="11" fill="#0b79c3" opacity="0.55" />
        <circle cx="70" cy="215" r="10" fill="#0b79c3" opacity="0.45" />
        <circle cx="125.6" cy="80.6" r="9" fill="#0b79c3" opacity="0.35" />
        <circle cx="260" cy="25" r="8" fill="#0b79c3" opacity="0.25" />
        <circle cx="394.4" cy="80.6" r="7" fill="#0b79c3" opacity="0.2" />
      </g>
      <g class="fy-peek">
        <g transform="translate(210,54) scale(0.5)">
          <circle cx="28" cy="100" r="24" fill="#0b79c3" />
          <circle cx="172" cy="100" r="24" fill="#0b79c3" />
          <circle cx="28" cy="100" r="11" fill="#ffffff" />
          <circle cx="172" cy="100" r="11" fill="#ffffff" />
          <circle cx="100" cy="100" r="74" fill="#0b79c3" />
          <circle cx="78" cy="90" r="28" fill="#ffffff" />
          <circle cx="122" cy="90" r="28" fill="#ffffff" />
          <ellipse cx="100" cy="128" rx="40" ry="32" fill="#ffffff" />
          <circle cx="84" cy="84" r="10" fill="#073b5e" />
          <circle cx="124" cy="84" r="10" fill="#073b5e" />
          <circle cx="87" cy="81" r="3" fill="#ffffff" />
          <circle cx="127" cy="81" r="3" fill="#ffffff" />
          <circle cx="94" cy="114" r="3" fill="#0b79c3" />
          <circle cx="106" cy="114" r="3" fill="#0b79c3" />
        </g>
      </g>
      <rect
        x="185"
        y="120"
        width="150"
        height="250"
        rx="24"
        fill="#ffffff"
        stroke="#0b79c3"
        stroke-width="8"
      />
      <line x1="185" y1="200" x2="335" y2="200" stroke="#0b79c3" stroke-width="8" />
      <rect x="202" y="140" width="10" height="38" rx="5" fill="#0b79c3" />
      <rect x="202" y="220" width="10" height="64" rx="5" fill="#0b79c3" />
      <circle cx="224" cy="120" r="12" fill="#0b79c3" />
      <circle cx="296" cy="120" r="12" fill="#0b79c3" />
      <rect x="232" y="320" width="56" height="12" rx="6" fill="#cfe8f7" />
      <rect x="232" y="320" width="30" height="12" rx="6" fill="#ff8a1f" />
    </svg>
    <p class="mt-2 font-display text-2xl font-black text-brand-900">{{ title }}</p>
    <p v-if="subtitle" class="mt-1 font-display font-bold text-ink-600">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
@keyframes fy-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes fy-peek {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
.fy-spin {
  transform-box: view-box;
  transform-origin: 260px 215px;
  animation: fy-spin 1.4s linear infinite;
}
.fy-peek {
  animation: fy-peek 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .fy-spin,
  .fy-peek {
    animation: none;
  }
}
</style>
