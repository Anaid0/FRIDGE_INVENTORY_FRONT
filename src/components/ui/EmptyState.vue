<script setup lang="ts">
import Icon, { type IconName } from './Icon.vue';

withDefaults(defineProps<{ title: string; message?: string; icon?: IconName }>(), {
  message: undefined,
  icon: 'box',
});
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <span class="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-100/80 text-brand-600">
      <Icon :name="icon" :size="22" />
    </span>
    <p class="font-extrabold text-ink-900">{{ title }}</p>
    <p v-if="message" class="mt-1 max-w-sm text-sm text-ink-500">{{ message }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
