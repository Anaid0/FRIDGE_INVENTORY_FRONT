<script setup lang="ts">
import { randomPin } from '@/utils/format';
import Icon from './ui/Icon.vue';

/** Campo de PIN de 4 dígitos (visible para que el admin lo comunique) con botón "Generar". */
defineProps<{ id: string; invalid?: boolean }>();
const pin = defineModel<string>({ required: true });

function onInput(event: Event) {
  pin.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
}
</script>

<template>
  <div class="flex gap-2">
    <input
      :id="id"
      :value="pin"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength="4"
      placeholder="••••"
      class="input w-28 text-center font-mono text-lg tracking-[0.4em] tabular-nums"
      :aria-invalid="invalid"
      @input="onInput"
    />
    <button type="button" class="btn-secondary px-3" @click="pin = randomPin()">
      <Icon name="key" :size="16" /> Generar
    </button>
  </div>
</template>
