<script setup lang="ts">
import FridgeLogo from '@/components/brand/FridgeLogo.vue';
import { IonContent, IonFooter, IonItem, IonLabel, IonMenu, IonMenuToggle, IonToolbar } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import Icon, { type IconName } from '@/components/ui/Icon.vue';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Inventario',
    items: [
      { to: '/admin', label: 'Inicio', icon: 'home', exact: true },
      { to: '/admin/productos', label: 'Productos', icon: 'box' },
      { to: '/admin/movimientos', label: 'Movimientos', icon: 'list' },
      { to: '/admin/ranking', label: 'Ranking', icon: 'trophy' },
    ],
  },
  {
    title: 'Dinero',
    items: [
      { to: '/admin/quincenas', label: 'Quincenas', icon: 'wallet' },
      { to: '/admin/compras', label: 'Compras', icon: 'cart' },
      { to: '/admin/reportes', label: 'Reportes', icon: 'chart' },
    ],
  },
  {
    title: 'Acceso',
    items: [
      { to: '/admin/personas', label: 'Personas', icon: 'users' },
      { to: '/admin/tablets', label: 'Tablets', icon: 'tablet' },
      { to: '/admin/administradores', label: 'Administradores', icon: 'lock' },
    ],
  },
];

defineProps<{ contentId: string }>();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

function isActive(item: NavItem): boolean {
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`);
}

function logout() {
  auth.logout();
  void router.replace({ name: 'login' });
}
</script>

<template>
  <IonMenu :content-id="contentId" type="overlay" class="admin-menu">
    <IonContent>
      <div class="flex min-h-full flex-col gap-[22px] px-3.5 pt-[calc(var(--ion-safe-area-top)+20px)] pb-4">
        <!-- Marca: logo + FridgeYA + píldora ADMIN -->
        <div class="flex items-center gap-2.5 px-2">
          <FridgeLogo class="size-9 shrink-0" />
          <span class="text-[22px] font-black tracking-tight text-ink-900"
            >Fridge<span class="text-brand-600">YA</span></span
          >
          <span
            class="ml-auto rounded-full bg-brand-100 px-2 py-1 text-[11px] leading-none font-extrabold tracking-[0.08em] text-brand-700"
          >
            ADMIN
          </span>
        </div>

        <nav aria-label="Administración" class="flex flex-col gap-[22px]">
          <div v-for="section in SECTIONS" :key="section.title" class="flex flex-col gap-0.5">
            <p class="px-3 pb-1.5 text-xs font-extrabold tracking-[0.08em] text-ink-500 uppercase">
              {{ section.title }}
            </p>
            <IonMenuToggle v-for="item in section.items" :key="item.to" :auto-hide="false">
              <IonItem
                :router-link="item.to"
                router-direction="root"
                button
                :detail="false"
                lines="none"
                class="nav-item"
                :class="{ active: isActive(item) }"
                :aria-current="isActive(item) ? 'page' : undefined"
              >
                <span slot="start" class="nav-icon"><Icon :name="item.icon" :size="20" /></span>
                <IonLabel>{{ item.label }}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          </div>
        </nav>
      </div>
    </IonContent>

    <IonFooter v-if="auth.user" class="ion-no-border">
      <IonToolbar>
        <div class="flex flex-col gap-2 px-3.5 pt-2 pb-3.5">
          <IonMenuToggle :auto-hide="false">
            <IonItem
              router-link="/"
              router-direction="root"
              button
              :detail="false"
              lines="none"
              class="nav-item"
            >
              <span slot="start" class="nav-icon"><Icon name="tablet" :size="20" /></span>
              <IonLabel>Volver al modo tablet</IonLabel>
            </IonItem>
          </IonMenuToggle>
          <div class="flex items-center gap-2.5 rounded-[14px] bg-brand-50/90 p-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-[13px] font-extrabold text-white"
              aria-hidden="true"
            >
              {{ initials(auth.user) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-extrabold text-ink-900">{{ auth.user.fullName }}</p>
              <p class="truncate text-xs text-ink-500">{{ auth.user.email }}</p>
            </div>
            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-xl text-ink-700 hover:bg-white/80"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              @click="logout"
            >
              <Icon name="logout" :size="20" />
            </button>
          </div>
        </div>
      </IonToolbar>
    </IonFooter>
  </IonMenu>
</template>

<style scoped>
/* Ítems del menú (mockup): píldora de 44px; el activo, azul claro (brand-100) con texto marino en negrita. */
.nav-item {
  --background: transparent;
  --background-hover: rgb(255 255 255);
  --background-hover-opacity: 0.6;
  --border-radius: 12px;
  --min-height: 44px;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --color: var(--color-ink-700);
  font-size: 15px;
  font-weight: 600;
}
.nav-item.active {
  --background: var(--color-brand-100);
  --color: var(--color-ink-900);
  font-weight: 800;
}
.nav-icon {
  margin-inline-end: 12px;
  color: inherit;
}
.admin-menu ion-footer {
  border-top: 0;
}
</style>

<style>
/* Ancho del menú lateral fijo (270px) cuando está anclado (≥ 992px). */
ion-split-pane {
  --side-min-width: 270px;
  --side-max-width: 270px;
}
</style>
