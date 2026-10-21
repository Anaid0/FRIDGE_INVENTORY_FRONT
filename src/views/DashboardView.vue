<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementView, Product, PurchaseListItem, TopWithdrawer, UserRef } from '@/domain/models';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { daysUntil, startOfTodayISO } from '@/utils/dates';
import { formatMoney, formatNumber, formatRelative, fullName } from '@/utils/format';

const { movements, purchases } = useServices();
const auth = useAuthStore();
const router = useRouter();
const { data, error, loading, run } = useAsync(() => movements.dashboard());

/**
 * Quién va ganando: el podio de la quincena abierta; si no hay quincena abierta (o nadie ha sacado nada en
 * ella), el de siempre.
 */
const leaders = useAsync(async (): Promise<{ scope: 'period' | 'all'; rows: TopWithdrawer[] }> => {
  const period = await movements.topWithdrawers('period', 3).catch(() => []);
  if (period.length) return { scope: 'period', rows: period };
  return { scope: 'all', rows: await movements.topWithdrawers('all', 3) };
});

// "Retiros hoy": salidas manuales registradas desde el inicio del día (solo se necesita el total).
const withdrawalsToday = useAsync(
  async () =>
    (await movements.list({ type: 'OUT', source: 'MANUAL', from: startOfTodayISO(), pageSize: 1 })).total,
);

// Compras recientes: solo para mostrar el total ("Compra de 4 productos · $86.500") en los movimientos.
const recentPurchases = useAsync(
  async () =>
    (await purchases.list({ pageSize: 10 }).catch(() => ({ items: [] as PurchaseListItem[] }))).items,
);

useOnEnter(() => {
  void run();
  void leaders.run();
  void withdrawalsToday.run();
  void recentPurchases.run();
});

/** "Lunes 19 de octubre". */
const today = computed(() => {
  const text = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date())
    .replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
});

/** Salir: cierra la sesión de admin y vuelve a la máquina. */
async function logout() {
  auth.logout();
  await router.replace('/');
}

/** "David O.": nombre y la inicial del apellido (filas cortas del mockup). */
function shortName(user: UserRef): string {
  return user.lastname ? `${user.name} ${user.lastname.charAt(0)}.` : user.name;
}

// --- Quincena actual ---
const period = computed(() => data.value?.currentPeriod ?? null);
const spentPercent = computed(() => {
  if (!period.value) return 0;
  const collected = Number(period.value.collected);
  if (!collected) return Number(period.value.spent) > 0 ? 100 : 0;
  return Math.round((Number(period.value.spent) / collected) * 100);
});
/** "Abierta · 12 días", "Abierta · termina hoy"; cerrada, "Cerrada". */
const periodPill = computed(() => {
  if (!period.value) return '';
  if (period.value.status !== 'OPEN') return 'Cerrada';
  const days = daysUntil(period.value.endDate);
  if (days < 0) return 'Abierta · ya terminó';
  if (days === 0) return 'Abierta · termina hoy';
  return `Abierta · ${days} ${days === 1 ? 'día' : 'días'}`;
});

// --- Va ganando ---
const leader = computed(() => leaders.data.value?.rows[0] ?? null);
const leaderDetail = computed(() => {
  if (!leader.value) return '';
  const { totalWithdrawn, withdrawals } = leader.value;
  return `${formatNumber(totalWithdrawn)} und. · ${formatNumber(withdrawals)} ${withdrawals === 1 ? 'retiro' : 'retiros'}`;
});
/** "2. Gerson B. 1 · 3. Diana V. 1". */
const chasers = computed(() =>
  (leaders.data.value?.rows.slice(1) ?? [])
    .map((row, i) => `${i + 2}. ${shortName(row.user)} ${formatNumber(row.totalWithdrawn)}`)
    .join(' · '),
);

// --- Por reponer ---
const restock = computed(() => data.value?.lowStockProducts.slice(0, 4) ?? []);
function restockLabel(p: Product): string {
  return `${p.name}: ${p.quantity === 0 ? 'agotado' : `quedan ${p.quantity} de un mínimo de ${p.minStock}`}`;
}

// --- Últimos movimientos: las líneas de una misma compra se juntan en una sola fila ---
type FeedRow =
  | { kind: 'movement'; key: string; movement: MovementView }
  | { kind: 'purchase'; key: string; purchaseId: string | null; lines: number; createdAt: string };

const feed = computed<FeedRow[]>(() => {
  const rows: FeedRow[] = [];
  for (const m of data.value?.latestMovements ?? []) {
    const last = rows[rows.length - 1];
    if (m.source === 'PURCHASE') {
      if (last?.kind === 'purchase' && last.purchaseId === m.purchaseId) last.lines += 1;
      else
        rows.push({
          kind: 'purchase',
          key: m.id,
          purchaseId: m.purchaseId,
          lines: 1,
          createdAt: m.createdAt,
        });
    } else {
      rows.push({ kind: 'movement', key: m.id, movement: m });
    }
  }
  return rows.slice(0, 6);
});

function purchaseOf(id: string | null): PurchaseListItem | undefined {
  return id ? recentPurchases.data.value?.find((p) => p.id === id) : undefined;
}
/** "de 4 productos · $86.500" (sin total si la compra no está entre las recientes). */
function purchaseText(row: Extract<FeedRow, { kind: 'purchase' }>): string {
  const purchase = purchaseOf(row.purchaseId);
  const count = purchase?.itemsCount ?? row.lines;
  const text = `de ${count} ${count === 1 ? 'producto' : 'productos'}`;
  return purchase ? `${text} · ${formatMoney(purchase.total)}` : text;
}

/** "12 min", "1 h", "ayer": la hora relativa sin el "hace". */
function when(value: string): string {
  return formatRelative(value).replace(/^hace\s+/, '');
}

// --- Más retiros · 30 días ---
const monthRows = computed(() => data.value?.topWithdrawers.last30Days.slice(0, 5) ?? []);
const monthMax = computed(() => Math.max(1, ...monthRows.value.map((row) => row.totalWithdrawn)));
</script>

<template>
  <AdminPage title="Inicio">
    <div class="flex flex-col gap-2.5 lg:gap-4">
      <header class="flex items-center gap-2.5">
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-[11px] font-bold text-ink-500 lg:text-[13px]">{{ today }}</span>
          <h1 class="page-title truncate">Hola, {{ auth.user?.name }}</h1>
        </div>
        <button
          type="button"
          class="glass inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold text-ink-900 hover:bg-white"
          @click="logout"
        >
          <Icon name="enter" :size="16" :stroke="2.4" /> Salir
        </button>
      </header>

      <!-- Acciones rápidas -->
      <nav class="grid grid-cols-3 gap-1.5 lg:gap-3" aria-label="Acciones rápidas">
        <RouterLink
          to="/admin/ingresar"
          class="press flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-success-700 px-1 text-center text-[11px] font-extrabold text-white shadow-[0_6px_16px_rgb(21_122_75/0.25)] hover:bg-success-800 lg:h-16 lg:flex-row lg:gap-2 lg:text-sm"
        >
          <Icon name="putIn" :size="18" :stroke="2.6" /> Ingresar stock
        </RouterLink>
        <RouterLink
          to="/admin/compras/nueva"
          class="glass press flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-center text-[11px] font-extrabold text-ink-900 hover:bg-white lg:h-16 lg:flex-row lg:gap-2 lg:text-sm"
        >
          <Icon name="bag" :size="18" :stroke="2.4" /> Registrar compra
        </RouterLink>
        <RouterLink
          to="/admin/productos/nuevo"
          class="glass press flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-center text-[11px] font-extrabold text-ink-900 hover:bg-white lg:h-16 lg:flex-row lg:gap-2 lg:text-sm"
        >
          <Icon name="plus" :size="18" :stroke="2.6" /> Nuevo producto
        </RouterLink>
      </nav>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else
        class="flex flex-col gap-2.5 transition-opacity lg:gap-4"
        :class="{ 'opacity-60': loading && data }"
      >
        <!-- Cifras -->
        <dl class="grid grid-cols-4 gap-1.5 lg:gap-3">
          <div
            class="glass flex min-w-0 flex-col-reverse justify-end gap-0.5 rounded-[14px] px-2.5 py-2 lg:px-4 lg:py-3"
          >
            <dt class="text-[10px] leading-tight font-bold text-ink-500 lg:text-xs">Productos activos</dt>
            <dd class="num text-[19px] text-ink-900 lg:text-2xl">
              {{ data ? formatNumber(data.activeProducts) : '—' }}
            </dd>
          </div>
          <div
            class="glass flex min-w-0 flex-col-reverse justify-end gap-0.5 rounded-[14px] px-2.5 py-2 lg:px-4 lg:py-3"
          >
            <dt class="text-[10px] leading-tight font-bold text-ink-500 lg:text-xs">Unidades en la nevera</dt>
            <dd class="num text-[19px] text-ink-900 lg:text-2xl">
              {{ data ? formatNumber(data.totalUnits) : '—' }}
            </dd>
          </div>
          <div
            class="flex min-w-0 flex-col-reverse justify-end gap-0.5 rounded-[14px] px-2.5 py-2 lg:px-4 lg:py-3"
            :class="data?.lowStockProducts.length ? 'border border-accent-200 bg-accent-100/80' : 'glass'"
          >
            <dt
              class="text-[10px] leading-tight lg:text-xs"
              :class="
                data?.lowStockProducts.length ? 'font-extrabold text-accent-700' : 'font-bold text-ink-500'
              "
            >
              Por reponer
            </dt>
            <dd
              class="num text-[19px] lg:text-2xl"
              :class="data?.lowStockProducts.length ? 'text-accent-700' : 'text-ink-900'"
            >
              {{ data ? formatNumber(data.lowStockProducts.length) : '—' }}
            </dd>
          </div>
          <div
            class="glass flex min-w-0 flex-col-reverse justify-end gap-0.5 rounded-[14px] px-2.5 py-2 lg:px-4 lg:py-3"
          >
            <dt class="text-[10px] leading-tight font-bold text-ink-500 lg:text-xs">Retiros hoy</dt>
            <dd class="num text-[19px] text-ink-900 lg:text-2xl">
              {{ withdrawalsToday.data.value !== null ? formatNumber(withdrawalsToday.data.value) : '—' }}
            </dd>
          </div>
        </dl>

        <div class="grid gap-2.5 lg:grid-cols-2 lg:gap-4">
          <!-- Quincena actual -->
          <RouterLink
            v-if="period"
            to="/admin/quincenas/actual"
            class="card flex flex-col gap-2 p-3 text-inherit lg:justify-center lg:gap-3 lg:p-5"
          >
            <span class="flex items-center gap-2">
              <span class="section-title min-w-0 flex-1 truncate">{{ period.name }}</span>
              <span
                class="inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-extrabold"
                :class="
                  period.status === 'OPEN' ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-700'
                "
                >{{ periodPill }}</span
              >
            </span>
            <span
              class="block h-1.5 overflow-hidden rounded-full bg-ink-900/10"
              role="progressbar"
              aria-label="Gastado de lo recaudado"
              :aria-valuenow="Math.min(spentPercent, 100)"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span
                class="block h-full rounded-full"
                :class="period.isOverspent ? 'bg-danger-600' : 'bg-brand-600'"
                :style="{ width: `${Math.min(spentPercent, 100)}%` }"
              />
            </span>
            <span class="grid grid-cols-3 gap-1.5">
              <span class="flex min-w-0 flex-col">
                <span class="text-[10px] text-ink-500 lg:text-xs">Recaudado</span>
                <span class="num truncate text-[13px] text-ink-900 lg:text-base">{{
                  formatMoney(period.collected)
                }}</span>
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="text-[10px] text-ink-500 lg:text-xs">Gastado · {{ spentPercent }} %</span>
                <span class="num truncate text-[13px] text-ink-900 lg:text-base">{{
                  formatMoney(period.spent)
                }}</span>
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="text-[10px] text-ink-500 lg:text-xs">Saldo</span>
                <span
                  class="num truncate text-[13px] lg:text-base"
                  :class="period.isOverspent ? 'text-danger-700' : 'text-success-700'"
                  >{{ formatMoney(period.balance) }}</span
                >
              </span>
            </span>
          </RouterLink>
          <div v-else-if="data" class="card flex flex-col gap-1.5 p-3 lg:justify-center lg:p-5">
            <p class="section-title">Sin quincena abierta</p>
            <p class="text-xs text-ink-500">Abre una para registrar aportes y compras.</p>
            <RouterLink to="/admin/quincenas" class="btn-secondary mt-1 min-h-11 self-start"
              >Ir a quincenas</RouterLink
            >
          </div>
          <div v-else class="card h-[104px] animate-pulse" />

          <div class="grid grid-cols-2 gap-2 lg:gap-4">
            <!-- Va ganando -->
            <RouterLink
              to="/admin/ranking"
              class="flex min-w-0 flex-col gap-1.5 rounded-[18px] bg-[linear-gradient(160deg,rgb(10_74_117/0.95),rgb(6_48_77/0.95))] p-2.5 text-white lg:p-4"
            >
              <span class="text-[10px] font-extrabold tracking-[0.8px] text-[#9FD3F5] uppercase">{{
                leaders.data.value?.scope === 'all' ? 'Quien más retira' : 'Va ganando'
              }}</span>
              <span class="flex min-w-0 items-center gap-2">
                <span class="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#FFE2C4]">
                  <svg width="26" height="26" viewBox="0 18 200 164" aria-hidden="true">
                    <circle cx="28" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="172" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="100" cy="100" r="74" fill="#0b79c3" />
                    <circle cx="78" cy="90" r="28" fill="#fff" />
                    <circle cx="122" cy="90" r="28" fill="#fff" />
                    <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
                    <circle cx="80" cy="90" r="11" fill="#073b5e" />
                    <circle cx="120" cy="90" r="11" fill="#073b5e" />
                    <ellipse cx="100" cy="136" rx="18" ry="14" fill="#073b5e" />
                  </svg>
                </span>
                <span v-if="leader" class="flex min-w-0 flex-col leading-tight">
                  <span class="truncate font-display text-sm font-black">{{ fullName(leader.user) }}</span>
                  <span class="text-[11px] font-extrabold text-[#FFB46B]">{{ leaderDetail }}</span>
                </span>
                <span v-else-if="leaders.data.value" class="text-xs font-extrabold"
                  >Aún nadie ha retirado nada</span
                >
                <span v-else class="h-7 w-24 animate-pulse rounded-lg bg-white/15" />
              </span>
              <span v-if="chasers" class="truncate text-[11px] text-[#CFE3F1]">{{ chasers }}</span>
            </RouterLink>

            <!-- Por reponer -->
            <section class="card flex min-w-0 flex-col gap-1.5 p-2.5 lg:p-4" aria-labelledby="restock-title">
              <h2
                id="restock-title"
                class="text-[10px] font-extrabold tracking-[0.8px] text-accent-700 uppercase"
              >
                Por reponer
              </h2>
              <ul v-if="restock.length" class="flex flex-col">
                <li v-for="(p, i) in restock" :key="p.id" :class="{ 'border-t border-ink-900/8': i > 0 }">
                  <RouterLink
                    :to="`/admin/productos/${p.id}/editar`"
                    class="flex min-h-11 items-center justify-between gap-2"
                    :aria-label="restockLabel(p)"
                  >
                    <span class="truncate text-[13px] font-extrabold text-ink-900">{{ p.name }}</span>
                    <span
                      v-if="p.quantity === 0"
                      class="inline-flex h-5 shrink-0 items-center rounded-md bg-ink-900 px-1.5 text-[10px] font-extrabold text-white"
                      >Agotado</span
                    >
                    <span v-else class="num shrink-0 text-xs text-accent-700"
                      >{{ p.quantity }}/{{ p.minStock }}</span
                    >
                  </RouterLink>
                </li>
              </ul>
              <p v-else-if="data" class="text-xs text-ink-500">Todo con buen stock.</p>
              <span v-else class="h-8 animate-pulse rounded-lg bg-ink-100" />
            </section>
          </div>
        </div>

        <div class="grid gap-2.5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-4">
          <!-- Últimos movimientos -->
          <section class="card flex flex-col px-3 py-1 lg:px-5" aria-labelledby="latest-title">
            <div class="flex min-h-11 items-center justify-between gap-2">
              <h2 id="latest-title" class="section-title">Últimos movimientos</h2>
              <RouterLink
                to="/admin/movimientos"
                class="inline-flex min-h-11 items-center text-xs font-extrabold text-brand-700 hover:text-ink-900"
                >Ver todos</RouterLink
              >
            </div>
            <p v-if="data && !feed.length" class="border-t border-ink-900/8 py-4 text-[13px] text-ink-500">
              Todavía no hay movimientos.
            </p>
            <ul v-else class="flex flex-col">
              <li v-if="!data" class="flex min-h-[42px] items-center border-t border-ink-900/8">
                <span class="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
              </li>
              <li
                v-for="row in feed"
                :key="row.key"
                class="flex min-h-[42px] items-center gap-2.5 border-t border-ink-900/8 text-[13px] lg:text-sm"
              >
                <template v-if="row.kind === 'purchase'">
                  <span
                    class="grid size-[26px] shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700"
                  >
                    <Icon name="bag" :size="14" :stroke="2.6" />
                  </span>
                  <RouterLink
                    v-if="row.purchaseId"
                    :to="`/admin/compras/${row.purchaseId}`"
                    class="min-w-0 flex-1 truncate py-2 text-ink-800 hover:underline"
                    ><strong class="text-ink-900">Compra</strong> {{ purchaseText(row) }}</RouterLink
                  >
                  <span v-else class="min-w-0 flex-1 truncate text-ink-800"
                    ><strong class="text-ink-900">Compra</strong> {{ purchaseText(row) }}</span
                  >
                  <time class="shrink-0 text-[11px] text-ink-500" :datetime="row.createdAt">{{
                    when(row.createdAt)
                  }}</time>
                </template>
                <template v-else>
                  <span
                    class="grid size-[26px] shrink-0 place-items-center rounded-lg"
                    :class="
                      row.movement.type === 'OUT'
                        ? 'bg-accent-100 text-accent-700'
                        : 'bg-success-50 text-success-700'
                    "
                  >
                    <Icon
                      :name="row.movement.type === 'OUT' ? 'arrowUp' : 'arrowDown'"
                      :size="14"
                      :stroke="3"
                    />
                    <span class="sr-only">{{ row.movement.type === 'OUT' ? 'Retiro' : 'Ingreso' }}</span>
                  </span>
                  <span
                    v-if="row.movement.source === 'PURCHASE_VOID'"
                    class="min-w-0 flex-1 truncate text-ink-800"
                  >
                    <strong class="text-ink-900">Compra anulada:</strong> salieron {{ row.movement.quantity }}
                    {{ row.movement.product.name }}
                  </span>
                  <span v-else class="min-w-0 flex-1 truncate text-ink-800"
                    ><strong class="text-ink-900">{{ shortName(row.movement.performedBy) }}</strong>
                    {{ row.movement.type === 'OUT' ? 'retiró' : 'ingresó' }} {{ row.movement.quantity }}
                    {{ row.movement.product.name }}</span
                  >
                  <time class="shrink-0 text-[11px] text-ink-500" :datetime="row.movement.createdAt">{{
                    when(row.movement.createdAt)
                  }}</time>
                </template>
              </li>
            </ul>
          </section>

          <!-- Más retiros · 30 días -->
          <section
            class="card flex flex-col gap-2 px-3 pt-2.5 pb-3 lg:px-5 lg:py-4"
            aria-labelledby="month-title"
          >
            <h2 id="month-title" class="section-title">Más retiros · 30 días</h2>
            <ul
              v-if="monthRows.length"
              class="flex flex-col gap-2 text-xs lg:text-sm"
              aria-label="Unidades retiradas por persona en los últimos 30 días"
            >
              <li
                v-for="(row, i) in monthRows"
                :key="row.user.id"
                class="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2 lg:grid-cols-[130px_minmax(0,1fr)_32px]"
              >
                <span class="truncate font-bold text-ink-900">{{ fullName(row.user) }}</span>
                <span class="block h-2.5" aria-hidden="true">
                  <span
                    class="block h-full rounded"
                    :class="i === 0 ? 'bg-brand-600' : 'bg-[#9DB6C9]'"
                    :style="{ width: `${Math.max(8, (row.totalWithdrawn / monthMax) * 100)}%` }"
                  />
                </span>
                <span class="num text-right text-ink-800"
                  >{{ formatNumber(row.totalWithdrawn) }}<span class="sr-only"> unidades</span></span
                >
              </li>
            </ul>
            <p v-else-if="data" class="text-xs text-ink-500">Sin retiros en los últimos 30 días.</p>
          </section>
        </div>
      </div>
    </div>
  </AdminPage>
</template>
