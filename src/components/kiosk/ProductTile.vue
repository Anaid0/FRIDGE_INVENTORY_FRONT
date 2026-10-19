<script setup lang="ts">
import { computed } from 'vue';
import type { MovementType, Product } from '@/domain/models';
import { withUnit } from '@/utils/format';
import Icon from '../ui/Icon.vue';
import ProductIcon from '../ui/ProductIcon.vue';
import { isScarce, stockAfter, stockText } from './kioskText';

/**
 * Tarjeta táctil de un producto: se toca para agregar una unidad a la lista.
 * Ya en la lista muestra cuántas lleva (naranja al sacar, verde al meter) y botones −/+.
 * La tarjeta entera es el botón principal; −/+ quedan encima (un botón no puede contener otros).
 */
const props = defineProps<{
  product: Product;
  type: MovementType;
  inCart: number;
  disabled: boolean;
  canAddMore: boolean;
  category?: string | null;
}>();
const emit = defineEmits<{ add: []; decrease: [] }>();

const out = computed(() => props.type === 'OUT');
const stock = computed(() => {
  const { quantity, unit } = props.product;
  if (quantity === 0) return out.value ? 'Agotado' : 'Sin stock';
  if (isScarce(props.product) && !(!out.value && props.inCart))
    return `${quantity === 1 ? 'Queda' : 'Quedan'} ${stockText(quantity, unit)}`;
  return `Hay ${stockText(quantity, unit)}`;
});
const after = computed(() =>
  !out.value && props.inCart ? `quedarán ${stockAfter('IN', props.product.quantity, props.inCart)}` : null,
);
</script>

<template>
  <div
    class="tile relative flex min-h-[156px] flex-col rounded-[20px] p-3.5 transition"
    :class="[
      inCart ? (out ? 'border-accent-500 bg-accent-50/85' : 'border-success-700 bg-success-50/85') : 'glass',
      disabled ? 'opacity-45' : '',
    ]"
  >
    <!-- Botón principal: toda la tarjeta -->
    <button
      type="button"
      class="absolute inset-0 rounded-[18px] transition active:scale-[0.98] disabled:cursor-not-allowed"
      :disabled="disabled"
      :aria-label="`${product.name}: hay ${withUnit(product.quantity, product.unit)}${inCart ? `, llevas ${inCart}` : ''}`"
      @click="emit('add')"
    />

    <!-- Contenido visible (no recibe toques: pasan al botón de abajo) -->
    <div class="pointer-events-none relative flex flex-1 flex-col justify-between gap-3" aria-hidden="true">
      <div class="flex items-start justify-between gap-2">
        <ProductIcon :category="category" size="lg" />
        <span
          v-if="inCart"
          class="grid h-[34px] min-w-[34px] place-items-center rounded-full px-2 text-lg font-black tabular-nums"
          :class="out ? 'bg-accent-500 text-ink-900' : 'bg-success-700 text-white'"
        >
          {{ out ? inCart : `+${inCart}` }}
        </span>
      </div>
    </div>

    <div class="pointer-events-none relative mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-2">
      <div class="min-w-0 flex-[1_1_6.5rem]" aria-hidden="true">
        <p class="text-[19px] leading-tight font-black break-words text-ink-900">{{ product.name }}</p>
        <p
          class="mt-0.5 text-sm"
          :class="
            product.quantity === 0
              ? 'font-extrabold text-danger-700'
              : isScarce(product) && !after
                ? 'font-extrabold text-accent-700'
                : 'text-ink-500'
          "
        >
          {{ stock }}<template v-if="after"> → {{ after }}</template>
        </p>
      </div>
      <div v-if="inCart" class="pointer-events-auto ml-auto flex shrink-0 gap-1.5">
        <button
          type="button"
          class="step"
          :class="out ? 'border-accent-200 text-accent-700' : 'border-success-100 text-success-700'"
          :aria-label="`Quitar una ${product.name}`"
          @click="emit('decrease')"
        >
          <Icon name="minus" :size="20" :stroke="2.75" />
        </button>
        <button
          type="button"
          class="step border-transparent"
          :class="out ? 'bg-accent-500! text-ink-900' : 'bg-success-700! text-white'"
          :disabled="!canAddMore"
          :aria-label="`Agregar otra ${product.name}`"
          @click="emit('add')"
        >
          <Icon name="plus" :size="20" :stroke="2.75" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sin estilos en capa: gana al borde de 1px de `glass` (así la tarjeta no salta al seleccionarla). */
.tile {
  border-width: 2px;
  border-style: solid;
}
.step {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  border-width: 1px;
  border-style: solid;
  background: rgb(255 255 255 / 0.85);
  transition: transform 0.1s;
}
.step:active:not(:disabled) {
  transform: scale(0.94);
}
.step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
@media (prefers-reduced-motion: reduce) {
  .step,
  .tile button {
    transition: none;
  }
}
</style>
