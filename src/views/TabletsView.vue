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
import SkeletonRows from '@/components/ui/SkeletonRows.vue';
import SpinnerLabel from '@/components/ui/SpinnerLabel.vue';
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
      <PageHeader title="Tablets" back="/admin/mas" subtitle="Dispositivos que funcionan como la máquina" />

      <div
        class="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-5"
      >
        <div class="flex flex-col gap-2.5">
          <ErrorState v-if="error && !data" :message="error" @retry="run" />
          <SkeletonRows v-else-if="!data" :rows="3" label="Cargando tablets" />
          <EmptyState
            v-else-if="!data.length"
            card
            title="No hay tablets autorizadas"
            message="Autoriza este dispositivo o abre FridgeYA en la tablet de la cocina."
          />
          <ul
            v-else
            class="card flex flex-col divide-y divide-ink-900/8 px-3.5 py-1 transition-opacity"
            :class="{ 'opacity-60': loading }"
            aria-label="Tablets autorizadas"
          >
            <li
              v-for="device in data"
              :key="device.id"
              class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-xl"
                :class="device.isActive ? 'bg-brand-100 text-brand-700' : 'bg-ink-900/6 text-ink-400'"
                aria-hidden="true"
              >
                <Icon name="tablet" :size="20" :stroke="2" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <p
                    class="truncate font-display text-[15px] font-black"
                    :class="device.isActive ? 'text-ink-900' : 'text-ink-400'"
                  >
                    {{ device.name }}
                  </p>
                  <Badge size="sm" :tone="device.isActive ? 'success' : 'neutral'">{{
                    device.isActive ? 'Autorizada' : 'Revocada'
                  }}</Badge>
                  <Badge v-if="device.id === kiosk.device?.id" size="sm" tone="brand">Este dispositivo</Badge>
                </div>
                <p class="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                  <Icon name="clock" :size="12" :stroke="2" />
                  <span v-if="device.revokedAt">Revocada {{ formatDateTime(device.revokedAt) }}</span>
                  <span v-else-if="device.lastSeenAt"
                    >Última conexión {{ formatRelative(device.lastSeenAt) }}</span
                  >
                  <span v-else>Aún sin conexiones</span>
                </p>
                <p class="text-xs text-ink-500">
                  Autorizada {{ formatDateTime(device.createdAt) }}
                  <span v-if="device.createdBy"> por {{ fullName(device.createdBy) }}</span>
                </p>
              </div>
              <button
                v-if="device.isActive"
                type="button"
                class="min-h-10 shrink-0 rounded-xl border border-danger-200 bg-white/80 px-3.5 text-xs font-extrabold text-danger-700 hover:bg-danger-50"
                :aria-label="`Revocar ${device.name}`"
                @click="revoking = device"
              >
                Revocar
              </button>
            </li>
          </ul>
        </div>

        <aside class="order-first flex flex-col gap-2.5 lg:order-none">
          <!-- Este dispositivo -->
          <div class="card flex flex-col gap-2.5 p-3.5">
            <div class="flex items-center gap-2.5">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-white"
                aria-hidden="true"
              >
                <Icon name="monitor" :size="20" :stroke="2" />
              </span>
              <div class="min-w-0">
                <h2 class="section-title">Este dispositivo</h2>
                <p class="text-xs text-ink-500">
                  <template v-if="kiosk.isPaired">Funciona como tablet «{{ kiosk.device?.name }}».</template>
                  <template v-else>Todavía no funciona como tablet.</template>
                </p>
              </div>
            </div>
            <button
              v-if="kiosk.isPaired"
              type="button"
              class="btn-secondary min-h-11"
              @click="confirmUnpair = true"
            >
              Desvincular este dispositivo
            </button>
            <button v-else type="button" class="btn-primary min-h-11" @click="pairOpen = true">
              <Icon name="tablet" :size="16" :stroke="2" /> Usar este dispositivo como tablet
            </button>
          </div>

          <div
            class="flex items-start gap-2.5 rounded-[18px] border border-white/85 bg-white/50 p-3.5 text-[13px] text-ink-700"
          >
            <span class="mt-0.5 text-brand-700"><Icon name="shield" :size="18" :stroke="2" /></span>
            <p>
              Para autorizar una tablet, abre FridgeYA en ella, entra a la administración y elige
              <strong class="text-ink-900">“Usar este dispositivo como tablet”</strong>. Si una tablet se
              pierde, revócala aquí: deja de tener acceso al instante.
            </p>
          </div>
        </aside>
      </div>

      <BaseDialog
        :open="pairOpen"
        title="Usar este dispositivo como tablet"
        description="La tablet guardará una llave propia. Al terminar se cerrará tu sesión de administrador en este dispositivo."
        @close="pairOpen = false"
      >
        <form class="space-y-4" novalidate @submit.prevent="pairThisDevice">
          <p
            v-if="pairError"
            class="rounded-[14px] border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger-700"
            role="alert"
          >
            {{ pairError }}
          </p>
          <FormField
            id="tb-name"
            label="Nombre de la tablet"
            hint="Para reconocerla en la lista, p. ej. “Tablet cocina”."
          >
            <input id="tb-name" v-model="pairName" type="text" maxlength="60" class="input" />
          </FormField>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              class="btn-secondary min-h-11"
              :disabled="pairing"
              @click="pairOpen = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="btn-primary min-h-11"
              :disabled="pairing || !pairName.trim()"
              :aria-busy="pairing"
            >
              <SpinnerLabel :busy="pairing" label="Autorizar" busy-label="Autorizando…" :size="16" />
            </button>
          </div>
        </form>
      </BaseDialog>
      <ConfirmDialog
        :open="confirmUnpair"
        title="¿Desvincular este dispositivo?"
        message="Dejará de funcionar como tablet (la autorización sigue en la lista hasta que la revoques)."
        confirm-label="Desvincular"
        @confirm="unpairThisDevice"
        @close="confirmUnpair = false"
      />
      <ConfirmDialog
        :open="revoking !== null"
        :title="`¿Revocar «${revoking?.name ?? ''}»?`"
        :message="`Dejará de poder registrar movimientos de inmediato. Para volver a usarla habrá que autorizarla de nuevo.`"
        confirm-label="Revocar tablet"
        loading-label="Revocando…"
        danger
        :loading="busy"
        @confirm="revoke"
        @close="revoking = null"
      />
    </section>
  </AdminPage>
</template>
