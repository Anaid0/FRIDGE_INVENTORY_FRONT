<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon, { type IconName } from '@/components/ui/Icon.vue';

/**
 * Barra de pestañas flotante de la administración (mockups): Inicio, Productos, Movimientos, Quincena y
 * Más (ranking, compras, reportes, personas, tablets y administradores).
 */
interface Tab {
  to: string;
  label: string;
  icon: IconName;
  /** Rutas que cuentan como esta pestaña. */
  match: (path: string) => boolean;
}

const startsWith = (...prefixes: string[]) => (path: string) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const TABS: Tab[] = [
  { to: '/admin', label: 'Inicio', icon: 'navHome', match: (p) => p === '/admin' || p === '/admin/ingresar' },
  { to: '/admin/productos', label: 'Productos', icon: 'navBox', match: startsWith('/admin/productos') },
  { to: '/admin/movimientos', label: 'Movimientos', icon: 'navSwap', match: startsWith('/admin/movimientos') },
  {
    to: '/admin/quincenas/actual',
    label: 'Quincena',
    icon: 'navWallet',
    match: startsWith('/admin/quincenas', '/admin/compras/nueva'),
  },
  { to: '/admin/mas', label: 'Más', icon: 'more', match: () => false },
];

const route = useRoute();
const router = useRouter();
const active = computed(() => TABS.find((t) => t.match(route.path)) ?? TABS[TABS.length - 1]);

function go(tab: Tab) {
  if (route.path !== tab.to) void router.push(tab.to);
}
</script>

<template>
  <nav class="admin-tabs font-sans" aria-label="Administración">
    <a
      v-for="tab in TABS"
      :key="tab.to"
      :href="tab.to"
      class="tab"
      :class="{ active: active === tab }"
      :aria-current="active === tab ? 'page' : undefined"
      @click.prevent="go(tab)"
    >
      <Icon :name="tab.icon" :size="20" :stroke="tab.icon === 'more' ? 3 : 2.2" />
      {{ tab.label }}
    </a>
  </nav>
</template>

<style scoped>
.admin-tabs {
  position: fixed;
  z-index: 20;
  left: calc(12px + var(--ion-safe-area-left));
  right: calc(12px + var(--ion-safe-area-right));
  bottom: calc(22px + var(--ion-safe-area-bottom));
  max-width: 560px;
  margin-inline: auto;
  height: 62px;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  border-radius: 22px;
  background: rgb(255 255 255 / 0.74);
  border: 1px solid rgb(255 255 255 / 0.95);
  box-shadow: 0 12px 30px rgb(7 59 94 / 0.18);
  -webkit-backdrop-filter: blur(22px) saturate(170%);
  backdrop-filter: blur(22px) saturate(170%);
}
.tab {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 16px;
  color: var(--color-ink-500);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  transition: background-color 0.15s;
}
.tab:hover {
  background: rgb(255 255 255 / 0.6);
}
.tab.active {
  background: var(--color-ink-900);
  color: #fff;
  font-weight: 800;
}
@media (prefers-reduced-motion: reduce) {
  .tab {
    transition: none;
  }
}
</style>
