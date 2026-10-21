<script setup lang="ts">
/**
 * Cifra destacada (vidrio) con la etiqueta arriba y el número en JetBrains Mono, como en los mockups.
 * "warning" es el naranja translúcido de "Con stock bajo"; "danger", el rojo de saldo negativo.
 */
defineProps<{ label: string; value: string; hint?: string; tone?: 'default' | 'warning' | 'danger' }>();
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-1 rounded-[18px] px-4 py-3.5 sm:px-5 sm:py-4"
    :class="
      tone === 'warning'
        ? 'border border-accent-200 bg-accent-50/90 backdrop-blur-md'
        : tone === 'danger'
          ? 'border border-danger-200 bg-danger-50/90 backdrop-blur-md'
          : 'glass'
    "
  >
    <p
      class="text-xs font-extrabold"
      :class="tone === 'warning' ? 'text-accent-700' : tone === 'danger' ? 'text-danger-700' : 'text-ink-500'"
    >
      {{ label }}
    </p>
    <p
      class="num text-[26px] leading-tight tracking-tight"
      :class="tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-accent-700' : 'text-ink-900'"
    >
      {{ value }}
    </p>
    <p v-if="hint" class="text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
