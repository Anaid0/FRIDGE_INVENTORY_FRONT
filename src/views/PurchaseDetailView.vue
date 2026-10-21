<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ProductArt from '@/components/machine/ProductArt.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { formatDateTime, formatMoney, formatNumber, fullName, withUnit } from '@/utils/format';

const props = defineProps<{ id: string }>();
const { purchases } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const toasts = useToastStore();

const { data, error, loading, run } = useAsync(() => purchases.detail(props.id));
useOnEnter(run);
watch(() => props.id, run);

const voided = computed(() => Boolean(data.value?.voidedAt));

const SHORT_DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const shortDay = (iso: string) => SHORT_DAY.format(new Date(iso)).replace(/\.| de/g, ''); // "19 oct"
const units = computed(() => data.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0);

/** Texto del diálogo rojo de confirmación (mockup AdminEstados). */
const voidMessage = computed(() => {
  if (!data.value) return '';
  const items = data.value.items.map((item) => `${formatNumber(item.quantity)} ${item.product.name}`);
  const list = items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '');
  return (
    `${list ? `Se descuentan de la nevera ${list}, y vuelven` : 'Vuelven'} ${formatMoney(data.value.total)} ` +
    'al saldo de la quincena. Si ya se consumió parte de lo comprado no se podrá anular. No se puede deshacer.'
  );
});

// --- Comprobante ---
const receiptUrl = ref<string | null>(null);
const receiptIsImage = ref(false);
const receiptLoading = ref(false);

async function viewReceipt() {
  receiptLoading.value = true;
  try {
    const blob = await purchases.receipt(props.id);
    if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value);
    receiptUrl.value = URL.createObjectURL(blob);
    receiptIsImage.value = blob.type.startsWith('image/');
    if (!receiptIsImage.value) window.open(receiptUrl.value, '_blank', 'noopener');
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    receiptLoading.value = false;
  }
}
onBeforeUnmount(() => {
  if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value);
});

// --- Anular ---
const confirmVoid = ref(false);
const voiding = ref(false);

async function voidPurchase() {
  voiding.value = true;
  try {
    data.value = await purchases.void(props.id);
    toasts.success('Compra anulada. Sus productos salieron de la nevera y ya no cuenta en el gasto.');
    confirmVoid.value = false;
    void lookups.ensureProducts(true).catch(() => undefined);
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    voiding.value = false;
  }
}
</script>

<template>
  <AdminPage title="Compra" narrow>
    <section>
      <PageHeader
        :title="data ? `Compra ${data.store ? `en ${data.store}` : 'del fondo'}` : 'Compra'"
        :back="data ? `/admin/quincenas/${data.periodId}` : '/admin/compras'"
      >
        <template v-if="data" #subtitle>
          {{ formatDateTime(data.purchasedAt) }} · por {{ fullName(data.buyer) }}
        </template>
      </PageHeader>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else-if="data"
        class="flex flex-col gap-2.5 transition-opacity lg:gap-3.5"
        :class="{ 'opacity-60': loading }"
      >
        <p
          v-if="voided"
          class="flex items-center gap-2 rounded-[14px] bg-ink-900/8 px-3 py-2.5 text-xs font-bold text-ink-700"
          role="status"
        >
          <Icon name="alert" :size="16" class="shrink-0" />
          <span>
            Anulada por {{ data.voidedBy ? fullName(data.voidedBy) : '—' }} el
            {{ formatDateTime(data.voidedAt!) }}. No cuenta en el gasto de la quincena.
          </span>
        </p>

        <!-- Resumen -->
        <section class="card flex flex-col gap-2.5 p-3 lg:p-4" aria-label="Resumen de la compra">
          <div class="flex items-end justify-between gap-2">
            <span class="flex flex-col">
              <span class="text-[11px] text-ink-500">Total · {{ formatNumber(units) }} und.</span>
              <span
                class="num text-[28px] leading-[1.1] text-ink-900"
                :class="{ 'text-ink-400 line-through': voided }"
                >{{ formatMoney(data.total) }}</span
              >
            </span>
            <span
              class="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
              :class="data.hasReceipt ? 'bg-success-50 text-success-700' : 'bg-ink-900/8 text-ink-700'"
              >{{ data.hasReceipt ? 'Con comprobante' : 'Sin comprobante' }}</span
            >
          </div>
          <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div class="min-w-0 rounded-xl glass-inset px-2.5 py-2">
              <dt class="text-[10px] text-ink-500">Compró</dt>
              <dd class="truncate text-xs font-extrabold text-ink-900">{{ fullName(data.buyer) }}</dd>
            </div>
            <div class="min-w-0 rounded-xl glass-inset px-2.5 py-2">
              <dt class="text-[10px] text-ink-500">Tienda</dt>
              <dd class="truncate text-xs font-extrabold text-ink-900">{{ data.store ?? '—' }}</dd>
            </div>
            <div class="col-span-2 min-w-0 rounded-xl glass-inset px-2.5 py-2 sm:col-span-1">
              <dt class="text-[10px] text-ink-500">Quincena</dt>
              <dd>
                <RouterLink
                  :to="`/admin/quincenas/${data.periodId}`"
                  class="text-xs font-extrabold text-brand-700 hover:underline"
                  >Ver quincena</RouterLink
                >
              </dd>
            </div>
          </dl>
          <p class="text-[11px] text-ink-500">
            Registrada por {{ fullName(data.registeredBy) }} el {{ formatDateTime(data.createdAt) }}
            <span v-if="data.note"> · {{ data.note }}</span>
          </p>
        </section>

        <!-- Productos -->
        <section class="card px-3 pt-1 pb-2 lg:px-4" aria-labelledby="items-title">
          <div class="flex min-h-10 items-center justify-between gap-2">
            <h2 id="items-title" class="section-title">Productos</h2>
            <span v-if="!voided" class="text-[11px] text-success-700">Entraron solos a la nevera</span>
          </div>
          <table class="w-full text-xs lg:text-[13px]">
            <thead class="sr-only">
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio c/u</th>
                <th scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.id" class="border-t border-ink-900/8">
                <td class="py-2 pr-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span
                      class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/70"
                      aria-hidden="true"
                    >
                      <ProductArt :name="item.product.name" :size="26" :dim="voided" />
                    </span>
                    <span class="flex min-w-0 flex-col">
                      <span class="truncate font-extrabold text-ink-900">{{ item.product.name }}</span>
                      <span class="text-[11px] text-ink-500 sm:hidden"
                        >{{ formatNumber(item.quantity) }} × {{ formatMoney(item.unitPrice) }}</span
                      >
                    </span>
                  </div>
                </td>
                <td class="hidden px-2 py-2 text-right whitespace-nowrap sm:table-cell">
                  {{ withUnit(item.quantity, item.product.unit) }}
                  <span v-if="item.packageCount" class="block text-[10px] text-ink-500">
                    {{ item.packageCount }} {{ item.packageCount === 1 ? 'paquete' : 'paquetes' }} ×
                    {{ item.unitsPerPackage }}
                  </span>
                </td>
                <td class="num hidden px-2 py-2 text-right text-ink-700 sm:table-cell">
                  {{ formatMoney(item.unitPrice) }}
                </td>
                <td class="num py-2 pl-2 text-right text-ink-900">{{ formatMoney(item.subtotal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-ink-900/15">
                <th
                  scope="row"
                  colspan="3"
                  class="hidden py-2.5 text-right font-extrabold text-ink-600 sm:table-cell"
                >
                  Total
                </th>
                <th scope="row" class="py-2.5 text-left font-extrabold text-ink-600 sm:hidden">Total</th>
                <td class="num py-2.5 pl-2 text-right text-ink-900">{{ formatMoney(data.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <div v-if="data.hasReceipt || (auth.isAdmin && !voided)" class="grid grid-cols-2 gap-2">
          <button
            v-if="data.hasReceipt"
            type="button"
            class="btn h-11 rounded-[14px] border border-ink-300 bg-white/80 text-xs text-brand-700 hover:bg-white"
            :disabled="receiptLoading"
            @click="viewReceipt"
          >
            <Icon name="receipt" :size="16" /> {{ receiptLoading ? 'Abriendo…' : 'Ver comprobante' }}
          </button>
          <button
            v-if="auth.isAdmin && !voided"
            type="button"
            class="btn h-11 rounded-[14px] border border-danger-200 bg-white/80 text-xs text-danger-700 hover:bg-danger-50"
            :class="{ 'col-span-2': !data.hasReceipt }"
            @click="confirmVoid = true"
          >
            Anular…
          </button>
        </div>
        <RouterLink
          to="/admin/compras"
          class="inline-flex min-h-11 items-center justify-center gap-1 text-xs font-extrabold text-brand-700 hover:text-ink-900"
        >
          Todas las compras <Icon name="chevronRight" :size="14" :stroke="2.2" />
        </RouterLink>
      </div>

      <div v-else class="flex flex-col gap-2.5" aria-busy="true">
        <div class="h-[140px] animate-pulse rounded-[18px] bg-white/50" />
        <div class="h-[160px] animate-pulse rounded-[18px] bg-white/50" />
      </div>

      <BaseDialog
        :open="Boolean(receiptUrl && receiptIsImage)"
        title="Comprobante"
        wide
        @close="receiptIsImage = false"
      >
        <img
          v-if="receiptUrl"
          :src="receiptUrl"
          alt="Comprobante de la compra"
          class="max-h-[70vh] w-full rounded-lg object-contain"
        />
      </BaseDialog>

      <ConfirmDialog
        :open="confirmVoid"
        :title="data ? `¿Anular la compra del ${shortDay(data.purchasedAt)}?` : 'Anular compra'"
        :message="voidMessage"
        confirm-label="Anular compra"
        danger
        :loading="voiding"
        @confirm="voidPurchase"
        @close="confirmVoid = false"
      />
    </section>
  </AdminPage>
</template>
