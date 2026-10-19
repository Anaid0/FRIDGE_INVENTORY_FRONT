<script setup lang="ts">
import type { KioskCart } from '@/composables/useKioskCart';
import type { MovementType } from '@/domain/models';
import { withUnit } from '@/utils/format';
import Icon from '../ui/Icon.vue';

/** Lo que la persona va a sacar/meter, con +/− por producto y el botón para continuar. */
const props = defineProps<{ cart: KioskCart; type: MovementType }>();
const emit = defineEmits<{ continue: [] }>();

const max = (quantity: number) => (props.type === 'OUT' ? quantity : 99);
</script>

<template>
  <aside class="flex h-full flex-col rounded-2xl bg-white p-4 shadow-sm" aria-label="Lo que elegiste">
    <h2 class="mb-3 text-lg font-bold text-ink-900">{{ type === 'OUT' ? 'Vas a sacar' : 'Vas a meter' }}</h2>

    <p
      v-if="cart.isEmpty.value"
      class="flex flex-1 items-center justify-center px-4 text-center text-ink-500"
    >
      Toca los productos para agregarlos.
    </p>

    <ul v-else class="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
      <li v-for="line in cart.lines.value" :key="line.product.id" class="rounded-xl bg-ink-50 p-3">
        <div class="flex items-start justify-between gap-2">
          <p class="font-semibold text-ink-900">{{ line.product.name }}</p>
          <button
            type="button"
            class="-m-1 rounded-md p-1 text-ink-400"
            :aria-label="`Quitar ${line.product.name}`"
            @click="cart.remove(line.product.id)"
          >
            <Icon name="x" :size="18" />
          </button>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <button
            type="button"
            class="stepper"
            :aria-label="`Una ${line.product.name} menos`"
            @click="cart.setQuantity(line.product.id, line.quantity - 1)"
          >
            <Icon name="minus" :size="20" />
          </button>
          <span class="min-w-8 text-center text-xl font-bold text-ink-900 tabular-nums" aria-live="polite">
            {{ line.quantity }}
          </span>
          <button
            type="button"
            class="stepper"
            :disabled="line.quantity >= max(line.product.quantity)"
            :aria-label="`Una ${line.product.name} más`"
            @click="cart.setQuantity(line.product.id, line.quantity + 1)"
          >
            <Icon name="plus" :size="20" />
          </button>
          <span class="text-sm text-ink-500">{{
            withUnit(line.quantity, line.product.unit).replace(/^\d+ /, '')
          }}</span>
        </div>
      </li>
    </ul>

    <div class="mt-4 space-y-2">
      <button
        type="button"
        class="btn-primary w-full py-4 text-lg"
        :disabled="cart.isEmpty.value"
        @click="emit('continue')"
      >
        Continuar
        <span v-if="!cart.isEmpty.value" class="font-normal">· {{ cart.totalUnits.value }}</span>
      </button>
      <button
        v-if="!cart.isEmpty.value"
        type="button"
        class="w-full py-2 text-sm font-medium text-ink-500"
        @click="cart.clear()"
      >
        Vaciar
      </button>
    </div>
  </aside>
</template>

<style scoped>
.stepper {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: white;
  border: 1px solid var(--color-ink-200);
  color: var(--color-ink-700);
}
.stepper:disabled {
  opacity: 0.4;
}
</style>
