<script setup lang="ts">
import FridgeLogo from '@/components/brand/FridgeLogo.vue';
import { IonContent, IonPage } from '@ionic/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import FormField from '@/components/ui/FormField.vue';
import Icon from '@/components/ui/Icon.vue';
import SpinnerLabel from '@/components/ui/SpinnerLabel.vue';
import { useServerConfig } from '@/services/container';
import { checkServer, normalizeServerUrl } from '@/services/serverConfig';
import { useKioskStore } from '@/stores/kiosk';

/**
 * App Android: la primera vez se indica dónde está el servidor de FridgeYA en la red de la oficina.
 * Se prueba la conexión antes de guardar.
 */
const config = useServerConfig();
const kiosk = useKioskStore();
const router = useRouter();

const address = ref(config.storedUrl()?.replace(/\/api$/, '') ?? '');
const checking = ref(false);
const error = ref<string | null>(null);

async function save() {
  error.value = null;
  const apiUrl = normalizeServerUrl(address.value);
  if (!apiUrl) {
    error.value = 'Escribe una dirección como 192.168.1.50:3000 o https://fridgeya.miempresa.com';
    return;
  }
  checking.value = true;
  try {
    const result = await checkServer(apiUrl);
    if (!result.ok) {
      error.value = result.message;
      return;
    }
    await config.save(apiUrl);
    // Con otro servidor, la autorización de la tablet anterior ya no sirve: se vuelve a comprobar.
    await kiosk.init();
    await router.replace('/');
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="grid min-h-full place-items-center px-4 py-10">
        <div class="w-full max-w-md">
          <div class="mb-6 text-center">
            <FridgeLogo variant="full" class="mx-auto mb-3 size-16" />
            <h1 class="page-title">Conectar con el servidor</h1>
            <p class="mt-1.5 text-[13px] text-ink-500">
              Escribe la dirección del equipo donde corre FridgeYA en la red de la oficina.
            </p>
          </div>

          <form class="card space-y-4 p-5" novalidate @submit.prevent="save">
            <FormField
              id="server-url"
              label="Dirección del servidor"
              hint="Ej.: 192.168.1.50:3000 (IP del servidor y puerto de la API)."
              :error="error ?? undefined"
            >
              <input
                id="server-url"
                v-model="address"
                type="url"
                inputmode="url"
                autocapitalize="off"
                autocomplete="off"
                spellcheck="false"
                class="input py-3 font-mono text-lg font-bold"
                placeholder="192.168.1.50:3000"
                :aria-invalid="Boolean(error)"
              />
            </FormField>
            <button
              type="submit"
              class="btn-primary min-h-[46px] w-full font-display text-[15px] font-black"
              :disabled="checking || !address.trim()"
              :aria-busy="checking"
            >
              <SpinnerLabel :busy="checking" label="Probar y guardar" busy-label="Probando conexión…">
                <template #icon><Icon name="check" :size="18" :stroke="2.4" /></template>
              </SpinnerLabel>
            </button>
            <button
              v-if="config.storedUrl()"
              type="button"
              class="min-h-11 w-full text-sm font-extrabold text-ink-500"
              @click="router.replace('/')"
            >
              Cancelar
            </button>
          </form>
          <p class="mt-3 text-center text-xs text-ink-500">
            La tablet y el servidor deben estar conectados a la misma red Wi-Fi.
          </p>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
