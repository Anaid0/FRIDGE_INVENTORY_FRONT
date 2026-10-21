<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';

/**
 * Encabezado de página de los mockups móviles: botón redondo para volver (opcional), título (Nunito 900,
 * 21px), una línea de contexto debajo y acciones a la derecha.
 * `back`: a dónde vuelve; con `true`, a la pantalla anterior.
 */
const props = defineProps<{ title: string; subtitle?: string; back?: RouteLocationRaw | true }>();
const router = useRouter();

function goBack() {
  if (props.back === true) router.back();
  else if (props.back) void router.push(props.back);
}
</script>

<template>
  <div class="mb-3.5 flex items-start gap-2.5">
    <button
      v-if="back"
      type="button"
      class="glass grid size-10 shrink-0 place-items-center rounded-full text-ink-900"
      aria-label="Volver"
      @click="goBack"
    >
      <Icon name="chevronLeft" :size="20" :stroke="2.4" />
    </button>
    <div class="min-w-0 flex-1" :class="{ 'pt-0.5': back }">
      <slot name="eyebrow" />
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="page-title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="subtitle || $slots.subtitle" class="mt-0.5 text-[12.5px] text-ink-500">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
