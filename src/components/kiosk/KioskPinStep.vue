<script setup lang="ts">
import type { CartLine } from '@/composables/useKioskCart';
import type { KioskPerson, MovementType } from '@/domain/models';
import Avatar from '../ui/Avatar.vue';
import Icon from '../ui/Icon.vue';
import PinPad from './PinPad.vue';
import StepIndicator from './StepIndicator.vue';

/** Paso 3: "Hola, Ana" con lo que va a sacar/meter a la izquierda y el teclado del PIN a la derecha. */
defineProps<{
  person: KioskPerson;
  type: MovementType;
  lines: CartLine[];
  error: string | null;
  submitting: boolean;
}>();
const emit = defineEmits<{ back: []; submit: [pin: string]; changePin: [] }>();
</script>

<template>
  <div class="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
    <section class="flex min-w-0 flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button type="button" class="btn-secondary min-h-[52px] px-5 text-base" @click="emit('back')">
          <Icon name="arrowLeft" :size="20" :stroke="2.25" /> No soy {{ person.name }}
        </button>
        <StepIndicator :step="3" :type="type" />
      </div>

      <Avatar :person="person" size="xl" class="hello-avatar mt-8 lg:mt-12" />
      <h1 class="mt-5 text-4xl font-black tracking-tight text-ink-900 sm:text-5xl">
        Hola, {{ person.name }}
      </h1>
      <p class="mt-4 text-lg text-ink-500">
        Escribe tu PIN para confirmar que vas a {{ type === 'OUT' ? 'sacar' : 'meter' }}:
      </p>
      <ul class="mt-4 space-y-2.5">
        <li
          v-for="line in lines"
          :key="line.product.id"
          class="glass flex items-center gap-3.5 rounded-2xl px-4 py-3"
        >
          <span
            class="grid h-10 min-w-10 place-items-center rounded-[10px] px-1.5 text-lg font-black tabular-nums"
            :class="type === 'OUT' ? 'bg-accent-500 text-ink-900' : 'bg-success-700 text-white'"
          >
            {{ line.quantity }}
          </span>
          <span class="min-w-0 text-lg font-extrabold break-words text-ink-900">{{ line.product.name }}</span>
        </li>
      </ul>

      <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 pb-1 lg:mt-auto lg:pt-8">
        <button
          type="button"
          class="min-h-11 font-extrabold text-brand-700 underline underline-offset-2"
          @click="emit('changePin')"
        >
          Cambiar mi PIN
        </button>
        <p class="text-sm text-ink-500">¿Lo olvidaste? El administrador puede restablecerlo.</p>
      </div>
    </section>

    <section
      class="glass-strong w-full max-w-[30rem] justify-self-center rounded-[28px] px-5 py-7 lg:max-w-none lg:px-10"
    >
      <PinPad
        label="Tu PIN"
        :error="error"
        :disabled="submitting"
        hint="Tras 5 intentos fallidos se bloquea 5 minutos."
        @complete="emit('submit', $event)"
      />
    </section>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .hello-avatar {
    display: none;
  }
}
</style>
