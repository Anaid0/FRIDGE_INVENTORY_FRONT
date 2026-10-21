<script setup lang="ts">
import Icon, { type IconName } from './Icon.vue';
import SadMonkey from './SadMonkey.vue';

/**
 * "Sin resultados" de los mockups: el mono triste al lado de un título ("Nada por aquí"), una línea de
 * explicación y, si hace falta, un botón ("Quitar filtros") con `actionLabel` + evento `action` o con el slot.
 * Con `icon` se muestra ese ícono en un cuadro azul en vez del mono (uso anterior, centrado).
 * `card`: dentro de su propia tarjeta de vidrio (cuando va suelto en la página).
 */
withDefaults(
  defineProps<{ title?: string; message?: string; icon?: IconName; actionLabel?: string; card?: boolean }>(),
  {
    title: 'Nada por aquí',
    message: undefined,
    icon: undefined,
    actionLabel: undefined,
    card: false,
  },
);
const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div
    v-if="icon"
    class="flex flex-col items-center px-6 py-10 text-center"
    :class="{ 'rounded-[18px] border border-white/90 bg-white/60': card }"
  >
    <span class="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-100/80 text-brand-600">
      <Icon :name="icon" :size="22" />
    </span>
    <p class="font-display text-[15px] font-black text-ink-900">{{ title }}</p>
    <p v-if="message" class="mt-1 max-w-sm text-[13px] text-ink-500">{{ message }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="mt-3 min-h-9 rounded-[10px] bg-ink-900/8 px-3 text-xs font-extrabold text-ink-900 hover:bg-ink-900/12"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>

  <div
    v-else
    class="flex justify-center"
    :class="card ? 'rounded-[18px] border border-white/90 bg-white/60 p-3.5' : 'px-4 py-8'"
  >
    <div class="flex max-w-md items-center gap-3 text-left">
      <SadMonkey class="h-14 w-16 shrink-0 sm:h-[70px] sm:w-20" />
      <div class="flex min-w-0 flex-col gap-0.5">
        <p class="font-display text-[15px] font-black text-ink-900">{{ title }}</p>
        <p v-if="message" class="text-[13px] text-ink-500">{{ message }}</p>
        <button
          v-if="actionLabel"
          type="button"
          class="mt-1 min-h-9 self-start rounded-[10px] bg-ink-900/8 px-3 text-xs font-extrabold text-ink-900 hover:bg-ink-900/12"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </button>
        <div v-if="$slots.default" class="mt-2"><slot /></div>
      </div>
    </div>
  </div>
</template>
