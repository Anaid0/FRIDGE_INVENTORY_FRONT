<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { isTrivialPin, randomPin } from '@/utils/format';
import Icon from './ui/Icon.vue';

/**
 * Asignar un PIN para que el empleado lo memorice:
 * 1. Se genera (o se escribe) y se muestra 5 segundos.
 * 2. Se oculta y se habilita "Confirma el PIN": el empleado lo escribe de memoria.
 * `v-model` solo trae el PIN cuando quedó confirmado; mientras tanto vale ''.
 * `showHint: false`: el formulario pone la ayuda en otro lugar (con id `${idPrefix}-pin-hint`).
 */
const props = withDefaults(
  defineProps<{ idPrefix: string; error?: string | null; seconds?: number; showHint?: boolean }>(),
  { error: null, seconds: 5, showHint: true },
);
const model = defineModel<string>({ default: '' });

type Phase = 'enter' | 'showing' | 'confirm';
const phase = ref<Phase>('enter');
const pin = ref('');
const confirm = ref('');
const remaining = ref(0);
const localError = ref<string | null>(null);
const confirmInput = ref<HTMLInputElement | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

/** Muestra el PIN unos segundos y luego lo oculta para confirmarlo de memoria. */
function show() {
  stopTimer();
  confirm.value = '';
  localError.value = null;
  phase.value = 'showing';
  remaining.value = props.seconds;
  timer = setInterval(async () => {
    remaining.value -= 1;
    if (remaining.value > 0) return;
    stopTimer();
    phase.value = 'confirm';
    await nextTick();
    confirmInput.value?.focus();
  }, 1000);
}

function generate() {
  pin.value = randomPin();
  show();
}

function onPinInput(event: Event) {
  pin.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
  localError.value = null;
  if (pin.value.length < 4) return;
  if (isTrivialPin(pin.value)) {
    localError.value = 'Ese PIN es muy fácil de adivinar; usa Generar o elige otro.';
    return;
  }
  show();
}

function onConfirmInput(event: Event) {
  confirm.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
}

/** Empezar de nuevo (otro PIN), p. ej. si la API dice que ese PIN ya es de otra persona. */
function restart() {
  stopTimer();
  pin.value = '';
  confirm.value = '';
  localError.value = null;
  phase.value = 'enter';
}

const matches = computed(
  () => phase.value === 'confirm' && confirm.value.length === 4 && confirm.value === pin.value,
);
const mismatch = computed(
  () => phase.value === 'confirm' && confirm.value.length === 4 && confirm.value !== pin.value,
);
watch(matches, (ok) => (model.value = ok ? pin.value : ''), { immediate: true });

/** El aviso del formulario vale para el PIN que se estaba eligiendo: al generar o escribir otro, se va. */
const shownError = computed(() => localError.value ?? (phase.value === 'enter' ? props.error : null));

/** Para el formulario: por qué todavía no se puede guardar (o null si el PIN quedó confirmado). */
const pendingReason = computed(() => {
  if (matches.value) return null;
  if (phase.value === 'enter') return 'Genera o escribe un PIN.';
  if (phase.value === 'showing') return 'Espera a que se oculte el PIN y confírmalo.';
  return mismatch.value ? 'Los PIN no coinciden.' : 'Confirma el PIN de memoria.';
});

defineExpose({ restart, pendingReason });
onBeforeUnmount(stopTimer);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="grid grid-cols-2 gap-2">
      <div class="flex min-w-0 flex-col gap-1">
        <label :for="`${idPrefix}-pin`" class="text-[12px] font-extrabold text-ink-700">PIN</label>
        <div class="flex gap-1.5">
          <!-- Mientras se confirma, el PIN queda oculto. -->
          <input
            v-if="phase === 'confirm'"
            :id="`${idPrefix}-pin`"
            value="••••"
            type="text"
            readonly
            aria-label="PIN de 4 dígitos (oculto)"
            class="h-11 w-full min-w-0 flex-1 rounded-[10px] border border-ink-300 bg-white px-2 text-center font-mono text-[18px] font-extrabold tracking-[0.3em] tabular-nums placeholder:text-ink-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-danger-600 text-ink-500"
          />
          <input
            v-else
            :id="`${idPrefix}-pin`"
            :value="pin"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            maxlength="4"
            :readonly="phase === 'showing'"
            placeholder="····"
            aria-label="PIN de 4 dígitos"
            class="h-11 w-full min-w-0 flex-1 rounded-[10px] border border-ink-300 bg-white px-2 text-center font-mono text-[18px] font-extrabold tracking-[0.3em] tabular-nums placeholder:text-ink-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-danger-600 text-ink-900"
            :class="{ 'border-brand-500! bg-brand-50!': phase === 'showing' }"
            :aria-invalid="Boolean(shownError)"
            :aria-describedby="`${idPrefix}-pin-hint`"
            @input="onPinInput"
          />
          <button
            v-if="phase === 'confirm'"
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full bg-ink-900/8 text-ink-900 transition-colors hover:bg-ink-900/12 disabled:cursor-not-allowed disabled:opacity-50"
            title="Ver de nuevo"
            @click="show"
          >
            <Icon name="eye" :size="18" :stroke="2.2" /><span class="sr-only">Ver de nuevo</span>
          </button>
          <button
            v-else
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full bg-ink-900/8 text-ink-900 transition-colors hover:bg-ink-900/12 disabled:cursor-not-allowed disabled:opacity-50"
            title="Generar PIN"
            :disabled="phase === 'showing'"
            @click="generate"
          >
            <Icon name="refresh" :size="18" :stroke="2.2" /><span class="sr-only">Generar</span>
          </button>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-1">
        <label :for="`${idPrefix}-pin-confirm`" class="text-[12px] font-extrabold text-ink-700"
          >Confirma el PIN</label
        >
        <input
          :id="`${idPrefix}-pin-confirm`"
          ref="confirmInput"
          :value="confirm"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          maxlength="4"
          :disabled="phase !== 'confirm'"
          :placeholder="phase === 'showing' ? `${remaining} s…` : phase === 'confirm' ? 'De memoria' : ''"
          class="h-11 w-full min-w-0 flex-1 rounded-[10px] border border-ink-300 bg-white px-2 text-center font-mono text-[18px] font-extrabold tracking-[0.3em] tabular-nums placeholder:text-ink-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-danger-600 text-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
          :class="{ 'border-success-600!': matches }"
          :aria-invalid="mismatch"
          @input="onConfirmInput"
        />
      </div>
    </div>

    <!-- Cuenta regresiva mientras se muestra -->
    <div v-if="phase === 'showing'" class="flex flex-col gap-1" aria-live="polite">
      <p class="text-[12px] font-extrabold text-brand-700">
        Que el empleado lo memorice: se oculta en {{ remaining }} s
      </p>
      <div class="h-1 overflow-hidden rounded-full bg-ink-900/8" aria-hidden="true">
        <div
          class="h-full rounded-full bg-brand-600 transition-[width] duration-1000 ease-linear"
          :style="{ width: `${(remaining / seconds) * 100}%` }"
        />
      </div>
    </div>
    <p v-if="shownError" class="text-[12px] font-bold text-danger-700" role="alert">
      {{ shownError }}
    </p>
    <p v-if="mismatch" class="text-[12px] font-bold text-danger-700" role="alert">
      Los PIN no coinciden. Usa "Ver de nuevo" (el ojo) si no lo recuerda.
    </p>
    <p v-else-if="matches" class="flex items-center gap-1 text-[12px] font-bold text-success-700">
      <Icon name="check" :size="14" :stroke="2.5" /> Los PIN coinciden
    </p>
    <p v-if="showHint" :id="`${idPrefix}-pin-hint`" class="text-[12px] text-ink-500">
      Se muestra {{ seconds }} s y se oculta para confirmarlo de memoria. Sin PIN obvios (0000, 1234) ni
      repetidos. Entrégalo en persona.
    </p>
    <button
      v-if="phase === 'confirm'"
      type="button"
      class="min-h-8 self-start text-[12px] font-extrabold text-brand-600 hover:text-brand-800"
      @click="restart"
    >
      Usar otro PIN
    </button>
  </div>
</template>
