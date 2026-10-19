<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementFilter } from '@/domain/inputs';
import { useServices } from '@/services/container';
import { useLookupsStore } from '@/stores/lookups';
import { endOfDayISO, startOfDayISO } from '@/utils/dates';
import { formatDateTime, fullName } from '@/utils/format';

/** Filtro "tipo" combinado (tipo + origen) para que sea fácil de entender. */
const KINDS = {
  '': { label: 'Todos', filter: {} },
  out: { label: 'Salidas (retiros)', filter: { type: 'OUT', source: 'MANUAL' } },
  in: { label: 'Entradas manuales', filter: { type: 'IN', source: 'MANUAL' } },
  purchase: { label: 'Entradas por compra', filter: { source: 'PURCHASE' } },
  void: { label: 'Anulaciones de compra', filter: { source: 'PURCHASE_VOID' } },
} as const satisfies Record<string, { label: string; filter: MovementFilter }>;
type Kind = keyof typeof KINDS;

const PAGE_SIZE = 20;
const { movements } = useServices();
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
});

const hasFilters = computed(() =>
  Boolean(filters.kind || filters.productId || filters.performedBy || filters.from || filters.to),
);
function clearFilters() {
  Object.assign(filters, { kind: '', productId: '', performedBy: '', from: '', to: '', page: 1 });
}
</script>

<template>
  <AdminPage title="Movimientos">
    <section>
      <PageHeader title="Movimientos" subtitle="Todo lo que entra y sale de la nevera. Nada se borra." />

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <select v-model="filters.kind" class="input w-auto" aria-label="Tipo de movimiento">
          <option v-for="(kind, key) in KINDS" :key="key" :value="key">{{ kind.label }}</option>
        </select>
        <select v-model="filters.productId" class="input w-auto" aria-label="Producto">
          <option value="">Todos los productos</option>
          <option v-for="p in lookups.products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="filters.performedBy" class="input w-auto" aria-label="Persona">
          <option value="">Todas las personas</option>
          <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-ink-600">
          Desde <input v-model="filters.from" type="date" class="input w-auto" />
        </label>
        <label class="flex items-center gap-2 text-sm text-ink-600">
          Hasta <input v-model="filters.to" type="date" class="input w-auto" />
        </label>
        <button
          v-if="hasFilters"
          type="button"
          class="text-sm font-medium text-brand-700 hover:underline"
          @click="clearFilters"
        >
          Limpiar filtros
        </button>
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
          <table class="w-full text-left text-sm">
            <thead class="border-b border-ink-100 bg-ink-50 text-xs text-ink-500">
              <tr>
                <th scope="col" class="px-4 py-3 font-medium">Fecha</th>
                <th scope="col" class="px-4 py-3 font-medium">Movimiento</th>
                <th scope="col" class="px-4 py-3 font-medium">Producto</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Cantidad</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" class="px-4 py-3 font-medium">Quién</th>
                <th scope="col" class="px-4 py-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="m in data?.items ?? []" :key="m.id" class="align-top">
                <td class="px-4 py-3 whitespace-nowrap text-ink-600">{{ formatDateTime(m.createdAt) }}</td>
                <td class="px-4 py-3"><MovementTypeBadge :type="m.type" :source="m.source" /></td>
                <td class="px-4 py-3 font-medium text-ink-900">{{ m.product.name }}</td>
                <td
                  class="px-4 py-3 text-right font-semibold tabular-nums"
                  :class="m.type === 'OUT' ? 'text-ink-900' : 'text-brand-800'"
                >
                  {{ m.type === 'OUT' ? '−' : '+' }}{{ m.quantity }}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap text-ink-500 tabular-nums">
                  {{ m.stockBefore }} → {{ m.stockAfter }}
                </td>
                <td class="px-4 py-3">
                  <p class="text-ink-900">{{ fullName(m.performedBy) }}</p>
                  <p v-if="m.performedBy.id !== m.registeredBy.id" class="text-xs text-ink-500">
                    registrado por {{ fullName(m.registeredBy) }}
                  </p>
                </td>
                <td class="max-w-56 px-4 py-3 text-ink-600">
                  <RouterLink
                    v-if="m.purchaseId"
                    :to="`/admin/compras/${m.purchaseId}`"
                    class="text-brand-700 hover:underline"
                  >
                    {{ m.note ?? 'Ver compra' }}
                  </RouterLink>
                  <span v-else>{{ m.note ?? '' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination
          v-if="data && data.total > data.pageSize"
          class="border-t border-ink-100"
          :page="data.page"
          :page-size="data.pageSize"
          :total="data.total"
          @change="filters.page = $event"
        />
      </div>
    </section>
  </AdminPage>
</template>
