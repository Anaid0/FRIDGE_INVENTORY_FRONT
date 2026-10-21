import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
// Letras de los mockups, empaquetadas (la tablet no necesita internet): Nunito para títulos, Nunito Sans
// para el texto y JetBrains Mono para códigos, PIN y cifras.
import '@fontsource-variable/nunito';
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/jetbrains-mono';
import './assets/main.css';
import { preferencesStore } from './native/keyValueStore';
import { isNative, showSystemBars } from './native/platform';
import { createAppRouter } from './router';
import { provideServerConfig, provideServices } from './services/container';
import { createApiClient } from './services/http/apiClient';
import { createHttpServices } from './services/http/httpServices';
import { createServerConfig, normalizeServerUrl } from './services/serverConfig';
import {
  ADMIN_TOKEN_KEY,
  createLocalTokenStorage,
  createPersistentTokenStorage,
  KIOSK_TOKEN_KEY,
} from './services/tokenStorage';
import { useAuthStore } from './stores/auth';
import { DEVICE_REJECTED_CODES, useKioskStore } from './stores/kiosk';

/**
 * Composition root: aquí se eligen las implementaciones concretas.
 * - Navegador: tokens en localStorage y la API en /api (mismo origen o proxy de Vite).
 * - App Android (Capacitor): tokens y dirección del servidor en Preferences; la dirección se pide la primera vez.
 */
async function bootstrap() {
  const native = isNative();

  const tokens = native
    ? createPersistentTokenStorage(preferencesStore, ADMIN_TOKEN_KEY)
    : createLocalTokenStorage(globalThis.localStorage, ADMIN_TOKEN_KEY);
  const kioskTokens = native
    ? createPersistentTokenStorage(preferencesStore, KIOSK_TOKEN_KEY)
    : createLocalTokenStorage(globalThis.localStorage, KIOSK_TOKEN_KEY);
  const serverConfig = createServerConfig({
    configurable: native,
    store: preferencesStore,
    defaultUrl: import.meta.env.VITE_API_URL ?? '/api',
    presetUrl: normalizeServerUrl(import.meta.env.VITE_NATIVE_API_URL ?? ''),
  });
  await Promise.all([tokens.load(), kioskTokens.load(), serverConfig.load()]);

  // Modo 'md' en todas las plataformas: la misma apariencia en la tablet Android, en iPad y en el navegador.
  const app = createApp(App).use(IonicVue, { mode: 'md' });
  const pinia = createPinia();
  app.use(pinia);
  const router = createAppRouter(() => serverConfig.needsSetup());

  const http = createApiClient({
    baseURL: serverConfig.apiUrl(),
    tokens,
    onUnauthorized: () => {
      // Sesión vencida o usuario desactivado: limpiar y volver al login conservando la ruta.
      useAuthStore(pinia).logout();
      const current = router.currentRoute.value;
      if (current.name !== 'login') {
        void router.replace({ name: 'login', query: { redirect: current.fullPath, expired: '1' } });
      }
    },
  });
  // Cliente de la tablet: su propio token. Solo se descarta si la API rechaza al dispositivo
  // (un PIN incorrecto también responde 401, pero no tiene nada que ver con la tablet).
  const kioskHttp = createApiClient({
    baseURL: serverConfig.apiUrl(),
    tokens: kioskTokens,
    onUnauthorized: (error) => {
      if ((DEVICE_REJECTED_CODES as readonly string[]).includes(error.code)) {
        useKioskStore(pinia).onDeviceRejected(error.code);
      }
    },
  });
  serverConfig.onChange((apiUrl) => {
    http.defaults.baseURL = apiUrl;
    kioskHttp.defaults.baseURL = apiUrl;
  });

  provideServices(createHttpServices(http, kioskHttp), tokens, kioskTokens);
  provideServerConfig(serverConfig);

  app.use(router);
  await router.isReady();
  app.mount('#app');
  if (native) void showSystemBars();
}

void bootstrap();
