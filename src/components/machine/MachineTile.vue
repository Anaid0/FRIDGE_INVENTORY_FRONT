<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '@/domain/models';
import { formatMoney } from '@/utils/format';
import ProductArt from './ProductArt.vue';

/**
 * Casilla de un producto en la máquina: dibujo, nombre, precio por unidad (el de la última compra o el de
 * referencia) y lo que queda disponible. Se toca para agregarlo;
 * borde naranja y burbuja: cuántos lleva en el retiro; "AGOTADO" sin stock.
 */
const props = defineProps<{ product: Product; inCart: number; left: number; large?: boolean }>();
defineEmits<{ pick: [] }>();

const soldOut = computed(() => props.product.quantity === 0);
/** Pocas unidades: lo que queda se resalta en naranja oscuro. */
const scarce = computed(() => !soldOut.value && props.left <= Math.max(1, props.product.minStock));
const price = computed(() => (props.product.currentPrice ? formatMoney(props.product.currentPrice) : null));
const label = computed(() =>
  soldOut.value
    ? `${props.product.name}, agotado`
    : `Agregar ${props.product.name}, quedan ${props.left}${price.value ? `, ${price.value} c/u` : ''}`,
);
</script>

<template>
  <button
    type="button"
    class="tile press"
    :class="{ 'is-out': soldOut, 'is-large': large }"
    :aria-label="label"
    @click="$emit('pick')"
  >
    <span v-if="inCart" class="ring" aria-hidden="true" />
    <span v-if="inCart" class="bubble" aria-hidden="true">{{ inCart }}</span>
    <ProductArt :name="product.name" :size="large ? 64 : 34" :dim="soldOut" />
    <span v-if="soldOut" class="sold-out">AGOTADO</span>
    <span class="name">{{ product.name }}</span>
    <span class="foot">
      <span class="price">{{ price ?? 'sin precio' }}</span>
      <span class="left" :class="{ scarce }">{{ soldOut ? 0 : left }} disp.</span>
    </span>
  </button>
</template>

<style scoped>
.tile {
  position: relative;
  height: 112px;
  min-width: 0;
  padding: 5px;
  border-radius: 12px;
  background: rgb(255 255 255 / 0.94);
  color: var(--color-ink-900);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.tile.is-out {
  background: rgb(255 255 255 / 0.55);
}
.ring {
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  border: 2px solid var(--color-accent-500);
  box-shadow: 0 0 0 4px rgb(255 138 31 / 0.35);
  pointer-events: none;
}
.bubble {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-accent-500);
  border: 2px solid var(--color-ink-900);
  color: var(--color-ink-900);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sold-out {
  position: absolute;
  top: 24px;
  left: 4px;
  right: 4px;
  height: 18px;
  border-radius: 5px;
  background: var(--color-ink-900);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.name {
  max-height: 26px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
  hyphens: auto;
  overflow-wrap: anywhere;
}
.is-out .name {
  color: var(--color-ink-500);
}
/* Celular: precio y disponibles uno debajo del otro (en la casilla angosta no caben lado a lado). */
.foot {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}
.price {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  color: var(--color-ink-900);
  white-space: nowrap;
}
.is-out .price {
  color: var(--color-ink-500);
}
.left {
  white-space: nowrap;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-ink-500);
}
.left.scarce {
  font-weight: 800;
  color: var(--color-accent-700);
}

/* Tablet (mockup MaquinaTablet): casillas grandes que llenan el alto de la máquina. */
.tile.is-large {
  height: 100%;
  min-height: 112px;
  padding: 12px;
  border-radius: 16px;
}
.is-large .ring {
  border-radius: 18px;
  border-width: 3px;
}
.is-large .bubble {
  min-width: 28px;
  height: 28px;
  font-size: 14px;
}
.is-large .sold-out {
  top: 44%;
  left: 14px;
  right: 14px;
  height: 24px;
  font-size: 12px;
}
.is-large .name {
  max-height: none;
  font-size: 14px;
}
.is-large .left {
  font-size: 12px;
}
.is-large .foot {
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
}
.is-large .price {
  font-size: 14px;
}
</style>
