<script setup lang="ts">
import type { MovementType } from '@/domain/models';

/** "Paso 2 de 3" con barritas (naranja al sacar, verde al meter). */
withDefaults(defineProps<{ step: number; total?: number; type: MovementType }>(), { total: 3 });
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="flex gap-1.5" aria-hidden="true">
      <span
        v-for="i in total"
        :key="i"
        class="h-2 w-7 rounded-full"
        :class="i <= step ? (type === 'OUT' ? 'bg-accent-500' : 'bg-success-700') : 'bg-ink-300'"
      />
    </span>
    <span class="text-sm font-extrabold text-ink-500">Paso {{ step }} de {{ total }}</span>
  </div>
</template>
