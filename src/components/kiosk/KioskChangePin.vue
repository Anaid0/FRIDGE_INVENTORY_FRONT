<script setup lang="ts">
import { ref } from 'vue';
import { ApiError, errorMessage } from '@/services/errors';
import { useKioskStore } from '@/stores/kiosk';
import { isTrivialPin } from '@/utils/format';
import Icon from '../ui/Icon.vue';
import PinPad from './PinPad.vue';

/** Cambiar el propio PIN en la tablet: actual (identifica a la persona) → nuevo → confirmación. */
const emit = defineEmits<{ done: [name: string]; cancel: [] }>();

const kiosk = useKioskStore();
type Step = 'current' | 'new' | 'confirm';
const STEPS: Step[] = ['current', 'new', 'confirm'];
const step = ref<Step>('current');
const current = ref('');
const next = ref('');
const error = ref<string | null>(null);
const saving = ref(false);

const LABELS: Record<Step, string> = {
  current: 'Escribe tu PIN actual',
  new: 'Escribe tu PIN nuevo',
  confirm: 'Repite el PIN nuevo',
};
const DESCRIPTIONS: Record<Step, string> = {
  current: 'Tu PIN actual',
  new: 'Un PIN nuevo de 4 dígitos',
  confirm: 'El PIN nuevo otra vez',
};

async function onComplete(pin: string) {
  error.value = null;
  if (step.value === 'current') {
    current.value = pin;
    step.value = 'new';
    return;
  }
  if (step.value === 'new') {
    if (isTrivialPin(pin)) {
      error.value = 'Ese PIN es muy fácil de adivinar; elige otro';
      return;
    }
    if (pin === current.value) {
      error.value = 'El PIN nuevo debe ser distinto del actual';
      return;
    }
    next.value = pin;
    step.value = 'confirm';
    return;
  }
  if (pin !== next.value) {
    error.value = 'No coincide; vuelve a escribir el PIN nuevo';
    step.value = 'new';
    return;
  }
  saving.value = true;
  try {
    emit('done', await kiosk.changePin(current.value, next.value));
  } catch (e) {
    error.value = errorMessage(e);
    // Si el PIN actual estaba mal (o está bloqueado), se empieza de nuevo.
    if (e instanceof ApiError && ['INVALID_PIN', 'PIN_LOCKED', 'PIN_AMBIGUOUS'].includes(e.code)) {
      step.value = 'current';
    }
    // Ese PIN nuevo ya es de otra persona: se elige otro.
    if (e instanceof ApiError && e.code === 'PIN_TAKEN') step.value = 'new';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
    <section class="flex min-w-0 flex-col">
      <div>
        <button type="button" class="btn-secondary min-h-[52px] px-5 text-base" @click="emit('cancel')">
          <Icon name="arrowLeft" :size="20" :stroke="2.25" /> Cancelar
        </button>
      </div>
      <span
        class="hello-avatar mt-8 grid size-[120px] place-items-center rounded-full bg-brand-100 text-brand-600 lg:mt-12"
        aria-hidden="true"
      >
        <Icon name="key" :size="56" :stroke="1.75" />
      </span>
      <h1 class="mt-5 text-4xl font-black tracking-tight text-ink-900 sm:text-5xl">Cambiar mi PIN</h1>
      <p class="mt-4 text-lg text-ink-500">Escribe en el teclado:</p>
      <ol class="mt-4 list-none space-y-2.5 p-0" aria-label="Pasos para cambiar el PIN">
        <li
          v-for="(s, index) in STEPS"
          :key="s"
          class="flex items-center gap-3.5 rounded-2xl px-4 py-3"
          :class="s === step ? 'glass border-brand-600!' : 'glass-inset'"
          :aria-current="s === step ? 'step' : undefined"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-[10px] text-lg font-black"
            :class="
              STEPS.indexOf(step) > index
                ? 'bg-success-700 text-white'
                : s === step
                  ? 'bg-brand-600 text-white'
                  : 'bg-white/70 text-ink-500'
            "
          >
            <Icon v-if="STEPS.indexOf(step) > index" name="check" :size="20" :stroke="2.5" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="text-lg font-extrabold" :class="s === step ? 'text-ink-900' : 'text-ink-500'">
            {{ DESCRIPTIONS[s] }}
          </span>
        </li>
      </ol>
      <p class="mt-6 text-sm text-ink-500 lg:mt-auto lg:pt-8">
        Elige uno difícil de adivinar (nada de 1234 ni 1111) y que no tenga nadie más.
      </p>
    </section>

    <section
      class="glass-strong w-full max-w-[30rem] justify-self-center rounded-[28px] px-5 py-7 lg:max-w-none lg:px-10"
    >
      <PinPad :key="step" :label="LABELS[step]" :error="error" :disabled="saving" @complete="onComplete" />
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
