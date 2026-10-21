<script setup lang="ts">
/**
 * Filas "esqueleto" mientras carga una lista (mockup AdminEstados → Cargando): cuadro del ícono, dos líneas
 * de texto y la cifra a la derecha, con un brillo que pasa (se detiene si el sistema pide menos movimiento).
 * `bare`: sin la tarjeta de vidrio, para meterlas dentro de una tarjeta que ya existe.
 */
withDefaults(defineProps<{ rows?: number; label?: string; bare?: boolean; round?: boolean }>(), {
  rows: 3,
  label: 'Cargando…',
  bare: false,
  round: false,
});

// Anchos que varían un poco entre filas para que no parezca una cuadrícula.
const WIDTHS = [
  ['60%', '40%'],
  ['70%', '35%'],
  ['52%', '44%'],
  ['66%', '30%'],
] as const;
</script>

<template>
  <div
    class="flex flex-col gap-3"
    :class="bare ? 'py-1' : 'rounded-[18px] border border-white/90 bg-white/60 px-3 py-3'"
    role="status"
    aria-busy="true"
    :aria-label="label"
  >
    <div v-for="i in rows" :key="i" class="flex items-center gap-2.5" aria-hidden="true">
      <span class="fy-sk size-[26px] shrink-0" :class="round ? 'rounded-full' : 'rounded-lg'" />
      <span class="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span class="fy-sk h-2.5 rounded-[5px]" :style="{ width: WIDTHS[(i - 1) % WIDTHS.length]![0] }" />
        <span class="fy-sk h-2 rounded-[4px]" :style="{ width: WIDTHS[(i - 1) % WIDTHS.length]![1] }" />
      </span>
      <span class="fy-sk h-2.5 w-6 shrink-0 rounded-[5px]" />
    </div>
  </div>
</template>

<style scoped>
.fy-sk {
  display: block;
  background: linear-gradient(
    90deg,
    rgb(7 59 94 / 0.06) 0%,
    rgb(7 59 94 / 0.13) 50%,
    rgb(7 59 94 / 0.06) 100%
  );
  background-size: 400px 100%;
  animation: fy-shim 1.4s linear infinite;
}
@keyframes fy-shim {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fy-sk {
    animation: none;
  }
}
</style>
