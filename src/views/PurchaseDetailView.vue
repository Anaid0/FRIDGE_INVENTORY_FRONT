<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Badge from '@/components/ui/Badge.vue';
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
import { formatDateTime, formatMoney, fullName, withUnit } from '@/utils/format';

const props = defineProps<{ id: string }>();
const { purchases } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const toasts = useToastStore();

const { data, error, loading, run } = useAsync(() => purchases.detail(props.id));
useOnEnter(run);
watch(() => props.id, run);

const voided = computed(() => Boolean(data.value?.voidedAt));

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
      <PageHeader :title="data ? `Compra ${data.store ? `en ${data.store}` : 'del fondo'}` : 'Compra'">
        <template #eyebrow>
          <RouterLink
            to="/admin/compras"
            class="mb-1 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
          >
            <Icon name="chevronLeft" :size="14" /> Compras
          </RouterLink>
        </template>
        <template v-if="data" #actions>
          <button
            v-if="data.hasReceipt"
            type="button"
            class="btn-secondary"
            :disabled="receiptLoading"
            @click="viewReceipt"
          >
            <Icon name="receipt" :size="16" /> {{ receiptLoading ? 'Abriendo…' : 'Ver comprobante' }}
          </button>
          <button
            v-if="auth.isAdmin && !voided"
            type="button"
            class="btn-secondary text-danger-700"
            @click="confirmVoid = true"
          >
            <Icon name="x" :size="16" /> Anular
          </button>
        </template>
      </PageHeader>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else-if="data" class="space-y-6 transition-opacity" :class="{ 'opacity-60': loading }">
        <p
          v-if="voided"
          class="flex items-center gap-2 rounded-lg bg-ink-100 px-4 py-3 text-sm text-ink-700"
          role="status"
        >
          <Icon name="alert" :size="16" />
          Anulada por {{ data.voidedBy ? fullName(data.voidedBy) : '—' }} el
          {{ formatDateTime(data.voidedAt!) }}. No cuenta en el gasto de la quincena.
        </p>

        <dl class="card grid gap-4 p-6 sm:grid-cols-4">
          <div>
            <dt class="text-xs text-ink-500">Total</dt>
            <dd
              class="mt-0.5 text-2xl font-bold text-ink-900"
              :class="{ 'text-ink-400 line-through': voided }"
            >
              {{ formatMoney(data.total) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-ink-500">Compró</dt>
            <dd class="mt-0.5 font-medium text-ink-900">{{ fullName(data.buyer) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-500">Fecha</dt>
            <dd class="mt-0.5 font-medium text-ink-900">{{ formatDateTime(data.purchasedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-500">Quincena</dt>
            <dd class="mt-0.5">
              <RouterLink
                :to="`/admin/quincenas/${data.periodId}`"
                class="font-medium text-brand-700 hover:underline"
                >Ver quincena</RouterLink
              >
            </dd>
          </div>
          <div class="sm:col-span-4">
            <p class="text-xs text-ink-500">
              Registrada por {{ fullName(data.registeredBy) }} el {{ formatDateTime(data.createdAt) }}
              <span v-if="data.note"> · {{ data.note }}</span>
            </p>
          </div>
        </dl>

        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-ink-100 bg-ink-50 text-xs text-ink-500">
              <tr>
                <th scope="col" class="px-5 py-3 text-left font-medium">Producto</th>
                <th scope="col" class="px-5 py-3 text-right font-medium">Cantidad</th>
                <th scope="col" class="px-5 py-3 text-right font-medium">Precio c/u</th>
                <th scope="col" class="px-5 py-3 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="item in data.items" :key="item.id">
                <td class="px-5 py-3 font-medium text-ink-900">{{ item.product.name }}</td>
                <td class="px-5 py-3 text-right tabular-nums">
                  {{ withUnit(item.quantity, item.product.unit) }}
                </td>
                <td class="px-5 py-3 text-right tabular-nums">{{ formatMoney(item.unitPrice) }}</td>
                <td class="px-5 py-3 text-right font-semibold tabular-nums">
                  {{ formatMoney(item.subtotal) }}
                </td>
              </tr>
            </tbody>
            <tfoot class="border-t border-ink-200 bg-ink-50">
              <tr>
                <th scope="row" colspan="3" class="px-5 py-3 text-right font-medium text-ink-600">Total</th>
                <td class="px-5 py-3 text-right font-bold text-ink-900 tabular-nums">
                  {{ formatMoney(data.total) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <Badge v-if="!voided" tone="info"
          ><Icon name="check" :size="12" /> Estos productos entraron a la nevera al registrar la compra</Badge
        >
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
        title="Anular compra"
        message="La compra dejará de contar en el gasto de la quincena y sus productos saldrán de la nevera. Si ya se consumió parte de lo comprado no se podrá anular."
        confirm-label="Anular compra"
        danger
        :loading="voiding"
        @confirm="voidPurchase"
        @close="confirmVoid = false"
      />
    </section>
  </AdminPage>
</template>
