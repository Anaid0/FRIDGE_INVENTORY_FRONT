<script setup lang="ts">
import type { MovementType, Product } from '@/domain/models';
import { withUnit } from '@/utils/format';

/** Tarjeta táctil de un producto: se toca para agregar una unidad a la lista. */
defineProps<{ product: Product; type: MovementType; inCart: number; disabled: boolean }>();
const emit = defineEmits<{ add: [] }>();
</script>

<template>
  <button
    type="button"
    class="relative flex min-h-32 flex-col justify-between rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
    :class="inCart ? 'border-brand-600 bg-brand-50' : 'border-transparent'"
    :disabled="disabled"
    :aria-label="`${product.name}: hay ${withUnit(product.quantity, product.unit)}${inCart ? `, llevas ${inCart}` : ''}`"
    @click="emit('add')"
  >
    <span class="text-lg leading-tight font-semibold text-ink-900">{{ product.name }}</span>
    <span class="mt-3 flex items-end justify-between gap-2">
      <span
        class="text-sm"
        :class="
          product.quantity === 0
            ? 'text-danger-700'
            : product.isLowStock
              ? 'text-warning-700'
              : 'text-ink-500'
        "
      >
        {{
          product.quantity === 0
            ? type === 'OUT'
              ? 'Agotado'
              : 'Sin stock'
            : `Hay ${withUnit(product.quantity, product.unit)}`
        }}
      </span>
    </span>
    <span
      v-if="inCart"
      class="absolute -top-2.5 -right-2.5 grid size-9 place-items-center rounded-full bg-brand-700 text-base font-bold text-white shadow"
      aria-hidden="true"
    >
      {{ inCart }}
    </span>
  </button>
</template>
