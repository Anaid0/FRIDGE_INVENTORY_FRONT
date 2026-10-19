<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import FormField from '@/components/ui/FormField.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { KioskDevice } from '@/domain/models';
import AdminPage from '@/layouts/AdminPage.vue';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useKioskStore } from '@/stores/kiosk';
import { useToastStore } from '@/stores/toasts';
import { formatDateTime, formatRelative, fullName } from '@/utils/format';

const { kioskAdmin } = useServices();
const toasts = useToastStore();

const auth = useAuthStore();
const kiosk = useKioskStore();
const route = useRoute();
const router = useRouter();

const { data, error, loading, run } = useAsync(() => kioskAdmin.listDevices());

// --- Autorizar ESTE dispositivo como tablet ---
const pairOpen = ref(false);
const pairName = ref('Tablet de la cocina');
const pairing = ref(false);
const pairError = ref<string | null>(null);

useOnEnter(async () => {
  await run();
  if (kiosk.status === 'loading') await kiosk.init();
  // Desde la tablet sin autorizar se llega con ?autorizar=1: se abre el diálogo directamente.
  if (route.query.autorizar === '1' && !kiosk.isPaired) pairOpen.value = true;
});

async function pairThisDevice() {
  pairing.value = true;
  pairError.value = null;
  try {
    const { device, token } = await kioskAdmin.pair(pairName.value);
    await kiosk.adopt(token, device);
    pairOpen.value = false;
    toasts.success(`"${device.name}" autorizada. Ya se puede usar como tablet.`);
    // En una tablet compartida no debe quedar abierta la sesión del administrador.
    auth.logout();
    await router.replace('/');
  } catch (e) {
    pairError.value = errorMessage(e);
  } finally {
    pairing.value = false;
  }
}

const confirmUnpair = ref(false);
function unpairThisDevice() {
  kiosk.unpair();
  confirmUnpair.value = false;
  toasts.info('Este dispositivo ya no funciona como tablet.');
}

const revoking = ref<KioskDevice | null>(null);
const busy = ref(false);
async function revoke() {
  if (!revoking.value) return;
  busy.value = true;
  try {
    const device = await kioskAdmin.revoke(revoking.value.id);
    if (device.id === kiosk.device?.id) kiosk.onDeviceRejected('DEVICE_REVOKED');
    toasts.success(`"${device.name}" ya no tiene acceso.`);
    revoking.value = null;
    await run();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AdminPage title="Tablets">
    <section>
      <PageHeader
        title="Tablets"
        subtitle="Dispositivos autorizados para registrar lo que se saca y se mete con nombre + PIN."
      />

      <div
        class="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-ink-700"
      >
        <span class="text-brand-700"><Icon name="tablet" /></span>
        <p>
          Para autorizar una tablet, abre FridgeYA en ella, entra a la administración con tu cuenta y elige
          <strong>“Usar este dispositivo como tablet”</strong>. Si una tablet se pierde, revócala aquí: deja
          de tener acceso al instante.
        </p>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="card overflow-hidden transition-opacity" :class="{ 'opacity-60': loading && data }">
        <EmptyState v-if="data && !data.length" icon="tablet" title="No hay tablets autorizadas" />
        <ul v-else class="divide-y divide-ink-100">
          <li
            v-for="device in data ?? []"
            :key="device.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="font-semibold" :class="device.isActive ? 'text-ink-900' : 'text-ink-400'">
                  {{ device.name }}
                </p>
                <Badge :tone="device.isActive ? 'brand' : 'neutral'">{{
                  device.isActive ? 'Autorizada' : 'Revocada'
                }}</Badge>
                <Badge v-if="device.id === kiosk.device?.id" tone="info">Este dispositivo</Badge>
              </div>
              <p class="mt-0.5 text-xs text-ink-500">
                Autorizada {{ formatDateTime(device.createdAt) }}
                <span v-if="device.createdBy"> por {{ fullName(device.createdBy) }}</span>
                ·
                <span v-if="device.revokedAt">revocada {{ formatDateTime(device.revokedAt) }}</span>
                <span v-else-if="device.lastSeenAt"
                  >última conexión {{ formatRelative(device.lastSeenAt) }}</span
                >
                <span v-else>aún sin conexiones</span>
              </p>
            </div>
            <button
              v-if="device.isActive"
              type="button"
              class="btn-secondary px-3 py-1.5 text-danger-700"
              @click="revoking = device"
            >
              Revocar
            </button>
          </li>
        </ul>
      </div>

      <BaseDialog
        :open="pairOpen"
        title="Usar este dispositivo como tablet"
        description="La tablet guardará una llave propia. Al terminar se cerrará tu sesión de administrador en este dispositivo."
        @close="pairOpen = false"
      >
        <form class="space-y-4" novalidate @submit.prevent="pairThisDevice">
          <p v-if="pairError" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
            {{ pairError }}
          </p>
          <FormField
            id="tb-name"
            label="Nombre de la tablet"
            hint="Para reconocerla en la lista, p. ej. “Tablet cocina”."
          >
            <input id="tb-name" v-model="pairName" type="text" maxlength="60" class="input" />
          </FormField>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn-secondary" :disabled="pairing" @click="pairOpen = false">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" :disabled="pairing || !pairName.trim()">
              {{ pairing ? 'Autorizando…' : 'Autorizar' }}
            </button>
          </div>
        </form>
      </BaseDialog>
      <ConfirmDialog
        :open="confirmUnpair"
        title="Desvincular este dispositivo"
        message="Dejará de funcionar como tablet (la autorización sigue en la lista hasta que la revoques)."
        confirm-label="Desvincular"
        @confirm="unpairThisDevice"
        @close="confirmUnpair = false"
      />
      <ConfirmDialog
        :open="revoking !== null"
        title="Revocar tablet"
        :message="`“${revoking?.name ?? ''}” dejará de poder registrar movimientos de inmediato. Para volver a usarla habrá que autorizarla de nuevo.`"
        confirm-label="Revocar"
        danger
        :loading="busy"
        @confirm="revoke"
        @close="revoking = null"
      />
    </section>
  </AdminPage>
</template>
