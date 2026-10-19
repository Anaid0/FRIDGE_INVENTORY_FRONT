<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
  }>(),
  { confirmLabel: 'Confirmar', danger: false, loading: false },
);
const emit = defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
  <BaseDialog :open="open" :title="title" @close="emit('close')">
    <p class="text-sm text-ink-600">{{ message }}</p>
    <slot />
    <div class="mt-6 flex justify-end gap-2">
      <button type="button" class="btn-secondary" :disabled="loading" @click="emit('close')">Cancelar</button>
      <button
        type="button"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        :disabled="loading"
        @click="emit('confirm')"
      >
        {{ loading ? 'Procesando…' : confirmLabel }}
      </button>
    </div>
  </BaseDialog>
</template>
