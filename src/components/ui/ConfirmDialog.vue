<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';
import SpinnerLabel from './SpinnerLabel.vue';

/**
 * Confirmación de una acción sensible (mockup AdminEstados): tarjeta blanca centrada con la pregunta
 * ("¿Anular la compra del 19 oct?"), qué va a pasar y dos botones del mismo ancho: "Cancelar" (blanco) y
 * la acción. Con `danger` la acción va en rojo (#B42318). Mientras `loading`, la acción muestra un círculo
 * girando y los dos botones quedan deshabilitados.
 */
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loadingLabel?: string;
    danger?: boolean;
    loading?: boolean;
  }>(),
  {
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    loadingLabel: 'Procesando…',
    danger: false,
    loading: false,
  },
);
const emit = defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
  <BaseDialog :open="open" :title="title" compact hide-close @close="emit('close')">
    <p class="text-[13px] text-ink-700">{{ message }}</p>
    <slot />
    <div class="mt-4 grid grid-cols-2 gap-2">
      <button
        type="button"
        class="min-h-[42px] rounded-xl border border-ink-300 bg-white px-3 text-sm font-extrabold text-ink-900 hover:bg-ink-50 disabled:opacity-60"
        :disabled="loading"
        @click="emit('close')"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        class="min-h-[42px] rounded-xl px-3 text-sm font-extrabold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-85"
        :class="danger ? 'bg-danger-700 hover:bg-[#981c13]' : 'bg-brand-600 hover:bg-brand-700'"
        :disabled="loading"
        :aria-busy="loading"
        @click="emit('confirm')"
      >
        <SpinnerLabel :busy="loading" :label="confirmLabel" :busy-label="loadingLabel" :size="16" />
      </button>
    </div>
  </BaseDialog>
</template>
