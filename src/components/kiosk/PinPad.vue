<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../ui/Icon.vue';

/**
 * Teclado numérico para el PIN de 4 dígitos (botones grandes para la tablet).
 * Emite `complete` al escribir el cuarto dígito. Acepta también el teclado físico.
 */
const props = withDefaults(
  defineProps<{
    label: string;
    error?: string | null;
    disabled?: boolean;
    length?: number;
    /** Nota bajo el teclado (p. ej. cuántos intentos hay antes del bloqueo). */
    hint?: string | null;
  }>(),
  { error: null, disabled: false, length: 4, hint: null },
);
const emit = defineEmits<{ complete: [pin: string] }>();

const digits = ref('');
const shaking = ref(false);

function press(digit: string) {
  if (props.disabled || digits.value.length >= props.length) return;
  digits.value += digit;
  if (digits.value.length === props.length) emit('complete', digits.value);
}

function backspace() {
  if (!props.disabled) digits.value = digits.value.slice(0, -1);
}

function reset() {
  digits.value = '';
}

// Ante un error (PIN incorrecto) se vacía el teclado con una pequeña sacudida.
watch(
  () => props.error,
  (error) => {
    if (!error) return;
    reset();
    shaking.value = true;
    setTimeout(() => (shaking.value = false), 400);
  },
);

function onKey(event: KeyboardEvent) {
  if (/^\d$/.test(event.key)) press(event.key);
  else if (event.key === 'Backspace') backspace();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

defineExpose({ reset });
</script>

<template>
  <div class="mx-auto w-full max-w-[26rem] select-none">
    <p class="eyebrow text-center text-sm! text-ink-500">{{ label }}</p>

    <div
      class="mt-4 flex justify-center gap-5"
      :class="{ shake: shaking }"
      role="img"
      :aria-label="`${digits.length} de ${length} dígitos`"
    >
      <span
        v-for="i in length"
        :key="i"
        class="size-[26px] rounded-full border-[3px] transition-colors"
        :class="
          error && !digits.length
            ? 'border-danger-600/60 bg-white/60'
            : i <= digits.length
              ? 'border-ink-900 bg-ink-900'
              : 'border-ink-400 bg-white/60'
        "
      />
    </div>

    <p
      class="mt-2 mb-3 flex min-h-10 items-center justify-center text-center text-sm font-bold text-danger-700"
      role="alert"
      aria-live="assertive"
    >
      {{ error ?? '' }}
    </p>

    <div class="grid grid-cols-3 gap-3.5">
      <button
        v-for="digit in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
        :key="digit"
        type="button"
        class="key"
        :disabled="disabled"
        @click="press(digit)"
      >
        {{ digit }}
      </button>
      <span aria-hidden="true" />
      <button type="button" class="key" :disabled="disabled" @click="press('0')">0</button>
      <button
        type="button"
        class="key key-muted"
        :disabled="disabled || !digits"
        aria-label="Borrar"
        @click="backspace"
      >
        <Icon name="backspace" :size="30" :stroke="2" />
      </button>
    </div>

    <p v-if="hint" class="mt-5 text-center text-sm text-ink-500">{{ hint }}</p>
  </div>
</template>

<style scoped>
.key {
  display: grid;
  place-items: center;
  height: 5.25rem;
  border-radius: 1.25rem;
  background: rgb(226 238 248 / 0.7);
  border: 1px solid rgb(255 255 255 / 0.7);
  font-size: 2.125rem;
  font-weight: 900;
  color: var(--color-ink-900);
  transition:
    background-color 0.1s,
    transform 0.1s;
}
.key:active:not(:disabled) {
  background: rgb(207 232 247 / 0.95); /* brand-200 */
  transform: scale(0.96);
}
.key:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.key-muted {
  background: transparent;
  border-color: transparent;
  color: var(--color-ink-700);
}
.key-muted:disabled {
  opacity: 0.35;
}
.shake {
  animation: shake 0.35s;
}
@keyframes shake {
  25% {
    transform: translateX(-8px);
  }
  50% {
    transform: translateX(8px);
  }
  75% {
    transform: translateX(-4px);
  }
}
@media (max-height: 760px) {
  .key {
    height: 4.5rem;
    font-size: 1.85rem;
  }
}
@media (max-height: 560px) {
  .key {
    height: 3.25rem;
    font-size: 1.4rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shake {
    animation: none;
  }
  .key {
    transition: none;
  }
}
</style>
