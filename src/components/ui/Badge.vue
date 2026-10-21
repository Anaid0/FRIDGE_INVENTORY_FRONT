<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'brand' | 'success' | 'accent' | 'warning' | 'danger' | 'info';
    /** `sm`: la píldora pequeña de los mockups (p. ej. "1 bloq." en Más). */
    size?: 'sm' | 'md';
  }>(),
  {
    tone: 'neutral',
    size: 'md',
  },
);
</script>

<template>
  <!-- Píldora de estado de los mockups: texto en negrita (800) sobre un tono suave; el estado siempre va escrito. -->
  <span
    class="inline-flex items-center gap-1 rounded-full leading-none font-extrabold whitespace-nowrap"
    :class="[
      size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-1 text-xs',
      {
        'bg-ink-900/8 text-ink-700': tone === 'neutral',
        'bg-brand-100 text-brand-700': tone === 'brand' || tone === 'info',
        'bg-success-50 text-success-700': tone === 'success',
        'bg-accent-100 text-accent-700': tone === 'accent',
        'bg-warning-50 text-warning-700': tone === 'warning',
        'bg-danger-50 text-danger-700': tone === 'danger',
      },
    ]"
  >
    <slot />
  </span>
</template>
