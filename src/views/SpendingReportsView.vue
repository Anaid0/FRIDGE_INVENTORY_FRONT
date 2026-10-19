<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref, watch } from 'vue';
import BarChart from '@/components/charts/BarChart.vue';
import LineChart from '@/components/charts/LineChart.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatTile from '@/components/ui/StatTile.vue';
import { useAsync } from '@/composables/useAsync';
import type { ReportScope } from '@/domain/inputs';
import type { PeriodSummary } from '@/domain/models';
import { useServices } from '@/services/container';
import { useLookupsStore } from '@/stores/lookups';
import { daysAgo, endOfDayISO, startOfDayISO, toLocalDateInput } from '@/utils/dates';
import { formatDateTime, formatMoney, formatNumber, toCents } from '@/utils/format';

const TOP_PRODUCTS = 12;
const { reports, funding } = useServices();
const lookups = useLookupsStore();

const periods = ref<PeriodSummary[]>([]);
/** Alcance: "period:<id>", "days:30", "days:90" o "custom". */
const filters = reactive({ scope: '', from: toLocalDateInput(daysAgo(30)), to: toLocalDateInput() });

const scope = computed<ReportScope | null>(() => {
  if (filters.scope.startsWith('period:')) return { periodId: filters.scope.slice(7) };
  if (filters.scope.startsWith('days:'))
    return { from: daysAgo(Number(filters.scope.slice(5))).toISOString() };
  if (filters.scope === 'custom' && filters.from && filters.to) {
    return { from: startOfDayISO(filters.from), to: endOfDayISO(filters.to) };
  }
  return null;
});

const spending = useAsync(async (s: ReportScope) => {
  const [byProduct, byCategory] = await Promise.all([
    reports.spendingByProduct(s),
    reports.spendingByCategory(s),
  ]);
  return { byProduct, byCategory };
});

watch(scope, (s) => s && spending.run(s), { deep: true });

useOnEnter(async () => {
  void lookups.ensureProducts().catch(() => undefined);
  try {
    periods.value = await funding.list();
  } catch {
    periods.value = [];
  }
  // La primera vez se elige la quincena abierta; al volver se respeta lo que eligió el usuario.
  if (!filters.scope) {
    const open = periods.value.find((p) => p.status === 'OPEN');
    filters.scope = open ? `period:${open.periodId}` : 'days:30';
  } else if (scope.value) {
    void spending.run(scope.value);
  }
});

const totals = computed(() => {
  const rows = spending.data.value?.byProduct ?? [];
  return {
    spent: rows.reduce((sum, r) => sum + toCents(r.spent), 0) / 100,
    units: rows.reduce((sum, r) => sum + r.units, 0),
    products: rows.length,
  };
});

const productRows = computed(() =>
  (spending.data.value?.byProduct ?? []).slice(0, TOP_PRODUCTS).map((r) => ({
    key: r.productId,
    label: r.productName,
    value: toCents(r.spent) / 100,
    valueLabel: formatMoney(r.spent),
    detail: `${formatNumber(r.units)} und. · prom. ${formatMoney(r.averageUnitPrice)} c/u`,
  })),
);

const categoryRows = computed(() =>
  (spending.data.value?.byCategory ?? []).map((r) => ({
    key: r.categoryId ?? 'none',
    label: r.categoryName,
    value: toCents(r.spent) / 100,
    valueLabel: formatMoney(r.spent),
    detail: `${formatNumber(r.units)} und.`,
  })),
);

// --- Evolución del precio ---
const priceProductId = ref('');
const prices = useAsync((productId: string) => reports.priceHistory(productId));
watch(
  () => spending.data.value?.byProduct,
  (rows) => {
    if (!priceProductId.value && rows?.[0]) priceProductId.value = rows[0].productId;
  },
);
watch(priceProductId, (id) => id && prices.run(id));

const pricePoints = computed(() =>
  (prices.data.value ?? []).map((p) => ({
    date: p.purchasedAt,
    value: toCents(p.unitPrice) / 100,
    detail: p.store,
  })),
);
const priceProductName = computed(
  () => lookups.products.find((p) => p.id === priceProductId.value)?.name ?? 'el producto',
);
</script>

<template>
  <AdminPage title="Reportes de gasto">
    <section>
      <PageHeader
        title="Reportes de gasto"
        subtitle="En qué se va el dinero del fondo. No incluye compras anuladas."
      />

      <div class="mb-6 flex flex-wrap items-center gap-3">
        <select v-model="filters.scope" class="input w-auto" aria-label="Periodo del reporte">
          <optgroup label="Por fecha">
            <option value="days:30">Últimos 30 días</option>
            <option value="days:90">Últimos 90 días</option>
            <option value="custom">Rango personalizado…</option>
          </optgroup>
          <optgroup v-if="periods.length" label="Por quincena">
            <option v-for="p in periods" :key="p.periodId" :value="`period:${p.periodId}`">
              {{ p.name }}
            </option>
          </optgroup>
        </select>
        <template v-if="filters.scope === 'custom'">
          <label class="flex items-center gap-2 text-sm text-ink-600">
            Desde <input v-model="filters.from" type="date" class="input w-auto" />
          </label>
          <label class="flex items-center gap-2 text-sm text-ink-600">
            Hasta <input v-model="filters.to" type="date" class="input w-auto" :min="filters.from" />
          </label>
        </template>
      </div>

      <ErrorState
        v-if="spending.error.value && !spending.data.value"
        :message="spending.error.value"
        @retry="scope && spending.run(scope)"
      />

      <div
        v-else
        class="space-y-6 transition-opacity"
        :class="{ 'opacity-60': spending.loading.value && spending.data.value }"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Total gastado" :value="spending.data.value ? formatMoney(totals.spent) : '—'" />
          <StatTile
            label="Unidades compradas"
            :value="spending.data.value ? formatNumber(totals.units) : '—'"
          />
          <StatTile
            label="Productos distintos"
            :value="spending.data.value ? formatNumber(totals.products) : '—'"
          />
        </div>

        <div v-if="spending.data.value && !productRows.length" class="card">
          <EmptyState icon="chart" title="No hay compras en este periodo" />
        </div>

        <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="card p-5">
            <h2 class="text-[19px] font-black text-ink-900">Gasto por producto</h2>
            <p class="mb-4 text-xs text-ink-500">
              De mayor a menor{{
                (spending.data.value?.byProduct.length ?? 0) > TOP_PRODUCTS ? ` · top ${TOP_PRODUCTS}` : ''
              }}
            </p>
            <BarChart
              :rows="productRows"
              caption="Gasto por producto"
              label-header="Producto"
              value-header="Gastado"
            />
          </div>
          <div class="card p-5">
            <h2 class="text-[19px] font-black text-ink-900">Gasto por categoría</h2>
            <p class="mb-4 text-xs text-ink-500">De mayor a menor</p>
            <BarChart
              :rows="categoryRows"
              caption="Gasto por categoría"
              label-header="Categoría"
              value-header="Gastado"
            />
          </div>
        </div>

        <div class="card p-5">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="text-[19px] font-black text-ink-900">Evolución del precio</h2>
              <p class="text-xs text-ink-500">
                Precio unitario pagado por {{ priceProductName }} en cada compra, en orden de fecha (todo el
                historial)
              </p>
            </div>
            <select v-model="priceProductId" class="input w-auto" aria-label="Producto">
              <option value="" disabled>Elige un producto</option>
              <option v-for="p in lookups.products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <p v-if="prices.error.value" class="text-sm text-danger-700">{{ prices.error.value }}</p>
          <EmptyState
            v-else-if="prices.data.value && !pricePoints.length"
            icon="chart"
            title="Este producto no se ha comprado aún"
          />
          <LineChart
            v-else-if="pricePoints.length"
            :points="pricePoints"
            :caption="`Precio unitario de ${priceProductName} por compra`"
            :format-value="(v) => formatMoney(v)"
            :format-tick="(v) => formatMoney(v)"
            :format-date="(iso) => formatDateTime(iso).split(',')[0] ?? iso"
          />
        </div>
      </div>
    </section>
  </AdminPage>
</template>
