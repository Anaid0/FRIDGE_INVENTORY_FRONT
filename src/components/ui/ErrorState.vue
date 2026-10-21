<script setup lang="ts">
/**
 * Error al cargar (mockups: aviso rojo translúcido con un círculo rojo y una "×" blanca) con "Reintentar".
 * `title` cambia la primera línea si la vista lo necesita.
 */
withDefaults(defineProps<{ message: string; title?: string }>(), {
  title: 'No se pudo cargar la información',
});
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex items-center gap-2.5 rounded-[14px] border border-danger-200 bg-[rgb(255_240_238/0.95)] py-2 pr-2 pl-3 text-[13px]"
    role="alert"
  >
    <span class="grid size-6 shrink-0 place-items-center rounded-full bg-danger-700 text-white">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </span>
    <div class="min-w-0 flex-1">
      <p class="font-extrabold text-ink-900">{{ title }}</p>
      <p class="mt-0.5 text-ink-700">{{ message }}</p>
    </div>
    <button
      type="button"
      class="min-h-10 shrink-0 rounded-[10px] border border-ink-300 bg-white px-3 text-xs font-extrabold text-ink-900 hover:bg-ink-50"
      @click="emit('retry')"
    >
      Reintentar
    </button>
  </div>
</template>
