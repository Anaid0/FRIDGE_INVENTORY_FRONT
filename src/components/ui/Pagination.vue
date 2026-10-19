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
  <nav class="flex items-center justify-between gap-4 px-4 py-3 text-sm text-ink-500" aria-label="Paginación">
    <p class="tabular-nums">{{ from }}–{{ to }} de {{ total }}</p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn-secondary px-2 py-1.5"
        :disabled="page <= 1"
        aria-label="Página anterior"
        @click="emit('change', page - 1)"
      >
        <Icon name="chevronLeft" :size="16" />
      </button>
      <span class="px-2 tabular-nums">{{ page }} / {{ pages }}</span>
      <button
        type="button"
        class="btn-secondary px-2 py-1.5"
        :disabled="page >= pages"
        aria-label="Página siguiente"
        @click="emit('change', page + 1)"
      >
        <Icon name="chevronRight" :size="16" />
      </button>
    </div>
  </nav>
</template>
