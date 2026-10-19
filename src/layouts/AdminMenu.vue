<script setup lang="ts">
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonToolbar,
} from '@ionic/vue';
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

const SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
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
  <IonMenu :content-id="contentId" type="overlay">
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="flex items-center gap-2 px-4 py-2">
          <img src="/favicon.svg" alt="" class="size-7" />
          <span class="text-lg font-bold tracking-tight text-ink-900"
            >Fridge<span class="text-brand-700">YA</span></span
          >
          <span
            class="ml-1 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-600 uppercase"
          >
            Admin
          </span>
        </div>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <nav aria-label="Administración">
        <IonList v-for="(section, i) in SECTIONS" :key="i" lines="none" class="py-1">
          <p
            v-if="section.title"
            class="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase"
          >
            {{ section.title }}
          </p>
          <IonMenuToggle v-for="item in section.items" :key="item.to" :auto-hide="false">
            <IonItem
              :router-link="item.to"
              router-direction="root"
              button
              :detail="false"
              class="nav-item"
              :class="{ active: isActive(item) }"
              :aria-current="isActive(item) ? 'page' : undefined"
            >
              <span slot="start" class="text-ink-500"><Icon :name="item.icon" /></span>
              <IonLabel>{{ item.label }}</IonLabel>
            </IonItem>
          </IonMenuToggle>
        </IonList>
      </nav>
    </IonContent>
    <IonFooter v-if="auth.user">
      <IonToolbar>
        <div class="flex items-center gap-3 px-4 py-2">
          <span
            class="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
          >
            {{ initials(auth.user) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink-900">{{ auth.user.fullName }}</p>
            <p class="truncate text-xs text-ink-500">{{ auth.user.email }}</p>
          </div>
          <button
            type="button"
            class="rounded-md p-2 text-ink-500 hover:bg-ink-100"
            aria-label="Cerrar sesión"
            @click="logout"
          >
            <Icon name="logout" />
          </button>
        </div>
        <IonMenuToggle :auto-hide="false">
          <IonItem
            router-link="/"
            router-direction="root"
            button
            :detail="false"
            lines="none"
            class="nav-item"
          >
            <span slot="start" class="text-ink-500"><Icon name="tablet" /></span>
            <IonLabel>Volver al modo tablet</IonLabel>
          </IonItem>
        </IonMenuToggle>
      </IonToolbar>
    </IonFooter>
  </IonMenu>
</template>

<style scoped>
.nav-item {
  --border-radius: 0.5rem;
  --min-height: 42px;
  --color: var(--color-ink-600);
  margin: 2px 10px;
  font-size: 0.9rem;
  font-weight: 500;
}
.nav-item.active {
  --background: var(--color-brand-50);
  --color: var(--color-brand-800);
}
.nav-item.active span {
  color: var(--color-brand-700);
}
</style>
