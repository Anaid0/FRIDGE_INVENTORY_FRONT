<script setup lang="ts">
/**
 * Contenido de un botón que envía algo (mockup "Enviando"): con `busy` muestra un círculo que gira y
 * `busyLabel` ("Guardando…"). El botón que lo usa debe quedar `disabled` mientras tanto, así no se envía dos
 * veces, y llevar `:aria-busy="saving"`:
 *
 *   <button type="submit" class="btn-primary" :disabled="saving" :aria-busy="saving">
 *     <SpinnerLabel :busy="saving" label="Guardar" />
 *   </button>
 */
withDefaults(defineProps<{ busy?: boolean; label?: string; busyLabel?: string; size?: number }>(), {
  busy: false,
  label: '',
  busyLabel: 'Guardando…',
  size: 18,
});
</script>

<template>
  <span class="inline-flex items-center justify-center gap-2">
    <svg
      v-if="busy"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      aria-hidden="true"
      class="shrink-0 animate-spin motion-reduce:animate-none"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
    <slot v-else name="icon" />
    <span v-if="busy">{{ busyLabel }}</span>
    <span v-else
      ><slot>{{ label }}</slot></span
    >
  </span>
</template>
