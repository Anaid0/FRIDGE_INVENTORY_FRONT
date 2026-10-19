<script setup lang="ts">
/** Etiqueta + control + error/ayuda. El slot recibe el id para enlazar label e input. */
defineProps<{ id: string; label: string; error?: string; hint?: string; optional?: boolean }>();
</script>

<template>
  <div>
    <label :for="id" class="label">
      {{ label }}
      <span v-if="optional" class="font-normal text-ink-400">(opcional)</span>
    </label>
    <slot :id="id" :invalid="Boolean(error)" />
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-danger-700">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
