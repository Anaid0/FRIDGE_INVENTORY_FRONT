<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MovementDayList from '@/components/MovementDayList.vue';
import MovementLegend from '@/components/MovementLegend.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementFilter } from '@/domain/inputs';
import type { MovementView } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { daysAgo, endOfDayISO, formatPeriodRange, startOfDayISO, toLocalDateInput } from '@/utils/dates';
import { formatNumber, fullName } from '@/utils/format';

/**
 * Filtro "tipo" combinado (tipo + origen). El control segmentado muestra Todos / Retiros / Ingresos; las
 * otras dos opciones se eligen en "Filtros" (o llegan por URL desde otras pantallas).
 */
const KINDS = {
  '': { label: 'Todos', filter: {} },
  out: { label: 'Retiros', filter: { type: 'OUT', source: 'MANUAL' } },
  in: { label: 'Ingresos', filter: { type: 'IN' } },
  purchase: { label: 'Ingresos por compra', filter: { source: 'PURCHASE' } },
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
});
const filters = reactive(filtersFromRoute());
const currentPeriod = useAsync(() => funding.current());

// --- Lista paginada: la primera página reemplaza; "Cargar más" agrega la siguiente al final ---
const items = shallowRef<MovementView[]>([]);
const page = ref(1);
const listQuery = (pageNumber: number): MovementFilter => ({
  ...KINDS[filters.kind].filter,
  productId: filters.productId || undefined,
  performedBy: filters.performedBy || undefined,
  from: filters.from ? startOfDayISO(filters.from) : undefined,
  to: filters.to ? endOfDayISO(filters.to) : undefined,
  page: pageNumber,
  pageSize: PAGE_SIZE,
});
const { data, error, loading, run: runFirst } = useAsync(() => movements.list(listQuery(1)));
async function run() {
  const result = await runFirst();
  if (result) {
    items.value = result.items;
    page.value = 1;
  }
}

const loadingMore = ref(false);
const moreError = ref<string | null>(null);
const remaining = computed(() => Math.max(0, (data.value?.total ?? 0) - items.value.length));
async function loadMore() {
  loadingMore.value = true;
  moreError.value = null;
  try {
    const next = await movements.list(listQuery(page.value + 1));
    // Si mientras tanto cambió un filtro, la página que llegó ya no corresponde.
    if (loading.value) return;
    const seen = new Set(items.value.map((m) => m.id));
    items.value = [...items.value, ...next.items.filter((m) => !seen.has(m.id))];
    page.value = next.page;
  } catch (e) {
    moreError.value = errorMessage(e);
  } finally {
    loadingMore.value = false;
  }
}

// Los filtros viven en la URL: se pueden compartir y el botón "atrás" funciona.
// `all=1` distingue "Todo" (sin fechas, elegido a propósito) de entrar sin filtros (rango por defecto).
watch(
  () => ({ ...filters }),
  () => {
    const query = Object.fromEntries(Object.entries({ ...filters }).filter(([, v]) => v));
    if (!filters.from && !filters.to) query.all = '1';
    // Solo si seguimos aquí: si la sesión venció, ya se fue al login y no hay que tocar su URL.
    if (route.name === 'movements') void router.replace({ query });
    void run();
  },
);

/** Rango por defecto: la quincena abierta; si no hay, los últimos 30 días. */
function defaultRange() {
  return presets.value.period ?? presets.value['30d']!;
}

// Al (re)entrar se leen los filtros de la URL (p. ej. "Ver movimientos" de un producto).
// Sin ningún filtro en la URL se abre en la quincena actual.
useOnEnter(async () => {
  void lookups.ensureProducts().catch(() => undefined);
  void lookups.ensureUsers().catch(() => undefined);
  const fromRoute = filtersFromRoute();
  if (!Object.keys(route.query).length) {
    if (!currentPeriod.data.value) await currentPeriod.run();
    else void currentPeriod.run();
    Object.assign(fromRoute, defaultRange());
  } else void currentPeriod.run();
  if (JSON.stringify(fromRoute) !== JSON.stringify({ ...filters })) Object.assign(filters, fromRoute);
  else void run();
});

// --- Rango de fechas: atajos (esta quincena, hoy, 7 y 30 días, todo) o fechas a mano ---
type Range = 'all' | 'period' | 'today' | '7d' | '30d' | 'custom';
const customRange = ref(false);
const today = () => toLocalDateInput();
const presets = computed((): Partial<Record<Range, { from: string; to: string }>> => {
  const period = currentPeriod.data.value;
  return {
    ...(period ? { period: { from: period.startDate, to: period.endDate } } : {}),
    today: { from: today(), to: today() },
    '7d': { from: toLocalDateInput(daysAgo(6)), to: '' },
    '30d': { from: toLocalDateInput(daysAgo(29)), to: '' },
    all: { from: '', to: '' },
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
const shortRange = (from: string, to: string) => formatPeriodRange(from, to, true).replace(/ \d{4}$/, '');
const RANGE_LABELS: Record<Exclude<Range, 'period' | 'custom'>, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  all: 'Todo',
};
const periodLabel = computed(() => {
  const period = currentPeriod.data.value;
  return period ? `Esta quincena · ${shortRange(period.startDate, period.endDate)}` : '';
});
/** Texto del chip de fechas: "Esta quincena · 16 – 31 oct", "Últimos 7 días", "Desde 3 oct"… */
const rangeLabel = computed(() => {
  const value = range.value;
  if (value === 'period') return periodLabel.value;
  if (value !== 'custom') return RANGE_LABELS[value];
  const day = (d: string) => shortRange(d, d).replace(/^\d+ – /, '');
  if (filters.from && filters.to) return shortRange(filters.from, filters.to);
  if (filters.from) return `Desde ${day(filters.from)}`;
  if (filters.to) return `Hasta ${day(filters.to)}`;
  return 'Elegir fechas';
});

// --- Menú del chip de fechas ---
const rangeMenu = ref(false);
function pickRange(value: Range) {
  rangeMenu.value = false;
  if (value === 'custom') {
    customRange.value = true;
    filtersOpen.value = true;
  } else range.value = value;
}
function closeMenu(event: Event) {
  if (!(event.target as HTMLElement | null)?.closest?.('[data-range-menu]')) rangeMenu.value = false;
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') rangeMenu.value = false;
}
onMounted(() => {
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu);
  document.removeEventListener('keydown', onKey);
});

// --- Diálogo "Filtros" (tipo detallado, producto, persona y fechas) ---
const filtersOpen = ref(false);
/** Filtros que no se ven en el segmentado ni en el chip de fechas: el punto/número del botón. */
const activeCount = computed(
  () => [filters.productId, filters.performedBy, !SEGMENTS.includes(filters.kind)].filter(Boolean).length,
);
const hasFilters = computed(() => Boolean(filters.kind || filters.productId || filters.performedBy));
function clearFilters() {
  Object.assign(filters, { kind: '', productId: '', performedBy: '' });
}
const productName = computed(
  () => lookups.products.find((p) => p.id === filters.productId)?.name ?? 'Producto',
);
const personName = computed(() => {
  const user = lookups.users.find((u) => u.id === filters.performedBy);
  return user ? fullName(user) : 'Persona';
});
</script>

<template>
  <AdminPage title="Movimientos">
    <section class="mx-auto max-w-3xl">
      <PageHeader title="Movimientos" subtitle="Registro de auditoría: nada se borra.">
        <template #badge><MovementLegend /></template>
      </PageHeader>

      <div class="flex gap-1.5">
        <div role="group" aria-label="Tipo de movimiento" class="segmented grid min-w-0 flex-1 grid-cols-3">
          <button
            v-for="kind in SEGMENTS"
            :key="kind"
            type="button"
            class="segmented-option min-h-10 px-2"
            :aria-pressed="filters.kind === kind"
            @click="filters.kind = kind"
          >
            {{ KINDS[kind].label }}
          </button>
        </div>
        <button
          type="button"
          class="glass relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-extrabold text-ink-900"
          aria-haspopup="dialog"
          :aria-label="activeCount ? `Filtros (${activeCount} activos)` : 'Filtros'"
          @click="filtersOpen = true"
        >
          <Icon name="filter" :size="16" :stroke="2.2" /> Filtros
          <span
            v-if="activeCount"
            class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-accent-500 text-[11px] font-black text-ink-900"
            aria-hidden="true"
            >{{ activeCount }}</span
          >
        </button>
      </div>

      <div class="mt-2 mb-3 flex flex-wrap items-center gap-1.5">
        <div class="relative" data-range-menu>
          <button
            type="button"
            class="flex min-h-8 items-center gap-1 rounded-full bg-ink-900/8 px-3 text-[12px] font-extrabold text-ink-900 hover:bg-ink-900/12"
            aria-haspopup="menu"
            :aria-expanded="rangeMenu"
            :aria-label="`Fechas: ${rangeLabel}. Cambiar`"
            @click="rangeMenu = !rangeMenu"
          >
            {{ rangeLabel }}
            <Icon name="chevronRight" :size="12" :stroke="2.6" class="rotate-90 text-ink-500" />
          </button>
          <div
            v-if="rangeMenu"
            role="menu"
            class="glass-strong absolute top-full left-0 z-20 mt-1.5 flex min-w-52 flex-col rounded-2xl p-1.5"
          >
            <button
              v-if="presets.period"
              type="button"
              role="menuitemradio"
              :aria-checked="range === 'period'"
              class="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-ink-900 hover:bg-brand-50 aria-checked:bg-ink-900/8 aria-checked:font-extrabold"
              @click="pickRange('period')"
            >
              {{ periodLabel }}
            </button>
            <button
              v-for="(label, key) in RANGE_LABELS"
              :key="key"
              type="button"
              role="menuitemradio"
              :aria-checked="range === key"
              class="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-ink-900 hover:bg-brand-50 aria-checked:bg-ink-900/8 aria-checked:font-extrabold"
              @click="pickRange(key)"
            >
              {{ label }}
            </button>
            <button
              type="button"
              role="menuitemradio"
              :aria-checked="range === 'custom'"
              class="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-ink-900 hover:bg-brand-50 aria-checked:bg-ink-900/8 aria-checked:font-extrabold"
              @click="pickRange('custom')"
            >
              Elegir fechas…
            </button>
          </div>
        </div>
        <span
          v-if="data"
          class="flex min-h-8 items-center rounded-full bg-ink-900/8 px-3 text-[12px] font-bold text-ink-700 tabular-nums"
          role="status"
          >{{ formatNumber(data.total) }} {{ data.total === 1 ? 'movimiento' : 'movimientos' }}</span
        >
        <button
          v-if="!SEGMENTS.includes(filters.kind)"
          type="button"
          class="flex min-h-8 items-center gap-1 rounded-full bg-brand-100 px-3 text-[12px] font-extrabold text-brand-700 hover:bg-brand-200"
          :aria-label="`Quitar filtro: ${KINDS[filters.kind].label}`"
          @click="filters.kind = ''"
        >
          {{ KINDS[filters.kind].label }} <Icon name="x" :size="12" :stroke="2.6" />
        </button>
        <button
          v-if="filters.productId"
          type="button"
          class="flex min-h-8 items-center gap-1 rounded-full bg-brand-100 px-3 text-[12px] font-extrabold text-brand-700 hover:bg-brand-200"
          :aria-label="`Quitar filtro de producto: ${productName}`"
          @click="filters.productId = ''"
        >
          {{ productName }} <Icon name="x" :size="12" :stroke="2.6" />
        </button>
        <button
          v-if="filters.performedBy"
          type="button"
          class="flex min-h-8 items-center gap-1 rounded-full bg-brand-100 px-3 text-[12px] font-extrabold text-brand-700 hover:bg-brand-200"
          :aria-label="`Quitar filtro de persona: ${personName}`"
          @click="filters.performedBy = ''"
        >
          {{ personName }} <Icon name="x" :size="12" :stroke="2.6" />
        </button>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <!-- Cargando la primera vez: filas de esqueleto -->
      <div v-else-if="!data" class="glass-strong rounded-[18px] px-3" aria-busy="true" aria-label="Cargando">
        <div
          v-for="n in 5"
          :key="n"
          class="flex items-center gap-3 border-b border-ink-900/8 py-3 last:border-0"
        >
          <span class="size-8 animate-pulse rounded-[10px] bg-ink-900/8" />
          <span class="flex flex-1 flex-col gap-1.5">
            <span class="h-3.5 w-2/5 animate-pulse rounded bg-ink-900/8" />
            <span class="h-3 w-3/5 animate-pulse rounded bg-ink-900/6" />
          </span>
        </div>
      </div>

      <div v-else-if="!items.length" class="card">
        <EmptyState
          icon="list"
          title="No hay movimientos"
          :message="
            hasFilters || range !== 'all'
              ? 'Ningún movimiento coincide con los filtros o las fechas.'
              : 'Todavía nadie ha retirado ni ingresado productos.'
          "
        >
          <button v-if="range !== 'all'" type="button" class="btn-secondary" @click="range = 'all'">
            Ver todo el historial
          </button>
        </EmptyState>
      </div>

      <div v-else class="transition-opacity" :class="{ 'opacity-60': loading }">
        <MovementDayList :movements="items" detailed />
        <p v-if="moreError" class="mt-3 text-center text-[13px] font-bold text-danger-700" role="alert">
          {{ moreError }}
        </p>
        <button
          v-if="remaining > 0"
          type="button"
          class="glass mt-3.5 flex min-h-11 w-full items-center justify-center rounded-xl text-[13px] font-extrabold text-brand-700 hover:bg-white/80 disabled:opacity-60"
          :disabled="loadingMore || loading"
          @click="loadMore"
        >
          {{ loadingMore ? 'Cargando…' : `Cargar más · quedan ${formatNumber(remaining)}` }}
        </button>
      </div>

      <BaseDialog :open="filtersOpen" title="Filtros" @close="filtersOpen = false">
        <div class="flex flex-col gap-4">
          <label class="flex flex-col">
            <span class="label">Tipo de movimiento</span>
            <select v-model="filters.kind" class="input min-h-11">
              <option v-for="(kind, key) in KINDS" :key="key" :value="key">{{ kind.label }}</option>
            </select>
          </label>
          <label class="flex flex-col">
            <span class="label">Producto</span>
            <select v-model="filters.productId" class="input min-h-11">
              <option value="">Todos los productos</option>
              <option v-for="p in lookups.products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="flex flex-col">
            <span class="label">Persona</span>
            <select v-model="filters.performedBy" class="input min-h-11">
              <option value="">Todas las personas</option>
              <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
            </select>
          </label>
          <label class="flex flex-col">
            <span class="label">Fechas</span>
            <select v-model="range" class="input min-h-11">
              <option v-if="presets.period" value="period">{{ periodLabel }}</option>
              <option value="today">Hoy</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo</option>
              <option value="custom">Elegir fechas…</option>
            </select>
          </label>
          <div v-if="range === 'custom'" class="grid grid-cols-2 gap-2">
            <label class="flex min-w-0 flex-col">
              <span class="label">Desde</span>
              <input
                v-model="filters.from"
                type="date"
                class="input min-h-11"
                :max="filters.to || undefined"
              />
            </label>
            <label class="flex min-w-0 flex-col">
              <span class="label">Hasta</span>
              <input
                v-model="filters.to"
                type="date"
                class="input min-h-11"
                :min="filters.from || undefined"
              />
            </label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="btn-secondary min-h-11"
              :disabled="!hasFilters"
              @click="clearFilters"
            >
              Limpiar
            </button>
            <button type="button" class="btn-primary min-h-11" @click="filtersOpen = false">
              Ver {{ data ? formatNumber(data.total) : '' }} movimientos
            </button>
          </div>
        </div>
      </BaseDialog>
    </section>
  </AdminPage>
</template>
