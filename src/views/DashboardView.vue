<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import PeriodBalanceCard from '@/components/PeriodBalanceCard.vue';
import Badge from '@/components/ui/Badge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import ProductIcon from '@/components/ui/ProductIcon.vue';
import StatTile from '@/components/ui/StatTile.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementView, Product, TopWithdrawer } from '@/domain/models';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { startOfTodayISO } from '@/utils/dates';
import { formatNumber, formatRelative, fullName, withUnit } from '@/utils/format';

const { movements } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
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

useOnEnter(() => {
  void run();
  void leaders.run();
  void withdrawalsToday.run();
  void lookups.ensureCategories().catch(() => undefined);
});

const today = computed(() =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
);
const leader = computed(() => leaders.data.value?.rows[0] ?? null);
const chasers = computed(() => leaders.data.value?.rows.slice(1) ?? []);
const leaderDetail = computed(() => {
  if (!leader.value) return '';
  const { totalWithdrawn, withdrawals } = leader.value;
  const units = `${formatNumber(totalWithdrawn)} ${totalWithdrawn === 1 ? 'unidad' : 'unidades'}`;
  const times = `${formatNumber(withdrawals)} ${withdrawals === 1 ? 'retiro' : 'retiros'}`;
  const scope =
    leaders.data.value?.scope === 'period'
      ? (data.value?.currentPeriod?.name ?? 'esta quincena')
      : 'desde siempre';
  return `${units} en ${times} · ${scope}`;
});

const monthRows = computed(() => data.value?.topWithdrawers.last30Days.slice(0, 5) ?? []);
const monthMax = computed(() => Math.max(1, ...monthRows.value.map((row) => row.totalWithdrawn)));

function verb(m: MovementView): string {
  if (m.source === 'PURCHASE') return 'compró';
  return m.type === 'OUT' ? 'sacó' : 'metió';
}

/** "Queda 1 · mínimo 3"; con otra unidad, "Queda 1 botella · mínimo 2". */
function remaining(p: Product): string {
  const left = p.unit && p.unit !== 'unidad' ? withUnit(p.quantity, p.unit) : String(p.quantity);
  return p.quantity === 0 ? `Agotado · mínimo ${p.minStock}` : `Queda ${left} · mínimo ${p.minStock}`;
}
</script>

<template>
  <AdminPage title="Inicio">
    <section>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 class="page-title">Hola, {{ auth.user?.name }}</h1>
          <p class="mt-1 text-base text-ink-500">Así está la nevera de la oficina hoy, {{ today }}.</p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <RouterLink to="/admin/productos/nuevo" class="btn-secondary min-h-11 px-[18px]"
            ><Icon name="plus" :size="18" :stroke="2" /> Nuevo producto</RouterLink
          >
          <RouterLink to="/admin/productos" class="btn-primary min-h-11 px-[18px]"
            ><Icon name="arrowUpRight" :size="18" :stroke="2" /> Registrar movimiento</RouterLink
          >
        </div>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="flex flex-col gap-6 transition-opacity" :class="{ 'opacity-60': loading && data }">
        <div class="flex flex-wrap gap-5">
          <!-- Lo más importante de la vista: quién va ganando la quincena (quién más retira) -->
          <section
            class="flex min-w-0 flex-[2_1_520px] flex-wrap items-center gap-6 rounded-[var(--radius-card)] bg-accent-50/80 px-6 py-6 ring-1 ring-accent-200/70 backdrop-blur-md sm:px-7"
            aria-labelledby="leader-title"
          >
            <svg viewBox="0 0 240 240" class="size-24 shrink-0 sm:size-[120px]" aria-hidden="true">
              <circle cx="120" cy="120" r="116" fill="#ffe2c4" />
              <g transform="translate(20,18)">
                <ellipse cx="100" cy="232" rx="62" ry="60" fill="#0b79c3" />
                <circle cx="28" cy="100" r="24" fill="#0b79c3" />
                <circle cx="172" cy="100" r="24" fill="#0b79c3" />
                <circle cx="28" cy="100" r="11" fill="#fff" />
                <circle cx="172" cy="100" r="11" fill="#fff" />
                <circle cx="100" cy="100" r="74" fill="#0b79c3" />
                <circle cx="78" cy="90" r="28" fill="#fff" />
                <circle cx="122" cy="90" r="28" fill="#fff" />
                <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
                <circle cx="80" cy="88" r="12" fill="#073b5e" />
                <circle cx="120" cy="88" r="12" fill="#073b5e" />
                <circle cx="84" cy="84" r="4" fill="#fff" />
                <circle cx="124" cy="84" r="4" fill="#fff" />
                <ellipse cx="100" cy="136" rx="20" ry="16" fill="#073b5e" />
                <ellipse cx="100" cy="144" rx="11" ry="7" fill="#ff7a8a" />
              </g>
            </svg>
            <div class="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
              <p id="leader-title" class="eyebrow text-[13px] text-accent-700">
                {{ leaders.data.value?.scope === 'all' ? 'Quien más retira' : 'Va ganando la quincena' }}
              </p>
              <template v-if="leader">
                <RouterLink
                  to="/admin/ranking"
                  class="truncate text-[28px] leading-tight font-black text-ink-900 hover:text-brand-700 sm:text-[32px]"
                >
                  {{ fullName(leader.user) }}
                </RouterLink>
                <p class="text-base text-ink-700">{{ leaderDetail }}</p>
              </template>
              <p v-else-if="leaders.data.value" class="text-xl font-extrabold text-ink-700">
                Aún nadie ha sacado nada
              </p>
              <p v-else class="mt-1 h-8 w-56 animate-pulse rounded-lg bg-accent-100" />
            </div>
            <ol
              v-if="chasers.length"
              class="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:min-w-[210px] sm:flex-[0_1_230px]"
              aria-label="Le siguen"
            >
              <li
                v-for="(row, i) in chasers"
                :key="row.user.id"
                class="flex items-center gap-2.5 rounded-xl bg-white/75 px-3 py-2 ring-1 ring-white/80"
              >
                <span class="w-6 font-extrabold text-accent-700">{{ i + 2 }}</span>
                <span class="min-w-0 flex-1 truncate font-bold text-ink-800">{{ fullName(row.user) }}</span>
                <span class="font-extrabold text-ink-900 tabular-nums"
                  >{{ formatNumber(row.totalWithdrawn) }}<span class="sr-only"> unidades</span></span
                >
              </li>
            </ol>
          </section>

          <div class="flex min-w-0 flex-[1_1_300px] flex-col">
            <PeriodBalanceCard
              v-if="data?.currentPeriod"
              :summary="data.currentPeriod"
              compact
              class="flex-1"
            />
            <div v-else-if="data" class="card flex flex-1 flex-col justify-center gap-2 px-6 py-[22px]">
              <p class="text-[19px] font-black text-ink-900">Sin quincena abierta</p>
              <p class="text-sm text-ink-500">Abre una para registrar aportes y compras.</p>
              <RouterLink to="/admin/quincenas" class="btn-secondary mt-1 self-start"
                >Ir a quincenas</RouterLink
              >
            </div>
            <div v-else class="card h-full min-h-40 animate-pulse" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Productos activos" :value="data ? formatNumber(data.activeProducts) : '—'" />
          <StatTile label="Unidades en la nevera" :value="data ? formatNumber(data.totalUnits) : '—'" />
          <StatTile
            label="Con stock bajo"
            :value="data ? formatNumber(data.lowStockProducts.length) : '—'"
            :tone="data && data.lowStockProducts.length ? 'warning' : 'default'"
          />
          <StatTile
            label="Retiros hoy"
            :value="withdrawalsToday.data.value !== null ? formatNumber(withdrawalsToday.data.value) : '—'"
          />
        </div>

        <div class="flex flex-wrap items-start gap-5">
          <section class="card min-w-0 flex-[2_1_520px] overflow-hidden" aria-labelledby="latest-title">
            <div class="flex items-center justify-between gap-3 border-b border-ink-200/70 px-6 py-3">
              <h2 id="latest-title" class="text-[19px] font-black text-ink-900">Últimos movimientos</h2>
              <RouterLink
                to="/admin/movimientos"
                class="inline-flex min-h-11 items-center font-extrabold text-brand-600 hover:text-brand-800"
                >Ver todos</RouterLink
              >
            </div>
            <EmptyState
              v-if="data && !data.latestMovements.length"
              icon="list"
              title="Todavía no hay movimientos"
              message="Cuando alguien meta o saque productos aparecerá aquí."
            />
            <ul v-else class="divide-y divide-ink-200/60">
              <li v-if="!data" class="px-6 py-4">
                <div class="h-5 w-2/3 animate-pulse rounded bg-ink-100" />
              </li>
              <li
                v-for="m in data?.latestMovements.slice(0, 6) ?? []"
                :key="m.id"
                class="flex items-center gap-3.5 px-6 py-3"
              >
                <span class="w-[68px] shrink-0"
                  ><MovementTypeBadge :type="m.type" :source="m.source" plain
                /></span>
                <div class="min-w-0 flex-1">
                  <p v-if="m.source === 'PURCHASE_VOID'" class="text-[15px] text-ink-700">
                    Se anuló una compra: salieron {{ withUnit(m.quantity, m.product.unit) }} de
                    <strong class="font-extrabold text-ink-900">{{ m.product.name }}</strong>
                  </p>
                  <p v-else class="text-[15px] text-ink-700">
                    <strong class="font-extrabold text-ink-900">{{ fullName(m.performedBy) }}</strong>
                    {{ verb(m) }} {{ m.quantity }}
                    <strong class="font-extrabold text-ink-900">{{ m.product.name }}</strong>
                  </p>
                  <p
                    v-if="m.source !== 'PURCHASE_VOID' && m.performedBy.id !== m.registeredBy.id"
                    class="text-xs text-ink-500"
                  >
                    Registrado por {{ fullName(m.registeredBy) }}
                  </p>
                </div>
                <time class="shrink-0 text-[13px] text-ink-500" :datetime="m.createdAt">{{
                  formatRelative(m.createdAt)
                }}</time>
              </li>
            </ul>
          </section>

          <section class="card flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 px-6 pt-[18px] pb-[22px]">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-[19px] font-black text-ink-900">Por reponer</h2>
              <span class="text-[13px] text-ink-500">stock ≤ mínimo</span>
            </div>
            <ul v-if="data?.lowStockProducts.length" class="flex flex-col gap-3">
              <li v-for="p in data.lowStockProducts" :key="p.id" class="flex items-center gap-3">
                <ProductIcon :category="lookups.categoryName(p.categoryId)" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-extrabold text-ink-900">{{ p.name }}</p>
                  <p class="text-[13px] text-ink-500">{{ remaining(p) }}</p>
                </div>
                <Badge :tone="p.quantity === 0 ? 'danger' : 'accent'">{{
                  p.quantity === 0 ? 'Agotado' : 'Bajo'
                }}</Badge>
              </li>
            </ul>
            <p v-else-if="data" class="text-sm text-ink-500">Todo con buen stock.</p>

            <div class="h-px bg-ink-200/70" />
            <h2 class="text-[19px] font-black text-ink-900">Más retiros · 30 días</h2>
            <ul
              v-if="monthRows.length"
              class="flex flex-col gap-2.5 text-sm"
              aria-label="Unidades sacadas por persona en los últimos 30 días"
            >
              <li
                v-for="(row, i) in monthRows"
                :key="row.user.id"
                class="grid grid-cols-[minmax(0,120px)_1fr_44px] items-center gap-3"
              >
                <span class="truncate font-bold text-ink-800">{{ fullName(row.user) }}</span>
                <span class="h-3 rounded-full bg-ink-100/80" aria-hidden="true">
                  <span
                    class="block h-full rounded-full"
                    :class="i === 0 ? 'bg-brand-600' : 'bg-ink-400/70'"
                    :style="{ width: `${Math.max(8, (row.totalWithdrawn / monthMax) * 100)}%` }"
                  />
                </span>
                <span class="text-right font-extrabold text-ink-900 tabular-nums"
                  >{{ formatNumber(row.totalWithdrawn) }}<span class="sr-only"> unidades</span></span
                >
              </li>
            </ul>
            <p v-else-if="data" class="text-sm text-ink-500">Sin retiros en los últimos 30 días.</p>
          </section>
        </div>
      </div>
    </section>
  </AdminPage>
</template>
