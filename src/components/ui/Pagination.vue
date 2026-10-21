<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ page: number; pageSize: number; total: number }>();
const emit = defineEmits<{ change: [page: number] }>();

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1));
const to = computed(() => Math.min(props.page * props.pageSize, props.total));
</script>

<template>
  <!-- Pie de lista: "Mostrando 1–20 de 54" en mono y dos botones blancos con flecha. -->
  <nav
    class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-ink-500 sm:px-5"
    aria-label="Paginación"
  >
    <p>
      Mostrando <span class="num text-ink-900">{{ from }}–{{ to }}</span> de
      <span class="num text-ink-900">{{ total }}</span>
    </p>
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="btn-secondary min-h-11 px-3"
        :disabled="page <= 1"
        aria-label="Página anterior"
        @click="emit('change', page - 1)"
      >
        <Icon name="chevronLeft" :size="16" :stroke="2.4" /> Anterior
      </button>
      <button
        type="button"
        class="btn-secondary min-h-11 px-3"
        :disabled="page >= pages"
        aria-label="Página siguiente"
        @click="emit('change', page + 1)"
      >
        Siguiente <Icon name="chevronRight" :size="16" :stroke="2.4" />
      </button>
    </div>
  </nav>
</template>
