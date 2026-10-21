<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ToastHost from '@/components/ui/ToastHost.vue';
import AdminTabBar from '@/layouts/AdminTabBar.vue';
import { useIdle } from '@/composables/useIdle';
import { keepScreenOn } from '@/native/platform';
import { useAuthStore } from '@/stores/auth';
import { useKioskStore } from '@/stores/kiosk';
import { useStatsStore } from '@/stores/stats';

const auth = useAuthStore();
const stats = useStatsStore();
const route = useRoute();
const router = useRouter();
const kiosk = useKioskStore();

/** La barra de pestañas solo existe en la administración con sesión (la máquina usa pantalla completa). */
const showTabs = computed(
  () => auth.isAuthenticated && route.meta.layout === 'admin' && route.meta.tabs !== false,
);

// "Quién más retira" siempre al día: al entrar, cada minuto y tras cada movimiento (lo refrescan los diálogos).
const REFRESH_MS = 60_000;
let timer: ReturnType<typeof setInterval> | undefined;
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    clearInterval(timer);
    if (!authenticated) return;
    void stats.refresh();
    timer = setInterval(() => void stats.refresh(), REFRESH_MS);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));

// Mientras el dispositivo funciona como tablet, la pantalla no se apaga (solo en la app Android).
watch(
  () => kiosk.isPaired,
  (paired) => void keepScreenOn(paired),
  { immediate: true },
);

// En una tablet compartida la sesión de administrador no queda abierta: tras 5 min sin uso se cierra
// y la tablet vuelve a su pantalla.
const ADMIN_IDLE_MS = 5 * 60_000;
useIdle(
  ADMIN_IDLE_MS,
  () => {
    auth.logout();
    void router.replace('/');
  },
  () => auth.isAuthenticated && kiosk.hasToken(),
);
</script>

<template>
  <IonApp>
    <IonRouterOutlet id="main" />
    <!-- Detrás de la barra de estado de Android: lo que se desplaza no queda debajo de la hora y los íconos. -->
    <div class="status-bar-scrim" aria-hidden="true" />
    <AdminTabBar v-if="showTabs" />
    <ToastHost />
  </IonApp>
</template>
