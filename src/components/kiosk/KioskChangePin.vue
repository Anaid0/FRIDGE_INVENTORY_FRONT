<script setup lang="ts">
import { ref } from 'vue';
import type { KioskPerson } from '@/domain/models';
import { ApiError, errorMessage } from '@/services/errors';
import { useKioskStore } from '@/stores/kiosk';
import { isTrivialPin } from '@/utils/format';
import PinPad from './PinPad.vue';

/** Cambiar el propio PIN en la tablet: actual → nuevo → confirmación. */
const props = defineProps<{ person: KioskPerson }>();
const emit = defineEmits<{ done: []; cancel: [] }>();

const kiosk = useKioskStore();
type Step = 'current' | 'new' | 'confirm';
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
    await kiosk.changePin(props.person.id, current.value, next.value);
    emit('done');
  } catch (e) {
    error.value = errorMessage(e);
    // Si el PIN actual estaba mal (o está bloqueado), se empieza de nuevo.
    if (e instanceof ApiError && ['INVALID_PIN', 'PIN_LOCKED'].includes(e.code)) step.value = 'current';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <PinPad :key="step" :label="LABELS[step]" :error="error" :disabled="saving" @complete="onComplete" />
    <button
      type="button"
      class="mx-auto mt-6 block py-2 text-sm font-medium text-ink-500"
      @click="emit('cancel')"
    >
      Cancelar
    </button>
  </div>
</template>
