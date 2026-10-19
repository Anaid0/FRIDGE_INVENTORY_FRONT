<script setup lang="ts">
import { computed } from 'vue';
import type { KioskCart } from '@/composables/useKioskCart';
import type { MovementType } from '@/domain/models';
import MoveIllustration from '../brand/MoveIllustration.vue';
import Icon from '../ui/Icon.vue';
import { stockAfter, tone } from './kioskText';

/** Lo que la persona va a sacar/meter, con +/− por producto, el total y el botón para continuar. */
const props = defineProps<{ cart: KioskCart; type: MovementType }>();
const emit = defineEmits<{ continue: [] }>();

const max = (quantity: number) => (props.type === 'OUT' ? quantity : 99);
const colors = computed(() => tone(props.type));
const total = computed(() => props.cart.totalUnits.value);
</script>

<template>
  <aside
    class="glass-strong flex h-full flex-col gap-3 rounded-3xl p-4 lg:gap-3.5 lg:p-5"
    aria-label="Lo que elegiste"
  >
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-xl font-black text-ink-900 lg:text-[22px]">
        {{ type === 'OUT' ? 'Vas a sacar' : 'Vas a meter' }}
      </h2>
      <button
        v-if="!cart.isEmpty.value"
        type="button"
        class="min-h-11 rounded-xl px-3 font-extrabold text-brand-700 hover:bg-white/60"
        @click="cart.clear()"
      >
        Vaciar
      </button>
    </div>

    <div
      v-if="cart.isEmpty.value"
      class="flex flex-1 flex-col items-center justify-center px-2 text-center text-ink-500"
    >
      <!-- Solo en la columna lateral: abajo en el celular ocuparía media pantalla. -->
      <MoveIllustration :type="type" decorative class="cart-art mb-3 w-full max-w-[13rem]" />
      <p>Toca los productos para agregarlos.</p>
    </div>

    <ul v-else class="cart-lines -mx-1 flex-1 space-y-2.5 overflow-y-auto px-1">
      <li
        v-for="line in cart.lines.value"
        :key="line.product.id"
        class="glass-inset flex items-center gap-3 rounded-2xl p-3"
      >
        <div class="min-w-0 flex-1">
          <p class="leading-tight font-extrabold break-words text-ink-900">{{ line.product.name }}</p>
          <p class="text-[13px] text-ink-500">
            {{ type === 'OUT' ? 'quedan' : 'quedarán' }}
            {{ stockAfter(type, line.product.quantity, line.quantity) }}
          </p>
        </div>
        <button
          type="button"
          class="stepper"
          :aria-label="`Una ${line.product.name} menos`"
          @click="cart.setQuantity(line.product.id, line.quantity - 1)"
        >
          <Icon name="minus" :size="20" :stroke="2.5" />
        </button>
        <span class="w-6 text-center text-xl font-black text-ink-900 tabular-nums" aria-live="polite">
          {{ line.quantity }}
        </span>
        <button
          type="button"
          class="stepper"
          :disabled="line.quantity >= max(line.product.quantity)"
          :aria-label="`Una ${line.product.name} más`"
          @click="cart.setQuantity(line.product.id, line.quantity + 1)"
        >
          <Icon name="plus" :size="20" :stroke="2.5" />
        </button>
      </li>
    </ul>

    <div class="space-y-3">
      <p class="cart-help text-sm text-ink-500">
        <template v-if="type === 'OUT'">
          Al continuar eliges tu nombre y escribes tu PIN. Si no tocas nada en 60 s, se cancela.
        </template>
        <template v-else>
          ¿Trajiste algo que no está en la lista? Pídele al administrador que lo cree.
        </template>
      </p>
      <div v-if="!cart.isEmpty.value" class="flex items-baseline justify-between">
        <span class="text-ink-500">Total</span>
        <span class="text-xl font-black text-ink-900 tabular-nums lg:text-[22px]">
          {{ total }} {{ total === 1 ? 'producto' : 'productos' }}
        </span>
      </div>
      <button
        type="button"
        class="w-full rounded-[18px]! py-3.5 text-xl! font-black! lg:min-h-16 lg:text-[22px]!"
        :class="colors.button"
        :disabled="cart.isEmpty.value"
        @click="emit('continue')"
      >
        Continuar
        <Icon name="arrowRight" :size="22" :stroke="2.5" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.stepper {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 0.85);
  border: 1px solid var(--color-ink-300);
  color: var(--color-ink-700);
}
.stepper:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
/* Abajo (celular y tablet en vertical): compacto, sin dibujo ni ayuda, y la lista con alto limitado. */
@media (max-width: 1023px), (max-height: 599px) {
  .cart-art,
  .cart-help {
    display: none;
  }
  .cart-lines {
    max-height: 28dvh;
  }
}
</style>
