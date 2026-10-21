<script setup lang="ts">
/**
 * Aviso de "sin conexión" de los mockups (AdminEstados): franja marina con el ícono de wifi tachado en
 * naranja y un botón "Reintentar". Se muestra mientras la vista no logra hablar con el servidor.
 */
withDefaults(defineProps<{ message?: string; retrying?: boolean; retryLabel?: string }>(), {
  message: 'Sin conexión con el servidor · reintentando…',
  retrying: false,
  retryLabel: 'Reintentar',
});
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex min-h-11 items-center gap-2.5 rounded-xl bg-ink-900 py-1.5 pr-1.5 pl-3 text-[13px] text-white shadow-[0_8px_22px_-10px_rgb(7_59_94/0.6)]"
    role="alert"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFB46B"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"
      class="shrink-0"
    >
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18" />
    </svg>
    <span class="min-w-0 flex-1">{{ message }}</span>
    <button
      type="button"
      class="min-h-9 shrink-0 rounded-lg bg-white/15 px-3 text-xs font-extrabold text-white transition-colors hover:bg-white/25 disabled:opacity-60"
      :disabled="retrying"
      :aria-busy="retrying"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>
