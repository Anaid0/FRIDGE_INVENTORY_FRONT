<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { RouterLink } from 'vue-router';
import { useToastStore, type Toast } from '@/stores/toasts';
import Icon from './Icon.vue';

/**
 * Avisos de los mockups (AdminEstados): filas de vidrio blanco arriba de la pantalla con un círculo de color
 * a la izquierda — verde con ✓ (éxito), naranja con "!" (aviso, con un enlace de acción opcional) y rojo con
 * × (error). El estado vive en el store, así cualquier vista o store puede avisar. Van por encima de los
 * diálogos y se pueden cerrar a mano; el store los quita solos a los pocos segundos.
 */
const toasts = useToastStore();

/** Campos opcionales que el store todavía no tiene: aviso naranja y enlace de acción ("Ingresar"). */
type ToastView = Toast & {
  kind: Toast['kind'] | 'warning';
  action?: { label: string; to: RouteLocationRaw };
};

function view(toast: Toast): ToastView {
  return toast as ToastView;
}
function tone(toast: Toast): 'success' | 'warning' | 'error' {
  const kind = view(toast).kind;
  return kind === 'success' ? 'success' : kind === 'error' ? 'error' : 'warning';
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[60000] mx-auto flex w-full max-w-md flex-col gap-2 px-3.5"
      :style="{ paddingTop: 'calc(var(--ion-safe-area-top, 0px) + 0.75rem)' }"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="-translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
      >
        <div
          v-for="toast in toasts.toasts"
          :key="toast.id"
          class="pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-[14px] border py-1.5 pr-1 pl-3 text-[13px] text-ink-800 shadow-[0_8px_22px_rgb(7_59_94/0.12)] backdrop-blur-[18px]"
          :class="{
            'border-white/95 bg-white/90': tone(toast) === 'success',
            'border-accent-200 bg-[rgb(255_247_238/0.95)]': tone(toast) === 'warning',
            'border-danger-200 bg-[rgb(255_240_238/0.96)]': tone(toast) === 'error',
          }"
          :role="tone(toast) === 'error' ? 'alert' : 'status'"
        >
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full"
            :class="{
              'bg-success-700 text-white': tone(toast) === 'success',
              'bg-accent-500 font-black text-ink-900': tone(toast) === 'warning',
              'bg-danger-700 text-white': tone(toast) === 'error',
            }"
            aria-hidden="true"
          >
            <Icon v-if="tone(toast) === 'success'" name="check" :size="14" :stroke="3" />
            <Icon v-else-if="tone(toast) === 'error'" name="x" :size="14" :stroke="3" />
            <template v-else>!</template>
          </span>
          <span class="min-w-0 flex-1 py-1">{{ toast.message }}</span>
          <RouterLink
            v-if="view(toast).action"
            :to="view(toast).action!.to"
            class="shrink-0 px-1 text-xs font-extrabold text-brand-700 underline underline-offset-2 hover:text-ink-900"
            @click="toasts.dismiss(toast.id)"
          >
            {{ view(toast).action!.label }}
          </RouterLink>
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-900/5 hover:text-ink-900"
            aria-label="Cerrar aviso"
            @click="toasts.dismiss(toast.id)"
          >
            <Icon name="x" :size="14" :stroke="2.4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
