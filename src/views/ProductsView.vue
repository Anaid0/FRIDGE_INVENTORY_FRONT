<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import MovementDialog from '@/components/MovementDialog.vue';
import StockBadge from '@/components/StockBadge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementType, Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';

const { catalog } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();

const filters = reactive({ search: '', categoryId: '', lowStock: false, includeInactive: false });
const {
  data: products,
  error,
  loading,
  run,
} = useAsync(() =>
  catalog.listProducts({
    search: filters.search.trim() || undefined,
    categoryId: filters.categoryId || undefined,
    lowStock: filters.lowStock || undefined,
    includeInactive: filters.includeInactive || undefined,
  }),
);

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(run, 300);
  },
);
watch(() => [filters.categoryId, filters.lowStock, filters.includeInactive], run);

useOnEnter(() => {
  void run();
  void lookups.ensureCategories().catch(() => undefined);
});

const dialog = ref<{ type: MovementType; product: Product } | null>(null);
const hasFilters = computed(() => Boolean(filters.search || filters.categoryId || filters.lowStock));

function openMovement(type: MovementType, product: Product) {
  dialog.value = { type, product };
}

function onDone(updated: Product) {
  dialog.value = null;
  if (products.value) products.value = products.value.map((p) => (p.id === updated.id ? updated : p));
}
</script>

<template>
  <AdminPage title="Productos">
    <section>
      <PageHeader title="Productos" subtitle="Lo que hay en la nevera. Usa Sacar cuando tomes algo.">
        <template #actions>
          <RouterLink v-if="auth.isAdmin" to="/admin/productos/nuevo" class="btn-primary">
            <Icon name="plus" :size="16" /> Nuevo producto
          </RouterLink>
        </template>
      </PageHeader>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <input
          v-model="filters.search"
          type="search"
          class="input max-w-xs"
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
        />
        <select v-model="filters.categoryId" class="input w-auto" aria-label="Categoría">
          <option value="">Todas las categorías</option>
          <option v-for="c in lookups.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="filters.lowStock" type="checkbox" class="size-4 accent-brand-700" /> Solo stock bajo
        </label>
        <label v-if="auth.isAdmin" class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="filters.includeInactive" type="checkbox" class="size-4 accent-brand-700" /> Mostrar
          desactivados
        </label>
      </div>

      <ErrorState v-if="error && !products" :message="error" @retry="run" />

      <div
        v-else
        class="card overflow-hidden transition-opacity"
        :class="{ 'opacity-60': loading && products }"
      >
        <EmptyState
          v-if="products && !products.length"
          :title="hasFilters ? 'Ningún producto coincide' : 'Aún no hay productos'"
          :message="
            hasFilters ? 'Prueba con otros filtros.' : 'El administrador puede crearlos desde Nuevo producto.'
          "
        />
        <ul v-else class="divide-y divide-ink-100">
          <li v-if="!products" class="p-5">
            <div class="h-5 w-1/3 animate-pulse rounded bg-ink-100" />
          </li>
          <li
            v-for="product in products ?? []"
            :key="product.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            :class="{ 'bg-ink-50/60': !product.isActive }"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink-900">{{ product.name }}</p>
                <StockBadge v-if="product.isActive" :product="product" />
                <span v-else class="text-xs font-medium text-ink-500">Desactivado</span>
              </div>
              <p class="mt-0.5 text-sm text-ink-500">
                {{ lookups.categoryName(product.categoryId) }}
                <span v-if="product.description"> · {{ product.description }}</span>
              </p>
            </div>

            <div class="flex items-center gap-4">
              <div class="w-24 text-right">
                <p class="text-2xl font-bold text-ink-900 tabular-nums">{{ product.quantity }}</p>
                <p class="text-xs text-ink-500">{{ product.unit }} · mín. {{ product.minStock }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn-secondary px-3"
                  :disabled="!product.isActive"
                  :aria-label="`Meter ${product.name}`"
                  @click="openMovement('IN', product)"
                >
                  <Icon name="plus" :size="16" /> Meter
                </button>
                <button
                  type="button"
                  class="btn-primary px-3"
                  :disabled="!product.isActive || product.quantity === 0"
                  :aria-label="`Sacar ${product.name}`"
                  @click="openMovement('OUT', product)"
                >
                  <Icon name="minus" :size="16" /> Sacar
                </button>
              </div>
              <div class="flex gap-1">
                <RouterLink
                  :to="{ path: '/admin/movimientos', query: { productId: product.id } }"
                  class="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                  :aria-label="`Movimientos de ${product.name}`"
                  title="Ver movimientos"
                >
                  <Icon name="list" :size="16" />
                </RouterLink>
                <RouterLink
                  v-if="auth.isAdmin"
                  :to="`/admin/productos/${product.id}/editar`"
                  class="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                  :aria-label="`Editar ${product.name}`"
                  title="Editar"
                >
                  <Icon name="edit" :size="16" />
                </RouterLink>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <MovementDialog
        :open="dialog !== null"
        :type="dialog?.type ?? 'OUT'"
        :product="dialog?.product ?? null"
        @close="dialog = null"
        @done="onDone"
      />
    </section>
  </AdminPage>
</template>
