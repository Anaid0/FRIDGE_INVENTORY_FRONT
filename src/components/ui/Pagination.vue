<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ page: number; pageSize: number; total: number }>();
const emit = defineEmits<{ change: [page: number] }>();

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1));
const to = computed(() => Math.min(props.page * props.pageSize, props.total));
</script>

<template>
  <nav
    class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-ink-500"
    aria-label="Paginación"
  >
    <p class="tabular-nums">Mostrando {{ from }}–{{ to }} de {{ total }}</p>
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="btn-secondary min-h-11"
        :disabled="page <= 1"
        aria-label="Página anterior"
        @click="emit('change', page - 1)"
      >
        Anterior
      </button>
      <button
        type="button"
        :class="page >= pages ? 'btn-secondary' : 'btn-primary'"
        class="min-h-11"
        :disabled="page >= pages"
        aria-label="Página siguiente"
        @click="emit('change', page + 1)"
      >
        Siguiente
      </button>
    </div>
  </nav>
</template>
