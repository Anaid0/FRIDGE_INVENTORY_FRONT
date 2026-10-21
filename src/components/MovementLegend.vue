<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import Icon from './ui/Icon.vue';

/**
 * Botón redondo "?" que abre una pequeña nota de vidrio con qué significa cada flecha de los movimientos
 * (rojo ↑ retiro, verde ↓ ingreso). Se cierra al tocar fuera, con Escape o tocando el botón otra vez.
 * `align`: hacia qué lado se abre la nota (derecha si el botón va al final del encabezado).
 */
withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'left' });

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const tipId = `legend-${useId()}`;

function onDocumentClick(event: Event) {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false;
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return;
  open.value = false;
  button.value?.focus();
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <span ref="root" class="relative inline-flex">
    <button
      ref="button"
      type="button"
      class="glass grid size-8 place-items-center rounded-full font-display text-[14px] font-black text-ink-700 hover:text-ink-900"
      aria-label="Qué significan las flechas"
      :aria-expanded="open"
      :aria-controls="tipId"
      :aria-describedby="open ? tipId : undefined"
      @click="open = !open"
    >
      ?
    </button>
    <div
      v-if="open"
      :id="tipId"
      role="tooltip"
      class="glass-strong absolute top-full z-30 mt-1.5 flex w-60 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl p-3 text-left"
      :class="align === 'right' ? 'right-0' : 'left-0'"
    >
      <p class="flex items-start gap-2.5">
        <span
          class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-danger-50 text-danger-700"
          aria-hidden="true"
        >
          <Icon name="arrowUp" :size="14" :stroke="2.4" />
        </span>
        <span class="text-[12.5px] leading-snug text-ink-700">
          <strong class="font-extrabold text-ink-900">Retiro:</strong> alguien sacó de la nevera
        </span>
      </p>
      <p class="flex items-start gap-2.5">
        <span
          class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-success-50 text-success-700"
          aria-hidden="true"
        >
          <Icon name="arrowDown" :size="14" :stroke="2.4" />
        </span>
        <span class="text-[12.5px] leading-snug text-ink-700">
          <strong class="font-extrabold text-ink-900">Ingreso:</strong> entró a la nevera (compra o ingreso
          del administrador)
        </span>
      </p>
    </div>
  </span>
</template>
