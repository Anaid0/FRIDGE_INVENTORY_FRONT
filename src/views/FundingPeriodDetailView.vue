<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ConsumptionChargesCard from '@/components/ConsumptionChargesCard.vue';
import ContributionDialog from '@/components/ContributionDialog.vue';
import PendingChargesCard from '@/components/PendingChargesCard.vue';
import PeriodStatusBadge from '@/components/PeriodStatusBadge.vue';
import Avatar from '@/components/ui/Avatar.vue';
import Badge from '@/components/ui/Badge.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import { useAsync } from '@/composables/useAsync';
import type { PeriodSummary, PurchaseListItem } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { formatPeriodRange, remainingLabel } from '@/utils/dates';
import { formatMoney, formatNumber, fullName } from '@/utils/format';

const props = defineProps<{ id: string }>();
const { funding, purchases } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const toasts = useToastStore();

const { data, error, loading, run } = useAsync(() => funding.detail(props.id));

/**
 * Quincenas anteriores (las demás, la más reciente primero) con su más hambriento si ya se calculó.
 * No se consulta el ranking de las que siguen abiertas: aún no tienen resultado.
 */
const others = useAsync(async () => {
  const periods = (await funding.list()).filter((p) => p.periodId !== props.id).slice(0, 6);
  return Promise.all(
    periods.map(async (period) => {
      if (period.status === 'OPEN') return { period, hungriest: null as string | null };
      const status = await funding.ranking(period.periodId).catch(() => null);
      const names = status?.ranking?.hungriest.map((entry) => fullName(entry.user)) ?? [];
      return { period, hungriest: names.length ? names.join(' y ') : null };
    }),
  );
});

/** Sube al recargar: las tarjetas de cobros vuelven a consultar (p. ej. después de cerrar o de un pago). */
const refreshKey = ref(0);

function load() {
  void run();
  void others.run();
  refreshKey.value += 1;
}
useOnEnter(load);
watch(() => props.id, load);

const isOpen = computed(() => data.value?.period.status === 'OPEN');
const dates = computed(() => {
  const period = data.value?.period;
  if (!period) return '';
  const range = formatPeriodRange(period.startDate, period.endDate);
  return isOpen.value ? `${range} · ${remainingLabel(period.endDate)}` : `${range} · cerrada`;
});

// --- Dinero: recaudado, gastado y saldo ---
const summary = computed(() => data.value?.summary ?? null);
const activePurchases = computed(() => data.value?.purchases.filter((p) => !p.voidedAt) ?? []);
const spentPercent = computed(() => {
  if (!summary.value) return 0;
  const collected = Number(summary.value.collected);
  if (!collected) return Number(summary.value.spent) > 0 ? 100 : 0;
  return Math.min(100, Math.round((Number(summary.value.spent) / collected) * 100));
});
/** "6 aportes de $ 20.000" si todos son iguales; si no, "6 aportes". */
const contributionsHint = computed(() => {
  const list = data.value?.contributions ?? [];
  const count = `${list.length} ${list.length === 1 ? 'aporte' : 'aportes'}`;
  const amounts = new Set(list.map((c) => Number(c.amount)));
  return list.length > 1 && amounts.size === 1 ? `${count} de ${formatMoney(list[0]!.amount)}` : count;
});

const SHORT_DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const shortDay = (iso: string) => SHORT_DAY.format(new Date(iso)).replace(/\.| de/g, ''); // "16 oct"

const contributionOpen = ref(false);
const confirmClose = ref(false);
const closing = ref(false);

async function onContribution() {
  contributionOpen.value = false;
  await run();
}

async function closePeriod() {
  closing.value = true;
  try {
    await funding.close(props.id);
    toasts.success('Quincena cerrada. Ya se calculó cuánto aporta cada uno al siguiente mercado.');
    confirmClose.value = false;
    load();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    closing.value = false;
  }
}

// --- Comprobante de una compra (imagen en un diálogo; PDF en otra pestaña) ---
const receiptUrl = ref<string | null>(null);
const receiptIsImage = ref(false);
const receiptLoading = ref<string | null>(null);

async function viewReceipt(purchase: PurchaseListItem) {
  receiptLoading.value = purchase.id;
  try {
    const blob = await purchases.receipt(purchase.id);
    if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value);
    receiptUrl.value = URL.createObjectURL(blob);
    receiptIsImage.value = blob.type.startsWith('image/');
    if (!receiptIsImage.value) window.open(receiptUrl.value, '_blank', 'noopener');
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    receiptLoading.value = null;
  }
}
onBeforeUnmount(() => {
  if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value);
});

// --- Anular una compra ---
const voiding = ref<PurchaseListItem | null>(null);
const voidBusy = ref(false);

async function voidPurchase() {
  if (!voiding.value) return;
  voidBusy.value = true;
  try {
    await purchases.void(voiding.value.id);
    toasts.success('Compra anulada. Sus productos salieron de la nevera y ya no cuenta en el gasto.');
    voiding.value = null;
    void lookups.ensureProducts(true).catch(() => undefined);
    await run();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    voidBusy.value = false;
  }
}

function balanceTone(p: PeriodSummary) {
  return p.isOverspent ? 'text-danger-700' : 'text-ink-900';
}
</script>

<template>
  <AdminPage :title="data?.period.name ?? 'Quincena'">
    <section>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div class="flex min-w-0 flex-col gap-1.5">
          <RouterLink
            to="/admin/quincenas"
            class="inline-flex items-center gap-1 self-start text-sm font-extrabold text-brand-600 hover:text-brand-800"
          >
            <Icon name="chevronLeft" :size="14" :stroke="2.25" /> Quincenas
          </RouterLink>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="page-title">{{ data?.period.name ?? 'Quincena' }}</h1>
            <span v-if="data" class="[&>span]:px-3 [&>span]:py-1.5 [&>span]:text-[13px]"
              ><PeriodStatusBadge :status="data.period.status"
            /></span>
          </div>
          <p v-if="data" class="text-base text-ink-500">
            {{ dates }}<span v-if="data.period.notes"> · {{ data.period.notes }}</span>
          </p>
        </div>
        <div v-if="auth.isAdmin" class="flex flex-wrap gap-2.5">
          <RouterLink
            :to="{ path: '/admin/ranking', query: { quincena: id } }"
            class="btn-secondary min-h-11 px-[18px]"
          >
            <Icon name="trophy" :size="18" /> Más hambriento
          </RouterLink>
          <template v-if="isOpen">
            <button type="button" class="btn-secondary min-h-11 px-[18px]" @click="confirmClose = true">
              Cerrar quincena
            </button>
            <RouterLink
              :to="{ path: '/admin/compras/nueva', query: { periodo: id } }"
              class="btn-primary min-h-11 px-[18px]"
            >
              <Icon name="plus" :size="18" :stroke="2" /> Registrar compra
            </RouterLink>
          </template>
        </div>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else-if="data && summary"
        class="flex flex-col gap-5 transition-opacity"
        :class="{ 'opacity-60': loading }"
      >
        <!-- Dinero de la quincena -->
        <section class="card flex flex-col gap-4 px-6 py-[22px]" aria-label="Dinero de la quincena">
          <dl class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
            <div class="flex flex-col gap-0.5">
              <dt class="text-sm text-ink-500">Recaudado</dt>
              <dd class="text-3xl font-black text-ink-900 tabular-nums">
                {{ formatMoney(summary.collected) }}
              </dd>
              <dd class="text-[13px] text-ink-500">{{ contributionsHint }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-sm text-ink-500">Gastado</dt>
              <dd class="text-3xl font-black text-ink-900 tabular-nums">{{ formatMoney(summary.spent) }}</dd>
              <dd class="text-[13px] text-ink-500">
                {{ activePurchases.length }} {{ activePurchases.length === 1 ? 'compra' : 'compras' }}
              </dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-sm text-ink-500">Saldo</dt>
              <dd
                class="text-3xl font-black tabular-nums"
                :class="summary.isOverspent ? 'text-danger-700' : 'text-success-800'"
              >
                {{ formatMoney(summary.balance) }}
              </dd>
              <dd class="text-[13px]" :class="summary.isOverspent ? 'text-danger-700' : 'text-ink-500'">
                {{ summary.isOverspent ? 'se gastó más de lo recaudado' : 'disponible para comprar' }}
              </dd>
            </div>
          </dl>
          <div
            class="flex h-3 overflow-hidden rounded-full"
            :class="summary.isOverspent ? 'bg-danger-50' : 'bg-success-100/80'"
            role="progressbar"
            aria-label="Gastado de lo recaudado"
            :aria-valuenow="spentPercent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full"
              :class="summary.isOverspent ? 'bg-danger-600' : 'bg-brand-600'"
              :style="{ width: `${spentPercent}%` }"
            />
          </div>
          <div class="flex flex-wrap gap-[18px] text-[13px] text-ink-500" aria-hidden="true">
            <span class="inline-flex items-center gap-1.5"
              ><span class="size-2.5 rounded-[3px] bg-brand-600" />Gastado {{ spentPercent }} %</span
            >
            <span class="inline-flex items-center gap-1.5"
              ><span class="size-2.5 rounded-[3px] bg-success-100" />Saldo {{ 100 - spentPercent }} %</span
            >
          </div>
        </section>

        <!-- Quien más consume, más aporta -->
        <PendingChargesCard v-if="isOpen" :refresh-key="refreshKey" @changed="run" />
        <ConsumptionChargesCard :period-id="id" :refresh-key="refreshKey" @changed="run" />

        <div class="flex flex-wrap items-start gap-5">
          <!-- Aportes -->
          <section class="card min-w-0 flex-[1_1_380px] overflow-hidden" aria-labelledby="contrib-title">
            <div class="flex items-center justify-between gap-2 border-b border-ink-200/70 px-[22px] py-3">
              <h2 id="contrib-title" class="text-[19px] font-black text-ink-900">Aportes</h2>
              <button
                v-if="auth.isAdmin && isOpen"
                type="button"
                class="btn-secondary min-h-11"
                @click="contributionOpen = true"
              >
                <Icon name="plus" :size="16" :stroke="2" /> Registrar aporte
              </button>
            </div>
            <ul
              v-if="data.contributions.length"
              class="max-h-[420px] divide-y divide-ink-200/60 overflow-y-auto"
            >
              <li
                v-for="c in data.contributions"
                :key="c.id"
                class="flex items-center gap-3 px-[22px] py-2.5"
              >
                <Avatar :person="c.user" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-bold text-ink-800">{{ fullName(c.user) }}</p>
                  <p v-if="c.charge" class="truncate text-xs font-bold text-accent-700">
                    Pago de consumo · {{ c.charge.periodName }}
                  </p>
                  <p v-if="c.note" class="truncate text-xs text-ink-500">{{ c.note }}</p>
                </div>
                <time class="shrink-0 text-[13px] text-ink-500" :datetime="c.paidAt">{{
                  shortDay(c.paidAt)
                }}</time>
                <span class="w-[84px] shrink-0 text-right font-extrabold text-ink-900 tabular-nums">{{
                  formatMoney(c.amount)
                }}</span>
              </li>
            </ul>
            <EmptyState v-else icon="wallet" title="Aún no hay aportes" />
          </section>

          <!-- Compras -->
          <section class="card min-w-0 flex-[1_1_380px] overflow-hidden" aria-labelledby="purchases-title">
            <div
              class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 px-[22px] py-4"
            >
              <h2 id="purchases-title" class="text-[19px] font-black text-ink-900">Compras</h2>
              <span class="text-[13px] text-ink-500">Sus productos entran solos a la nevera</span>
            </div>
            <ul v-if="data.purchases.length" class="divide-y divide-ink-200/60">
              <li v-for="p in data.purchases" :key="p.id" class="flex flex-col gap-2.5 px-[22px] py-4">
                <div class="flex items-center gap-3">
                  <span
                    class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"
                  >
                    <Icon name="cart" :size="20" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <RouterLink
                      :to="`/admin/compras/${p.id}`"
                      class="font-extrabold text-ink-900 hover:text-brand-700"
                      :class="{ 'text-ink-500 line-through': p.voidedAt }"
                    >
                      Compra del {{ shortDay(p.purchasedAt) }}
                    </RouterLink>
                    <p class="text-[13px] text-ink-500">
                      Por {{ fullName(p.buyer) }}<span v-if="p.store"> · {{ p.store }}</span> ·
                      {{ p.hasReceipt ? 'con comprobante' : 'sin comprobante' }}
                    </p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <span
                      class="font-extrabold text-ink-900 tabular-nums"
                      :class="{ 'text-ink-400 line-through': p.voidedAt }"
                      >{{ formatMoney(p.total) }}</span
                    >
                    <Badge v-if="p.voidedAt" tone="neutral">Anulada</Badge>
                  </div>
                </div>
                <ul v-if="p.lines.length" class="flex flex-wrap gap-1.5" aria-label="Productos de la compra">
                  <li
                    v-for="line in p.lines"
                    :key="line.productName"
                    class="rounded-full bg-ink-50/90 px-2.5 py-1 text-[13px] text-ink-800"
                  >
                    {{ formatNumber(line.quantity) }} {{ line.productName }}
                  </li>
                </ul>
                <div
                  v-if="p.hasReceipt || (auth.isAdmin && isOpen && !p.voidedAt)"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    v-if="p.hasReceipt"
                    type="button"
                    class="btn-secondary min-h-11"
                    :disabled="receiptLoading === p.id"
                    @click="viewReceipt(p)"
                  >
                    {{ receiptLoading === p.id ? 'Abriendo…' : 'Ver comprobante' }}
                  </button>
                  <button
                    v-if="auth.isAdmin && isOpen && !p.voidedAt"
                    type="button"
                    class="btn-secondary min-h-11 border-danger-600/30 text-danger-700 hover:bg-danger-50"
                    :aria-label="`Anular la compra del ${shortDay(p.purchasedAt)}`"
                    @click="voiding = p"
                  >
                    Anular
                  </button>
                </div>
              </li>
            </ul>
            <EmptyState v-else icon="cart" title="Aún no hay compras" />
          </section>
        </div>

        <!-- Quincenas anteriores -->
        <section v-if="others.data.value?.length" class="card overflow-hidden" aria-labelledby="others-title">
          <h2
            id="others-title"
            class="border-b border-ink-200/70 px-[22px] py-4 text-[19px] font-black text-ink-900"
          >
            Quincenas anteriores
          </h2>
          <ul class="divide-y divide-ink-200/60">
            <li
              v-for="{ period, hungriest } in others.data.value"
              :key="period.periodId"
              class="flex flex-wrap items-center gap-x-4 gap-y-1 px-[22px] py-2.5"
            >
              <span class="min-w-0 flex-[1_1_220px] font-extrabold text-ink-900">{{ period.name }}</span>
              <PeriodStatusBadge :status="period.status" />
              <span v-if="period.status !== 'OPEN'" class="text-sm text-ink-500">
                Más hambriento:
                <strong class="font-extrabold text-ink-900">{{ hungriest ?? 'sin calcular' }}</strong>
              </span>
              <span class="font-extrabold tabular-nums" :class="balanceTone(period)"
                >Saldo {{ formatMoney(period.balance) }}</span
              >
              <RouterLink
                :to="`/admin/quincenas/${period.periodId}`"
                class="inline-flex min-h-11 items-center font-extrabold text-brand-600 hover:text-brand-800"
                :aria-label="`Ver ${period.name}`"
                >Ver</RouterLink
              >
            </li>
          </ul>
        </section>
      </div>

      <ContributionDialog
        :open="contributionOpen"
        :period-id="id"
        @close="contributionOpen = false"
        @done="onContribution"
      />
      <ConfirmDialog
        :open="confirmClose"
        title="Cerrar quincena"
        message="Al cerrarla se calcula cuánto debe aportar cada persona al siguiente mercado según lo que consumió (en precio). Después no se podrán registrar aportes, compras ni anulaciones en esta quincena. ¿Continuar?"
        confirm-label="Cerrar quincena"
        :loading="closing"
        @confirm="closePeriod"
        @close="confirmClose = false"
      />
      <ConfirmDialog
        :open="voiding !== null"
        title="Anular compra"
        message="La compra dejará de contar en el gasto de la quincena y sus productos saldrán de la nevera. Si ya se consumió parte de lo comprado no se podrá anular."
        confirm-label="Anular compra"
        danger
        :loading="voidBusy"
        @confirm="voidPurchase"
        @close="voiding = null"
      />
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
    </section>
  </AdminPage>
</template>
