<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'info' }>(), {
  tone: 'neutral',
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="{
      'bg-ink-100 text-ink-700': tone === 'neutral',
      'bg-brand-50 text-brand-800': tone === 'brand',
      'bg-warning-50 text-warning-700': tone === 'warning',
      'bg-danger-50 text-danger-700': tone === 'danger',
      'bg-sky-50 text-sky-800': tone === 'info',
    }"
  >
    <slot />
  </span>
</template>
