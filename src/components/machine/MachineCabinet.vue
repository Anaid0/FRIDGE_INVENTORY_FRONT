<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '@/domain/models';
import MachineTile from './MachineTile.vue';

/**
 * El mueble de la máquina expendedora (mockups Main y MaquinaTablet): vitrina azul marino con los
 * productos en filas de 4 separadas por repisas y, abajo, la bandeja "RETIRA AQUÍ" con el mono saludando.
 */
const props = defineProps<{
  products: Product[];
  inCart: (productId: string) => number;
  left: (product: Product) => number;
  large?: boolean;
  /** Texto cuando no hay productos que mostrar (p. ej. la búsqueda no encontró nada). */
  emptyText?: string;
}>();
defineEmits<{ pick: [product: Product] }>();

const PER_ROW = 4;
const rows = computed(() => {
  const out: Product[][] = [];
  for (let i = 0; i < props.products.length; i += PER_ROW) out.push(props.products.slice(i, i + PER_ROW));
  return out;
});
</script>

<template>
  <section class="cabinet" :class="{ 'is-large': large }" aria-label="Máquina de productos">
    <slot name="top" />
    <div class="glass-front">
      <div class="shelves">
        <template v-for="(row, i) in rows" :key="i">
          <div class="row">
            <MachineTile
              v-for="product in row"
              :key="product.id"
              :product="product"
              :in-cart="inCart(product.id)"
              :left="left(product)"
              :large="large"
              @pick="$emit('pick', product)"
            />
          </div>
          <div class="shelf" aria-hidden="true" />
        </template>
        <p v-if="!products.length" class="empty" role="status">
          {{ emptyText ?? 'Todavía no hay productos en la máquina.' }}
        </p>
      </div>
    </div>
    <div class="tray">
      <svg class="tray-monkey" viewBox="0 0 220 186" aria-hidden="true">
        <circle cx="40" cy="96" r="24" fill="#0b79c3" />
        <circle cx="40" cy="96" r="11" fill="#ffffff" />
        <circle cx="184" cy="96" r="24" fill="#0b79c3" />
        <circle cx="184" cy="96" r="11" fill="#ffffff" />
        <circle cx="112" cy="100" r="74" fill="#0b79c3" />
        <circle cx="90" cy="90" r="28" fill="#ffffff" />
        <circle cx="134" cy="90" r="28" fill="#ffffff" />
        <ellipse cx="112" cy="128" rx="40" ry="32" fill="#ffffff" />
        <circle cx="96" cy="88" r="10" fill="#073b5e" />
        <circle cx="140" cy="88" r="10" fill="#073b5e" />
        <circle cx="99" cy="85" r="3" fill="#ffffff" />
        <circle cx="143" cy="85" r="3" fill="#ffffff" />
        <path d="M94 130 Q112 146 130 130" stroke="#0b79c3" stroke-width="6" fill="none" stroke-linecap="round" />
        <g class="wave">
          <path d="M170 170 Q196 160 214 140" stroke="#0b79c3" stroke-width="20" fill="none" stroke-linecap="round" />
          <circle cx="214" cy="138" r="13" fill="#0b79c3" />
        </g>
      </svg>
      <span class="tray-label">RETIRA AQUÍ</span>
    </div>
  </section>
</template>

<style scoped>
.cabinet {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 6px;
  padding: 7px;
  border-radius: 22px;
  background: linear-gradient(180deg, #0a4a75 0%, #073b5e 60%, #06304d 100%);
  box-shadow:
    0 12px 30px rgb(7 59 94 / 0.28),
    inset 0 1px 0 rgb(255 255 255 / 0.18);
}
.glass-front {
  /* Si el mueble se estira (celular alto), la vitrina ocupa el espacio y la bandeja queda abajo. */
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 16px;
  padding: 7px 7px 5px;
  background: rgb(255 255 255 / 0.1);
  border: 1px solid rgb(255 255 255 / 0.16);
  overflow-y: auto;
  scrollbar-width: none;
}
.glass-front::-webkit-scrollbar {
  display: none;
}
.shelves {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.shelf {
  height: 4px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.22);
}
.empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #9fd3f5;
  font-weight: 700;
}
.tray {
  position: relative;
  flex-shrink: 0;
  height: 46px;
  border-radius: 14px;
  background: rgb(0 0 0 / 0.3);
  border: 1px solid rgb(255 255 255 / 0.12);
  box-shadow: inset 0 6px 12px rgb(0 0 0 / 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tray-monkey {
  position: absolute;
  left: 6px;
  bottom: 0;
  width: 66px;
  height: 56px;
}
.wave {
  transform-box: view-box;
  transform-origin: 170px 170px;
  animation: wave 3.2s ease-in-out infinite;
}
@keyframes wave {
  0%,
  70%,
  100% {
    transform: rotate(0);
  }
  78% {
    transform: rotate(-14deg);
  }
  86% {
    transform: rotate(8deg);
  }
  94% {
    transform: rotate(-10deg);
  }
}
.tray-label {
  padding-left: 40px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #9fd3f5;
}

/* Tablet en horizontal: vitrina alta, cabecera dentro del mueble y bandeja más grande. */
.cabinet.is-large {
  gap: 14px;
  padding: 18px;
  border-radius: 28px;
}
.is-large .glass-front {
  flex: 1;
  padding: 12px 12px 8px;
  border-radius: 18px;
}
.is-large .shelves {
  min-height: 100%;
  gap: 8px;
}
.is-large .row {
  flex: 1;
  gap: 12px;
}
.is-large .shelf {
  height: 5px;
}
.is-large .tray {
  height: 96px;
  border-radius: 18px;
}
.is-large .tray-monkey {
  left: 20px;
  width: 120px;
  height: 100px;
}
.is-large .tray-label {
  padding-left: 0;
  font-size: 12px;
  letter-spacing: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .wave {
    animation: none;
  }
}
</style>
