<script setup lang="ts">
/**
 * Etiqueta + control + error/ayuda. El slot recibe el id para enlazar label e input.
 * El error va en rojo con un círculo "!" (mockups); la ayuda, en gris debajo.
 */
defineProps<{ id: string; label: string; error?: string; hint?: string; optional?: boolean }>();
</script>

<template>
  <div>
    <label :for="id" class="label">
      {{ label }}
      <span v-if="optional" class="font-semibold text-ink-500">(opcional)</span>
    </label>
    <slot :id="id" :invalid="Boolean(error)" />
    <p
      v-if="error"
      :id="`${id}-error`"
      class="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-danger-700"
    >
      <span
        class="mt-px grid size-3.5 shrink-0 place-items-center rounded-full bg-danger-700 text-[10px] leading-none font-black text-white"
        aria-hidden="true"
        >!</span
      >
      <span>{{ error }}</span>
    </p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
