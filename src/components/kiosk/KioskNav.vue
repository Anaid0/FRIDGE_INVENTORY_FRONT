<script setup lang="ts">
import FridgeLogo from '../brand/FridgeLogo.vue';
import Icon, { type IconName } from '../ui/Icon.vue';

export type KioskTab = 'OUT' | 'IN' | 'ranking' | 'log';

/**
 * Navegación de la tablet: barra vertical a la izquierda (tablet) o barra de pestañas abajo (celular).
 * Cada pestaña se resalta con su color: Sacar naranja, Meter verde, Ranking e Historial azul.
 */
defineProps<{ tab: KioskTab }>();
const emit = defineEmits<{ select: [tab: KioskTab]; admin: [] }>();

const ITEMS: { value: KioskTab; label: string; icon: IconName; active: string }[] = [
  { value: 'OUT', label: 'Sacar', icon: 'takeOut', active: 'bg-accent-100 text-accent-700' },
  { value: 'IN', label: 'Meter', icon: 'putIn', active: 'bg-success-50 text-success-700' },
  { value: 'ranking', label: 'Ranking', icon: 'trophy', active: 'bg-brand-100 text-brand-700' },
  { value: 'log', label: 'Historial', icon: 'list', active: 'bg-brand-100 text-brand-700' },
];
</script>

<template>
  <nav class="kiosk-nav glass-strong font-sans" aria-label="Tablet">
    <FridgeLogo class="nav-logo size-[52px] shrink-0" />
    <div class="nav-items" role="tablist">
      <button
        v-for="item in ITEMS"
        :key="item.value"
        type="button"
        role="tab"
        class="nav-item"
        :class="tab === item.value ? item.active : 'text-ink-700 hover:bg-white/60'"
        :aria-selected="tab === item.value"
        @click="emit('select', item.value)"
      >
        <Icon :name="item.icon" :size="26" :stroke="2" />
        <span>{{ item.label }}</span>
      </button>
    </div>
    <button
      type="button"
      class="nav-admin glass-inset text-ink-500 hover:text-ink-900"
      aria-label="Administración"
      title="Administración"
      @click="emit('admin')"
    >
      <Icon name="lock" :size="22" />
    </button>
  </nav>
</template>

<style scoped>
/* Celular: barra de pestañas abajo, por encima de los botones de navegación del sistema. */
.kiosk-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  border-radius: 0;
  border-width: 1px 0 0;
  padding: 0.375rem calc(0.5rem + var(--ion-safe-area-right)) calc(0.375rem + var(--ion-safe-area-bottom))
    calc(0.5rem + var(--ion-safe-area-left));
  z-index: 10;
}
.nav-logo {
  display: none;
}
.nav-items {
  display: flex;
  flex: 1;
  gap: 0.25rem;
}
.nav-item {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 3.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 1rem;
  font-size: 0.8125rem;
  font-weight: 800;
  transition: background-color 0.15s;
}
.nav-admin {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 1rem;
}

/* Tablet: barra vertical a la izquierda. */
@media (min-width: 768px) {
  .kiosk-nav {
    flex-direction: column;
    gap: 0.625rem;
    width: calc(104px + var(--ion-safe-area-left));
    border-width: 0 1px 0 0;
    padding: calc(1.25rem + var(--ion-safe-area-top)) 0.75rem calc(1.25rem + var(--ion-safe-area-bottom))
      calc(0.75rem + var(--ion-safe-area-left));
    overflow-y: auto;
  }
  .nav-logo {
    display: block;
    margin-bottom: 0.875rem;
  }
  .nav-items {
    flex: none;
    flex-direction: column;
    gap: 0.625rem;
  }
  .nav-item {
    flex: none;
    width: 5rem;
    height: 5.25rem;
    gap: 0.375rem;
    border-radius: 1.25rem;
    font-size: 0.875rem;
  }
  .nav-admin {
    margin-top: auto;
    width: 3.25rem;
    height: 3.25rem;
  }
}
/* Tablet o celular en horizontal con poco alto: más compacta. */
@media (min-width: 768px) and (max-height: 600px) {
  .nav-logo {
    display: none;
  }
  .nav-item {
    height: 4rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-item {
    transition: none;
  }
}
</style>
