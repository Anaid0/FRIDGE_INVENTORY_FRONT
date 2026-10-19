<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; tone?: 'default' | 'warning' | 'danger' }>();
</script>

<template>
  <div class="card p-4">
    <p class="text-sm text-ink-500">{{ label }}</p>
    <p
      class="mt-1 text-2xl font-semibold tracking-tight"
      :class="
        tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-warning-700' : 'text-ink-900'
      "
    >
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
