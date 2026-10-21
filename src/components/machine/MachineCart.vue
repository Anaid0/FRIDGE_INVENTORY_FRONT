<script setup lang="ts">
import type { CartLine } from '@/composables/useKioskCart';

/**
 * "Tu retiro" (mockup Main): lo elegido como fichas (cantidad × nombre, con ×) y cuánto lleva.
 * - Tablet: el teclado está al lado, así que basta escribir el PIN ("falta tu PIN").
 * - Celular (`withdraw`): botón "Retirar · N" que lleva al paso del PIN.
 */
defineProps<{ lines: CartLine[]; total: number; large?: boolean; withdraw?: boolean }>();
const emit = defineEmits<{ remove: [productId: string]; withdraw: [] }>();
</script>

<template>
  <section class="cart" :class="{ 'is-large': large }" aria-label="Tu retiro">
    <div v-if="large" class="cart-head">
      <span>TU RETIRO</span>
      <span v-if="total" class="text-ink-900">{{ total }} {{ total === 1 ? 'producto' : 'productos' }}</span>
    </div>
    <template v-if="lines.length">
      <div class="chips" data-no-swipe>
        <span v-for="line in lines" :key="line.product.id" class="chip">
          <span class="n">{{ line.quantity }}×</span>{{ line.product.name }}
          <button
            type="button"
            class="x"
            :aria-label="`Quitar ${line.product.name} del retiro`"
            @click="emit('remove', line.product.id)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      </div>
      <button v-if="withdraw" type="button" class="withdraw press" @click="emit('withdraw')">
        Retirar · {{ total }}
      </button>
      <span v-else class="pending">{{ total }} · falta tu PIN</span>
    </template>
    <span v-else class="empty">Tu retiro está vacío · toca lo que vas a llevar</span>
  </section>
</template>

<style scoped>
.cart {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 5px 5px 8px;
  border-radius: 16px;
  background: rgb(255 255 255 / 0.62);
  border: 1px solid rgb(255 255 255 / 0.9);
  box-shadow: 0 6px 18px rgb(7 59 94 / 0.08);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}
.chips {
  display: flex;
  min-width: 0;
  flex-grow: 1;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  flex-shrink: 0;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px 0 9px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--color-accent-200);
  color: var(--color-ink-900);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.n {
  font-family: var(--font-mono);
  color: var(--color-accent-700);
}
.x {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-ink-500);
}
.withdraw {
  flex-shrink: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--color-accent-500);
  color: var(--color-ink-900);
  box-shadow: 0 4px 12px rgb(255 138 31 / 0.35);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 900;
}
.pending {
  flex-shrink: 0;
  padding-right: 6px;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-success-700);
}
.empty {
  padding: 0 4px;
  font-size: 12px;
  color: var(--color-ink-500);
}

/* Tablet: tarjeta con título, fichas que pasan de línea y botón ancho. */
.cart.is-large {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 14px;
  border-radius: 22px;
}
.cart-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: var(--color-ink-500);
}
.is-large .chips {
  flex-wrap: wrap;
  overflow: visible;
}
.is-large .empty {
  padding: 4px 0;
  font-size: 13px;
}
</style>
