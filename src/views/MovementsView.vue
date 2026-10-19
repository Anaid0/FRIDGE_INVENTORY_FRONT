<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementFilter } from '@/domain/inputs';
import type { MovementView } from '@/domain/models';
import { useServices } from '@/services/container';
import { useLookupsStore } from '@/stores/lookups';
import { daysAgo, endOfDayISO, formatPeriodRange, startOfDayISO, toLocalDateInput } from '@/utils/dates';
import { formatNumber, fullName } from '@/utils/format';

/**
 * Filtro "tipo" combinado (tipo + origen). El control segmentado muestra Todos / Salidas / Entradas; las
 * otras dos opciones siguen funcionando por URL (enlaces desde otras pantallas).
 */
const KINDS = {
  '': { label: 'Todos', filter: {} },
  out: { label: 'Salidas', filter: { type: 'OUT', source: 'MANUAL' } },
  in: { label: 'Entradas', filter: { type: 'IN' } },
  purchase: { label: 'Entradas por compra', filter: { source: 'PURCHASE' } },
  void: { label: 'Anulaciones de compra', filter: { source: 'PURCHASE_VOID' } },
} as const satisfies Record<string, { label: string; filter: MovementFilter }>;
type Kind = keyof typeof KINDS;
const SEGMENTS: Kind[] = ['', 'out', 'in'];

const PAGE_SIZE = 20;
const { movements, funding } = useServices();
const lookups = useLookupsStore();
const route = useRoute();
const router = useRouter();

const q = (name: string) => (typeof route.query[name] === 'string' ? (route.query[name] as string) : '');
const filtersFromRoute = () => ({
  kind: (q('kind') in KINDS ? q('kind') : '') as Kind,
  productId: q('productId'),
  performedBy: q('performedBy'),
  from: q('from'),
  to: q('to'),
  page: Number(q('page')) || 1,
});
const filters = reactive(filtersFromRoute());

const { data, error, loading, run } = useAsync(() =>
  movements.list({
    ...KINDS[filters.kind].filter,
    productId: filters.productId || undefined,
    performedBy: filters.performedBy || undefined,
    from: filters.from ? startOfDayISO(filters.from) : undefined,
    to: filters.to ? endOfDayISO(filters.to) : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }),
);
const currentPeriod = useAsync(() => funding.current());

// Los filtros viven en la URL: se pueden compartir y el botón "atrás" funciona.
watch(
  () => ({ ...filters }),
  (now, before) => {
    if (before && now.page === before.page) filters.page = 1;
    const query = Object.fromEntries(
      Object.entries({ ...filters, page: filters.page > 1 ? String(filters.page) : '' }).filter(([, v]) => v),
    );
    void router.replace({ query });
    void run();
  },
);

// Al (re)entrar se leen los filtros de la URL (p. ej. "Ver movimientos" de un producto).
useOnEnter(() => {
  const fromRoute = filtersFromRoute();
  if (JSON.stringify(fromRoute) !== JSON.stringify({ ...filters })) Object.assign(filters, fromRoute);
  else void run();
  void lookups.ensureProducts().catch(() => undefined);
  void lookups.ensureUsers().catch(() => undefined);
  void currentPeriod.run();
});

const hasFilters = computed(() =>
  Boolean(filters.kind || filters.productId || filters.performedBy || filters.from || filters.to),
);
function clearFilters() {
  customRange.value = false;
  Object.assign(filters, { kind: '', productId: '', performedBy: '', from: '', to: '', page: 1 });
}

// --- Rango de fechas: atajos (esta quincena, hoy, 7 y 30 días) o fechas a mano ---
type Range = '' | 'period' | 'today' | '7d' | '30d' | 'custom';
const customRange = ref(false);
const today = () => toLocalDateInput();
const presets = computed((): Partial<Record<Range, { from: string; to: string }>> => {
  const period = currentPeriod.data.value;
  return {
    '': { from: '', to: '' },
    ...(period ? { period: { from: period.startDate, to: period.endDate } } : {}),
    today: { from: today(), to: today() },
    '7d': { from: toLocalDateInput(daysAgo(6)), to: '' },
    '30d': { from: toLocalDateInput(daysAgo(29)), to: '' },
  };
});
const range = computed<Range>({
  get() {
    if (customRange.value) return 'custom';
    const match = Object.entries(presets.value).find(
      ([, value]) => value.from === filters.from && value.to === filters.to,
    );
    return match ? (match[0] as Range) : 'custom';
  },
  set(value) {
    customRange.value = value === 'custom';
    const preset = presets.value[value];
    if (preset) Object.assign(filters, preset);
  },
});
const periodLabel = computed(() => {
  const period = currentPeriod.data.value;
  return period
    ? `Esta quincena · ${formatPeriodRange(period.startDate, period.endDate, true).replace(/ \d{4}$/, '')}`
    : '';
});

// --- Agrupado por día ---
const TIME = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function dayLabel(key: string): string {
  const text = DAY.format(new Date(`${key}T12:00:00`)).replace(',', '');
  if (key === today()) return `Hoy · ${text}`;
  if (key === toLocalDateInput(daysAgo(1))) return `Ayer · ${text}`;
  return text;
}

const groups = computed(() => {
  const result: { key: string; label: string; items: MovementView[] }[] = [];
  for (const m of data.value?.items ?? []) {
    const key = toLocalDateInput(new Date(m.createdAt));
    const last = result[result.length - 1];
    if (last?.key === key) last.items.push(m);
    else result.push({ key, label: dayLabel(key), items: [m] });
  }
  return result;
});
</script>

<template>
  <AdminPage title="Movimientos">
    <section>
      <PageHeader
        title="Movimientos"
        subtitle="Todo lo que entra y sale de la nevera. Es un registro de auditoría: nada se borra."
      />

      <div class="card mb-5 flex flex-wrap items-center gap-2.5 rounded-[18px] p-3">
        <div role="group" aria-label="Tipo de movimiento" class="segmented max-sm:w-full">
          <button
            v-for="kind in SEGMENTS"
            :key="kind"
            type="button"
            class="segmented-option min-h-10 max-sm:flex-1"
            :aria-pressed="filters.kind === kind"
            @click="filters.kind = kind"
          >
            {{ KINDS[kind].label }}
          </button>
        </div>
        <select
          v-model="filters.productId"
          class="input min-h-11 w-auto py-2 max-sm:w-full"
          aria-label="Producto"
        >
          <option value="">Todos los productos</option>
          <option v-for="p in lookups.products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select
          v-model="filters.performedBy"
          class="input min-h-11 w-auto py-2 max-sm:w-full"
          aria-label="Persona"
        >
          <option value="">Todas las personas</option>
          <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
        </select>
        <label
          class="relative flex min-h-11 items-center gap-2 rounded-xl border border-ink-300 bg-white/80 pr-2 pl-3.5 text-[15px] font-bold text-ink-900 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 max-sm:w-full"
        >
          <Icon name="calendar" :size="18" class="text-ink-700" />
          <span class="sr-only">Fechas</span>
          <select
            v-model="range"
            class="min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent py-2 pr-6 outline-none focus-visible:outline-none"
          >
            <option value="">Todas las fechas</option>
            <option v-if="presets.period" value="period">{{ periodLabel }}</option>
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Elegir fechas…</option>
          </select>
          <Icon
            name="chevronRight"
            :size="14"
            class="pointer-events-none absolute right-3 rotate-90 text-ink-500"
          />
        </label>
        <template v-if="range === 'custom'">
          <label class="flex items-center gap-2 text-sm font-bold text-ink-700">
            Desde <input v-model="filters.from" type="date" class="input min-h-11 w-auto py-2" />
          </label>
          <label class="flex items-center gap-2 text-sm font-bold text-ink-700">
            Hasta
            <input v-model="filters.to" type="date" class="input min-h-11 w-auto py-2" :min="filters.from" />
          </label>
        </template>
        <div class="ml-auto flex items-center gap-3 text-sm text-ink-500">
          <button
            v-if="hasFilters"
            type="button"
            class="min-h-11 font-extrabold text-brand-600 hover:text-brand-800"
            @click="clearFilters"
          >
            Limpiar filtros
          </button>
          <span v-if="data" class="tabular-nums" role="status"
            >{{ formatNumber(data.total) }} {{ data.total === 1 ? 'movimiento' : 'movimientos' }}</span
          >
        </div>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="card overflow-hidden transition-opacity" :class="{ 'opacity-60': loading && data }">
        <EmptyState
          v-if="data && !data.items.length"
          icon="list"
          title="No hay movimientos"
          :message="
            hasFilters
              ? 'Ningún movimiento coincide con los filtros.'
              : 'Todavía nadie ha metido ni sacado productos.'
          "
        />
        <div v-else class="overflow-x-auto">
          <table class="mv-table w-full text-left text-[15px] md:min-w-[760px]">
            <caption class="sr-only">
              Movimientos agrupados por día
            </caption>
            <thead class="text-[13px] text-ink-500 max-md:sr-only">
              <tr>
                <th scope="col" class="py-3.5 pr-3 pl-5 font-extrabold">Hora</th>
                <th scope="col" class="px-3 py-3.5 font-extrabold">Movimiento</th>
                <th scope="col" class="px-3 py-3.5 font-extrabold">Producto</th>
                <th scope="col" class="px-3 py-3.5 text-right font-extrabold">Cant.</th>
                <th scope="col" class="px-3 py-3.5 text-center font-extrabold">Stock</th>
                <th scope="col" class="py-3.5 pr-5 pl-3 font-extrabold">Quién</th>
              </tr>
            </thead>
            <tbody v-if="!data">
              <tr>
                <td colspan="6" class="px-5 py-5">
                  <div class="h-5 w-1/3 animate-pulse rounded bg-ink-100" />
                </td>
              </tr>
            </tbody>
            <tbody v-for="group in groups" :key="group.key">
              <tr data-day>
                <th
                  colspan="6"
                  scope="colgroup"
                  class="bg-white/45 px-5 py-2.5 text-[13px] font-extrabold tracking-[0.04em] text-ink-700 uppercase"
                >
                  {{ group.label }}
                </th>
              </tr>
              <tr v-for="m in group.items" :key="m.id" data-movement class="border-t border-ink-200/60">
                <td class="mv-time py-3 pr-3 pl-5 whitespace-nowrap text-ink-500">
                  <time :datetime="m.createdAt">{{ TIME.format(new Date(m.createdAt)) }}</time>
                </td>
                <td class="mv-type px-3 py-3"><MovementTypeBadge :type="m.type" :source="m.source" /></td>
                <td class="mv-product px-3 py-3">
                  <p class="font-extrabold text-ink-900">{{ m.product.name }}</p>
                  <RouterLink
                    v-if="m.purchaseId"
                    :to="`/admin/compras/${m.purchaseId}`"
                    class="text-xs font-bold text-brand-600 hover:underline"
                  >
                    {{ m.note ?? 'Ver compra' }}
                  </RouterLink>
                  <p v-else-if="m.note" class="text-xs text-ink-500">{{ m.note }}</p>
                </td>
                <td
                  class="mv-qty px-3 py-3 text-right font-extrabold tabular-nums"
                  :class="m.type === 'OUT' ? 'text-accent-700' : 'text-success-700'"
                >
                  {{ m.type === 'OUT' ? '−' : '+' }}{{ m.quantity }}
                </td>
                <td class="mv-stock px-3 py-3 text-center whitespace-nowrap text-ink-500 tabular-nums">
                  <span class="sr-only">Stock: </span>{{ m.stockBefore }} → {{ m.stockAfter }}
                </td>
                <td class="mv-who py-3 pr-5 pl-3">
                  <p class="font-bold text-ink-800">{{ fullName(m.performedBy) }}</p>
                  <p v-if="m.performedBy.id !== m.registeredBy.id" class="text-xs text-ink-500">
                    registrado por {{ fullName(m.registeredBy) }}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination
          v-if="data && data.items.length"
          class="border-t border-ink-200/60"
          :page="data.page"
          :page-size="data.pageSize"
          :total="data.total"
          @change="filters.page = $event"
        />
      </div>
    </section>
  </AdminPage>
</template>

<style scoped>
/* Celular y tablet en vertical: cada movimiento es una fila apilada (sin tabla ancha ni scroll lateral). */
@media (max-width: 767px) {
  .mv-table,
  .mv-table tbody {
    display: block;
  }
  .mv-table tr[data-day] {
    display: block;
  }
  .mv-table tr[data-day] th {
    display: block;
  }
  .mv-table tr[data-movement] {
    display: grid;
    grid-template-columns: 5.75rem minmax(0, 1fr) auto;
    grid-template-areas:
      'type product qty'
      'time who stock';
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.25rem;
    padding: 0.75rem 1rem;
  }
  .mv-table tr[data-movement] td {
    padding: 0;
  }
  .mv-type {
    grid-area: type;
  }
  .mv-product {
    grid-area: product;
  }
  .mv-qty {
    grid-area: qty;
  }
  .mv-time {
    grid-area: time;
    font-size: 13px;
  }
  .mv-who {
    grid-area: who;
    font-size: 14px;
  }
  .mv-stock {
    grid-area: stock;
    font-size: 13px;
  }
}
</style>
