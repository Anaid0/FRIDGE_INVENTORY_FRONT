<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../ui/Icon.vue';

/**
 * Teclado numérico para el PIN de 4 dígitos (botones grandes para la tablet).
 * Emite `complete` al escribir el cuarto dígito. Acepta también el teclado físico.
 */
const props = withDefaults(
  defineProps<{ label: string; error?: string | null; disabled?: boolean; length?: number }>(),
  { error: null, disabled: false, length: 4 },
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
  <div class="mx-auto w-full max-w-xs select-none">
    <p class="text-center text-lg font-semibold text-ink-800">{{ label }}</p>

    <div
      class="my-5 flex justify-center gap-4"
      :class="{ shake: shaking }"
      role="img"
      :aria-label="`${digits.length} de ${length} dígitos`"
    >
      <span
        v-for="i in length"
        :key="i"
        class="size-5 rounded-full border-2 transition-colors"
        :class="i <= digits.length ? 'border-brand-700 bg-brand-700' : 'border-ink-300 bg-white'"
      />
    </div>

    <p
      class="mb-4 min-h-10 text-center text-sm font-medium text-danger-700"
      role="alert"
      aria-live="assertive"
    >
      {{ error ?? '' }}
    </p>

    <div class="grid grid-cols-3 gap-3">
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
        <Icon name="chevronLeft" :size="26" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.key {
  display: grid;
  place-items: center;
  height: 4.5rem;
  border-radius: 1rem;
  background: white;
  border: 1px solid var(--color-ink-200);
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-ink-900);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  transition: background-color 0.1s;
}
.key:active:not(:disabled) {
  background: var(--color-brand-50);
}
.key:disabled {
  opacity: 0.5;
}
.key-muted {
  background: var(--color-ink-100);
  color: var(--color-ink-600);
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
@media (prefers-reduced-motion: reduce) {
  .shake {
    animation: none;
  }
}
</style>
