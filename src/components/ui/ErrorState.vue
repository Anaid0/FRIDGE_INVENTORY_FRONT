<script setup lang="ts">
import Icon from './Icon.vue';

defineProps<{ message: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-xl border border-danger-600/20 bg-danger-50 p-4 text-sm"
    role="alert"
  >
    <span class="text-danger-600"><Icon name="alert" /></span>
    <div class="flex-1">
      <p class="font-medium text-danger-700">No se pudo cargar la información</p>
      <p class="mt-0.5 text-danger-700/80">{{ message }}</p>
    </div>
    <button type="button" class="btn-secondary px-3 py-1.5" @click="emit('retry')">Reintentar</button>
  </div>
</template>
