<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <!-- Encabezado de página de los mockups: título grande (Nunito 900) y acciones a la derecha. -->
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
    <div class="min-w-0">
      <slot name="eyebrow" />
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="page-title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="subtitle || $slots.subtitle" class="mt-1 text-base text-ink-500">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-2.5">
      <slot name="actions" />
    </div>
  </div>
</template>
