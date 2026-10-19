<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; tone?: 'default' | 'warning' | 'danger' }>();
</script>

<template>
  <!-- Cifra destacada (vidrio). "warning" es el naranja translúcido de "Con stock bajo". -->
  <div
    class="flex flex-col gap-1 rounded-[18px] px-5 py-[18px]"
    :class="
      tone === 'warning'
        ? 'bg-accent-50/80 ring-1 ring-accent-200/70 backdrop-blur-md'
        : tone === 'danger'
          ? 'bg-danger-50/80 ring-1 ring-danger-600/20 backdrop-blur-md'
          : 'glass'
    "
  >
    <p class="text-sm" :class="tone === 'warning' ? 'font-bold text-accent-700' : 'text-ink-500'">
      {{ label }}
    </p>
    <p
      class="text-3xl font-black tracking-tight tabular-nums"
      :class="tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-accent-700' : 'text-ink-900'"
    >
      {{ value }}
    </p>
    <p v-if="hint" class="text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
