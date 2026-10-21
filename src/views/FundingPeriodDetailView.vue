<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ConsumptionChargesCard from '@/components/ConsumptionChargesCard.vue';
import ContributionDialog from '@/components/ContributionDialog.vue';
import PendingChargesCard from '@/components/PendingChargesCard.vue';
import PeriodBalanceCard from '@/components/PeriodBalanceCard.vue';
import PeriodStatusBadge from '@/components/PeriodStatusBadge.vue';
import Avatar from '@/components/ui/Avatar.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { PeriodRankingStatus, PurchaseListItem, UserRef } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { formatPeriodRange, remainingLabel } from '@/utils/dates';
import { formatMoney, formatNumber, fullName } from '@/utils/format';

/**
 * Detalle de una quincena (mockup Quincena). Con id "actual" (pestaña "Quincena" de la barra inferior)
 * muestra la quincena abierta; si no hay ninguna, invita a abrir una.
 */
const props = defineProps<{ id: string }>();
const { funding, purchases } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const toasts = useToastStore();
const router = useRouter();

const isCurrentRoute = computed(() => props.id === 'actual');

const { data, error, loading, run } = useAsync(async () => {
  if (!isCurrentRoute.value) return funding.detail(props.id);
  const current = await funding.current();
  return current ? funding.detail(current.periodId) : null;
});
/** Ya terminó la primera carga (para distinguir "cargando" de "no hay quincena abierta"). */
const loaded = ref(false);
/** Id real de la quincena mostrada (con "actual", el de la abierta). */
const periodId = computed(() => data.value?.period.id ?? (isCurrentRoute.value ? null : props.id));

/**
 * Quincenas anteriores (las demás, la más reciente primero) con su más hambriento si ya se calculó.
 * No se consulta el ranking de las que siguen abiertas: aún no tienen resultado.
 */
const others = useAsync(async () => {
  const periods = (await funding.list()).filter((p) => p.periodId !== periodId.value).slice(0, 6);
  return Promise.all(
    periods.map(async (period) => {
      if (period.status === 'OPEN') return { period, hungriest: null as string | null };
      const status = await funding.ranking(period.periodId).catch(() => null);
      return { period, hungriest: hungriestOf(status) };
    }),
  );
});

/** El más hambriento de esta quincena (si ya está cerrada y se calculó). */
const ownRanking = useAsync(() =>
  periodId.value ? funding.ranking(periodId.value).catch(() => null) : Promise.resolve(null),
);

function hungriestOf(status: PeriodRankingStatus | null): string | null {
  const names = status?.ranking?.hungriest.map((entry) => fullName(entry.user)) ?? [];
  return names.length ? names.join(' y ') : null;
}

/** Sube al recargar: las tarjetas de cobros vuelven a consultar (p. ej. después de cerrar o de un pago). */
const refreshKey = ref(0);

async function load() {
  refreshKey.value += 1;
  void lookups.ensureUsers().catch(() => undefined);
  const result = await run();
  loaded.value = true;
  void others.run();
  if (result?.period.status === 'CLOSED') void ownRanking.run();
  else ownRanking.data.value = null;
}
useOnEnter(load);
watch(() => props.id, load);

const isOpen = computed(() => data.value?.period.status === 'OPEN');
/** Con "actual" y sin quincena abierta: se muestra la invitación a abrir una. */
const noOpenPeriod = computed(
  () => isCurrentRoute.value && loaded.value && !loading.value && !error.value && !data.value,
);

/** "16 – 31 oct" (con el año solo si no es el actual). */
function shortRange(start: string, end: string) {
  const range = formatPeriodRange(start, end, true);
  const year = String(new Date().getFullYear());
  return range.endsWith(` ${year}`) ? range.slice(0, -year.length - 1) : range;
}
const dates = computed(() => {
  const period = data.value?.period;
  if (!period) return '';
  const range = shortRange(period.startDate, period.endDate);
  const parts = [range, isOpen.value ? remainingLabel(period.endDate) : null, period.notes];
  return parts.filter(Boolean).join(' · ');
});

// --- Dinero: recaudado, gastado y saldo ---
const summary = computed(() => data.value?.summary ?? null);
const activePurchases = computed(() => data.value?.purchases.filter((p) => !p.voidedAt) ?? []);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const collectedHint = computed(() => plural(data.value?.contributions.length ?? 0, 'aporte', 'aportes'));
const spentHint = computed(() => plural(activePurchases.value.length, 'compra', 'compras'));

// --- Aportes ---
/** "Andres C.": nombre y la inicial del apellido, para la cuadrícula de dos columnas. */
const shortName = (user: UserRef) => `${user.name} ${user.lastname.charAt(0)}.`.trim();
/** Cuántas personas ya aportaron de las que hay ("6 de 6 al día"). */
const contributorsLabel = computed(() => {
  const contributors = new Set(data.value?.contributions.map((c) => c.user.id) ?? []).size;
  const people = lookups.users.length;
  if (!people) return { text: collectedHint.value, done: false };
  return { text: `${Math.min(contributors, people)} de ${people} al día`, done: contributors >= people };
});

const SHORT_DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const shortDay = (iso: string) => SHORT_DAY.format(new Date(iso)).replace(/\.| de/g, ''); // "16 oct"

/** "12 Coca cola 250ml · 6 Leche · 2 Agua". */
const linesSummary = (p: PurchaseListItem) =>
  p.lines.map((line) => `${formatNumber(line.quantity)} ${line.productName}`).join(' · ');

const contributionOpen = ref(false);
const confirmClose = ref(false);
const closing = ref(false);

async function onContribution() {
  contributionOpen.value = false;
  await run();
}

async function closePeriod() {
  const id = periodId.value;
  if (!id) return;
  closing.value = true;
  try {
    await funding.close(id);
    toasts.success('Quincena cerrada. Ya se calculó cuánto aporta cada uno al siguiente mercado.');
    confirmClose.value = false;
    // Desde "actual" se pasa a la quincena recién cerrada para ver sus cobros (si no, quedaría vacía).
    if (isCurrentRoute.value) await router.replace(`/admin/quincenas/${id}`);
    else void load();
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
/** La última compra a anular: el diálogo conserva su texto mientras se cierra. */
const voidShown = ref<PurchaseListItem | null>(null);
watch(voiding, (p) => {
  if (p) voidShown.value = p;
});

/** Texto del diálogo rojo de confirmación (mockup AdminEstados). */
const voidTitle = computed(() =>
  voidShown.value ? `¿Anular la compra del ${shortDay(voidShown.value.purchasedAt)}?` : 'Anular compra',
);
const voidMessage = computed(() => {
  const p = voidShown.value;
  if (!p) return '';
  const items = p.lines.map((line) => `${formatNumber(line.quantity)} ${line.productName}`);
  const list = items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '');
  return (
    `${list ? `Se descuentan de la nevera ${list}, y vuelven` : 'Vuelven'} ${formatMoney(p.total)} al saldo. ` +
    'Si ya se consumió parte de lo comprado no se podrá anular. No se puede deshacer.'
  );
});

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
</script>

<template>
  <AdminPage :title="data?.period.name ?? 'Quincena'">
    <section>
      <PageHeader
        :title="data?.period.name ?? 'Quincena'"
        :subtitle="dates || undefined"
        :back="isCurrentRoute ? undefined : '/admin/quincenas'"
      >
        <template v-if="data" #actions>
          <PeriodStatusBadge :status="data.period.status" />
        </template>
      </PageHeader>

      <ErrorState v-if="error && !data" :message="error" @retry="load" />

      <!-- "actual" sin quincena abierta -->
      <div v-else-if="noOpenPeriod" class="card mx-auto max-w-xl">
        <EmptyState
          icon="wallet"
          title="No hay una quincena abierta"
          :message="
            auth.isAdmin
              ? 'Abre una para registrar aportes y compras.'
              : 'El administrador debe abrir la próxima quincena.'
          "
        >
          <div class="flex flex-col items-center gap-2">
            <RouterLink
              v-if="auth.isAdmin"
              :to="{ path: '/admin/quincenas', query: { abrir: '1' } }"
              class="btn-primary min-h-11 px-5"
            >
              <Icon name="plus" :size="16" :stroke="2.4" /> Abrir quincena
            </RouterLink>
            <RouterLink
              to="/admin/quincenas"
              class="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand-700 hover:text-ink-900"
            >
              Ver quincenas anteriores <Icon name="chevronRight" :size="16" :stroke="2.2" />
            </RouterLink>
          </div>
        </EmptyState>
      </div>

      <div
        v-else-if="data && summary && periodId"
        class="grid gap-2.5 transition-opacity lg:grid-cols-2 lg:items-start lg:gap-4"
        :class="{ 'opacity-60': loading }"
      >
        <div class="flex min-w-0 flex-col gap-2.5 lg:gap-4">
          <!-- Dinero de la quincena -->
          <PeriodBalanceCard :summary="summary" :collected-hint="collectedHint" :spent-hint="spentHint" />

          <div v-if="auth.isAdmin && isOpen" class="grid grid-cols-2 gap-2">
            <RouterLink
              :to="{ path: '/admin/compras/nueva', query: { periodo: periodId } }"
              class="btn-primary h-11 rounded-[14px] px-2 text-xs lg:text-sm"
            >
              <Icon name="bag" :size="16" :stroke="2.4" /> Registrar compra
            </RouterLink>
            <button
              type="button"
              class="btn h-11 rounded-[14px] border border-white/95 bg-white/65 px-2 text-xs text-ink-900 backdrop-blur-md hover:bg-white lg:text-sm"
              @click="contributionOpen = true"
            >
              <Icon name="plus" :size="16" :stroke="2.8" /> Registrar aporte
            </button>
          </div>

          <!-- Aportes -->
          <section class="card px-3 pt-1 pb-1.5 lg:px-4" aria-labelledby="contrib-title">
            <div class="flex min-h-10 items-center justify-between gap-2">
              <h2 id="contrib-title" class="section-title">Aportes</h2>
              <span
                class="text-[11px] font-extrabold"
                :class="contributorsLabel.done ? 'text-success-700' : 'text-accent-700'"
                >{{ contributorsLabel.text }}</span
              >
            </div>
            <ul
              v-if="data.contributions.length"
              class="grid grid-cols-1 gap-x-3 min-[360px]:grid-cols-2"
              aria-label="Aportes de la quincena"
            >
              <li
                v-for="c in data.contributions"
                :key="c.id"
                class="flex min-h-10 min-w-0 items-center gap-2 border-t border-ink-900/8 py-1"
                :title="`${fullName(c.user)} · ${shortDay(c.paidAt)}`"
              >
                <Avatar :person="c.user" size="sm" class="size-[26px]! text-[10px]!" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-bold text-ink-800 lg:text-[13px]">{{
                    shortName(c.user)
                  }}</span>
                  <span v-if="c.charge" class="block truncate text-[10px] font-bold text-accent-700"
                    >Pago de consumo · {{ c.charge.periodName }}</span
                  >
                  <span v-else-if="c.note" class="block truncate text-[10px] text-ink-500">{{ c.note }}</span>
                </span>
                <span class="num shrink-0 text-[11px] text-success-700 lg:text-xs">{{
                  formatNumber(Number(c.amount))
                }}</span>
              </li>
            </ul>
            <p v-else class="border-t border-ink-900/8 py-4 text-center text-xs text-ink-500">
              Aún no hay aportes
            </p>
          </section>

          <!-- Compras -->
          <section class="card flex flex-col px-3 pt-1 pb-2.5 lg:px-4" aria-labelledby="purchases-title">
            <div class="flex min-h-10 items-center justify-between gap-2">
              <h2 id="purchases-title" class="section-title">Compras</h2>
              <span class="text-[11px] text-ink-500">Entran solas a la nevera</span>
            </div>
            <ul v-if="data.purchases.length">
              <li
                v-for="p in data.purchases"
                :key="p.id"
                class="flex flex-col gap-1.5 border-t border-ink-900/8 py-2 last:pb-0"
              >
                <div class="flex items-center gap-2">
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="flex flex-wrap items-center gap-1.5">
                      <RouterLink
                        :to="`/admin/compras/${p.id}`"
                        class="text-[13px] font-extrabold text-ink-900 hover:text-brand-700"
                        :class="{ 'text-ink-500 line-through': p.voidedAt }"
                      >
                        {{ shortDay(p.purchasedAt) }} ·
                        {{ p.hasReceipt ? 'con comprobante' : 'sin comprobante' }}
                      </RouterLink>
                      <span
                        v-if="p.voidedAt"
                        class="rounded-md bg-ink-900/8 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-700"
                        >Anulada</span
                      >
                    </span>
                    <span v-if="p.lines.length" class="text-[11px] text-ink-500">{{ linesSummary(p) }}</span>
                    <span class="text-[10px] text-ink-500">
                      Por {{ fullName(p.buyer) }}<template v-if="p.store"> · {{ p.store }}</template>
                    </span>
                  </span>
                  <span
                    class="num shrink-0 text-[13px] text-ink-900"
                    :class="{ 'text-ink-400 line-through': p.voidedAt }"
                    >{{ formatMoney(p.total) }}</span
                  >
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-if="p.hasReceipt"
                    type="button"
                    class="inline-flex min-h-[34px] items-center rounded-[10px] border border-ink-300 bg-white/80 px-2.5 text-[11px] font-extrabold text-brand-700 hover:bg-white disabled:opacity-60"
                    :disabled="receiptLoading === p.id"
                    @click="viewReceipt(p)"
                  >
                    {{ receiptLoading === p.id ? 'Abriendo…' : 'Ver comprobante' }}
                  </button>
                  <RouterLink
                    v-else
                    :to="`/admin/compras/${p.id}`"
                    class="inline-flex min-h-[34px] items-center rounded-[10px] border border-dashed border-[#9DB6C9] px-2.5 text-[11px] font-extrabold text-brand-700 hover:bg-white/60"
                  >
                    Ver compra
                  </RouterLink>
                  <button
                    v-if="auth.isAdmin && isOpen && !p.voidedAt"
                    type="button"
                    class="inline-flex min-h-[34px] items-center rounded-[10px] border border-danger-200 bg-white/80 px-2.5 text-[11px] font-extrabold text-danger-700 hover:bg-danger-50"
                    :aria-label="`Anular la compra del ${shortDay(p.purchasedAt)}`"
                    @click="voiding = p"
                  >
                    Anular…
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="border-t border-ink-900/8 py-4 text-center text-xs text-ink-500">
              Aún no hay compras
            </p>
          </section>
        </div>

        <div class="flex min-w-0 flex-col gap-2.5 lg:gap-4">
          <!-- Quien más consume, más aporta -->
          <PendingChargesCard v-if="isOpen" :refresh-key="refreshKey" @changed="run" />
          <ConsumptionChargesCard :period-id="periodId" :refresh-key="refreshKey" @changed="run" />

          <!-- Más hambriento y quincenas anteriores -->
          <section class="card bg-white/50! px-3 py-1 lg:px-4" aria-labelledby="others-title">
            <h2 id="others-title" class="sr-only">Quincenas anteriores</h2>
            <ul>
              <li
                v-for="{ period, hungriest } in others.data.value ?? []"
                :key="period.periodId"
                class="flex min-h-[52px] items-center gap-2.5 border-b border-ink-900/8 py-1.5"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[13px] font-extrabold text-ink-900">{{ period.name }}</span>
                    <PeriodStatusBadge :status="period.status" small />
                  </span>
                  <span class="text-[11px] text-ink-500">
                    <template v-if="period.status !== 'OPEN'">
                      Más hambriento:
                      <strong class="font-extrabold text-accent-700">{{
                        hungriest ?? 'sin calcular'
                      }}</strong>
                      ·
                    </template>
                    saldo
                    <span :class="{ 'font-bold text-danger-700': period.isOverspent }">{{
                      formatMoney(period.balance)
                    }}</span>
                  </span>
                </span>
                <RouterLink
                  :to="`/admin/quincenas/${period.periodId}`"
                  class="inline-flex min-h-11 items-center px-1 text-xs font-extrabold text-brand-700 hover:text-ink-900"
                  :aria-label="`Ver ${period.name}`"
                  >Ver</RouterLink
                >
              </li>
            </ul>
            <div class="flex flex-wrap items-center justify-between gap-x-3">
              <RouterLink
                :to="{ path: '/admin/ranking', query: { quincena: periodId } }"
                class="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-xs font-extrabold text-brand-700 hover:text-ink-900"
              >
                <Icon name="trophy" :size="16" />
                <span class="truncate">
                  Más hambriento<template v-if="ownRanking.data.value?.ranking">
                    : {{ hungriestOf(ownRanking.data.value) ?? 'nadie' }}</template
                  >
                </span>
              </RouterLink>
              <RouterLink
                to="/admin/quincenas"
                class="inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-brand-700 hover:text-ink-900"
              >
                Todas las quincenas <Icon name="chevronRight" :size="14" :stroke="2.2" />
              </RouterLink>
            </div>
          </section>

          <div v-if="auth.isAdmin && isOpen" class="flex flex-col gap-1">
            <button
              type="button"
              class="h-11 rounded-[14px] border-[1.5px] border-ink-900 bg-transparent text-[13px] font-extrabold text-ink-900 transition-colors hover:bg-white/50"
              @click="confirmClose = true"
            >
              Cerrar quincena…
            </button>
            <p class="text-center text-[11px] text-ink-500">
              Al cerrarla se genera el cobro de cada persona según lo que consumió. Pide confirmación.
            </p>
          </div>
        </div>
      </div>

      <!-- Cargando la primera vez -->
      <div v-else-if="loading" class="grid gap-2.5 lg:grid-cols-2 lg:gap-4" aria-busy="true">
        <div class="h-[150px] animate-pulse rounded-[20px] bg-ink-900/15" />
        <div class="h-[150px] animate-pulse rounded-[18px] bg-white/50" />
      </div>

      <ContributionDialog
        :open="contributionOpen"
        :period-id="periodId ?? ''"
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
        :title="voidTitle"
        :message="voidMessage"
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
