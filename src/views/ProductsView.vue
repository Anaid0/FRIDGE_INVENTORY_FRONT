<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { formatMoney, formatNumber } from '@/utils/format';

const { catalog } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();

/**
 * Se trae el catálogo completo (también los desactivados) y se filtra aquí: son pocos productos y así los
 * contadores del encabezado y de las categorías no dependen de los filtros.
 */
const {
  data: products,
  error,
  loading,
  run,
} = useAsync(() => catalog.listProducts({ includeInactive: true }));

useOnEnter(() => {
  void run();
  void lookups.ensureCategories().catch(() => undefined);
});

/** '' = todas; NO_CATEGORY = sin categoría. */
const NO_CATEGORY = '__none';
const filters = reactive({ search: '', categoryId: '', lowStock: false, showInactive: false });

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const active = computed(() => (products.value ?? []).filter((p) => p.isActive));
const inactiveCount = computed(() => (products.value?.length ?? 0) - active.value.length);
const totalUnits = computed(() => active.value.reduce((sum, p) => sum + p.quantity, 0));
const lowCount = computed(() => active.value.filter((p) => p.isLowStock).length);

/** Chips de categoría con cuántos productos activos tiene cada una (solo las que tienen alguno). */
const categoryChips = computed(() => {
  const chips = lookups.categories
    .map((c) => ({ id: c.id, name: c.name, count: active.value.filter((p) => p.categoryId === c.id).length }))
    .filter((c) => c.count > 0);
  const withoutCategory = active.value.filter((p) => !p.categoryId).length;
  if (withoutCategory) chips.push({ id: NO_CATEGORY, name: 'Sin categoría', count: withoutCategory });
  return chips;
});

/** Busca por nombre (sin tildes) o por el código de la máquina ("2" encuentra 21, 22…). */
const visible = computed(() => {
  const search = normalize(filters.search.trim());
  return (products.value ?? [])
    .filter((p) => p.isActive || filters.showInactive)
    .filter((p) => !search || normalize(p.name).includes(search) || Boolean(p.code?.startsWith(search)))
    .filter((p) =>
      !filters.categoryId
        ? true
        : filters.categoryId === NO_CATEGORY
          ? !p.categoryId
          : p.categoryId === filters.categoryId,
    )
    .filter((p) => !filters.lowStock || p.isLowStock);
});
const hasFilters = computed(() => Boolean(filters.search || filters.categoryId || filters.lowStock));
const showingAll = computed(() => !filters.categoryId && !filters.lowStock);

function showAll() {
  filters.categoryId = '';
  filters.lowStock = false;
}

/** La barrita se mide contra el doble del mínimo: en el mínimo queda a la mitad. */
function stockPercent(p: Product): number {
  const scale = Math.max(1, p.minStock * 2);
  return Math.min(100, Math.max(p.quantity ? 6 : 0, (p.quantity / scale) * 100));
}

function unitLabel(p: Product): string {
  return p.unit || 'unidad';
}
</script>

<template>
  <AdminPage title="Productos">
    <section>
      <PageHeader title="Productos">
        <template #subtitle>
          <template v-if="products">
            {{ formatNumber(active.length) }} {{ active.length === 1 ? 'activo' : 'activos' }} ·
            {{ formatNumber(totalUnits) }} {{ totalUnits === 1 ? 'unidad' : 'unidades' }}
            <template v-if="lowCount">
              · <strong class="font-extrabold text-accent-700">{{ lowCount }} por reponer</strong>
            </template>
          </template>
          <template v-else>Lo que hay en la nevera.</template>
        </template>
        <template #actions>
          <RouterLink
            v-if="auth.isAdmin"
            to="/admin/productos/nuevo"
            class="btn-primary h-11 gap-1 rounded-xl pr-3.5 pl-2.5 text-[13px]"
          >
            <Icon name="plus" :size="18" :stroke="2.4" /> Nuevo
          </RouterLink>
        </template>
      </PageHeader>

      <label
        class="glass mb-2 flex h-11 items-center gap-2 rounded-xl px-3 text-ink-500 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200"
      >
        <Icon name="search" :size="18" />
        <span class="sr-only">Buscar por nombre o código</span>
        <input
          v-model="filters.search"
          type="search"
          class="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-ink-800 outline-none placeholder:text-ink-500 focus-visible:outline-none"
          placeholder="Buscar por nombre o código"
        />
      </label>

      <!-- Filtros: en el teléfono es una fila que se desliza; en pantallas anchas se reparte en varias líneas. -->
      <div
        role="group"
        aria-label="Filtro"
        class="-mx-3.5 mb-2 flex gap-1.5 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <button
          type="button"
          class="chip h-11 shrink-0 px-3 text-xs"
          :aria-pressed="showingAll"
          @click="showAll"
        >
          Todas · {{ active.length }}
        </button>
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-xs font-extrabold transition-colors"
          :class="
            filters.lowStock
              ? 'border-accent-500 bg-accent-500 text-ink-900'
              : 'border-accent-200 bg-accent-50/85 text-accent-700 hover:bg-accent-100'
          "
          :aria-pressed="filters.lowStock"
          @click="filters.lowStock = !filters.lowStock"
        >
          Por reponer · {{ lowCount }}
        </button>
        <button
          v-for="c in categoryChips"
          :key="c.id"
          type="button"
          class="chip h-11 shrink-0 bg-white/55 px-3 text-xs font-bold text-ink-700"
          :aria-pressed="filters.categoryId === c.id"
          @click="filters.categoryId = filters.categoryId === c.id ? '' : c.id"
        >
          {{ c.name }} · {{ c.count }}
        </button>
      </div>

      <ErrorState v-if="error && !products" :message="error" @retry="run" />

      <template v-else>
        <!-- Columnas: código · producto · stock · ingresar (y precio en pantallas anchas). -->
        <div
          aria-hidden="true"
          class="products-grid px-3 pb-1.5 text-[10px] font-extrabold tracking-[0.08em] text-ink-500"
        >
          <span>CÓD.</span>
          <span>PRODUCTO</span>
          <span class="max-sm:hidden">PRECIO</span>
          <span>STOCK</span>
          <span class="text-center">INGR.</span>
        </div>

        <section
          aria-label="Lista de productos"
          class="card px-3 shadow-[0_8px_22px_rgb(7_59_94/0.08)] transition-opacity"
          :class="{ 'opacity-60': loading && products }"
        >
          <EmptyState
            v-if="products && !visible.length"
            :title="hasFilters ? 'Ningún producto coincide' : 'Aún no hay productos'"
            :message="hasFilters ? 'Prueba con otros filtros.' : 'Créalos desde Nuevo.'"
          />

          <ul v-else>
            <template v-if="!products">
              <li
                v-for="n in 5"
                :key="n"
                class="products-grid min-h-[52px] items-center border-b border-ink-900/[0.08] last:border-b-0"
                aria-hidden="true"
              >
                <span class="h-5 animate-pulse rounded-md bg-ink-100" />
                <span class="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
                <span class="h-4 animate-pulse rounded bg-ink-100 max-sm:hidden" />
                <span class="h-4 animate-pulse rounded bg-ink-100" />
                <span class="h-9 animate-pulse rounded-[10px] bg-ink-100" />
              </li>
            </template>

            <li
              v-for="product in visible"
              :key="product.id"
              class="products-grid min-h-[52px] items-center border-b border-ink-900/[0.08] last:border-b-0"
              :class="{ 'opacity-70': !product.isActive }"
            >
              <!-- Toda la fila (menos el botón de ingresar) abre la edición. -->
              <RouterLink
                :to="`/admin/productos/${product.id}/editar`"
                class="col-span-4 grid min-h-[52px] grid-cols-subgrid items-center rounded-lg py-1.5 no-underline max-sm:col-span-3"
                :aria-label="`Editar ${product.name}${product.code ? `, código ${product.code}` : ''}`"
              >
                <span
                  data-code
                  class="rounded-md py-0.5 text-center font-mono text-xs font-extrabold text-white"
                  :class="product.quantity === 0 || !product.isActive ? 'bg-ink-400' : 'bg-ink-900'"
                >
                  {{ product.code ?? '—' }}
                </span>
                <span class="flex min-w-0 flex-col">
                  <span class="truncate text-[13px] font-extrabold text-ink-900 sm:text-sm">{{
                    product.name
                  }}</span>
                  <span class="truncate text-[11px] text-ink-500 sm:text-xs">
                    {{ lookups.categoryName(product.categoryId) }} · {{ unitLabel(product) }}
                    <span v-if="!product.isActive" class="font-extrabold text-ink-700"> · Desactivado</span>
                    <span v-else-if="!product.currentPrice" class="font-bold text-accent-700 sm:hidden">
                      · sin precio</span
                    >
                  </span>
                </span>
                <span
                  class="font-mono text-xs font-extrabold tabular-nums max-sm:hidden"
                  :class="product.currentPrice ? 'text-ink-800' : 'text-accent-700'"
                >
                  {{ product.currentPrice ? formatMoney(product.currentPrice) : 'Sin precio' }}
                </span>
                <span v-if="product.quantity === 0" class="justify-self-start">
                  <span
                    class="inline-block rounded-lg bg-ink-900 px-2 py-1 text-[11px] font-extrabold text-white"
                    >Agotado</span
                  >
                </span>
                <span v-else class="flex flex-col gap-[3px]">
                  <span class="text-xs">
                    <strong
                      data-stock
                      class="font-mono font-extrabold tabular-nums"
                      :class="product.isLowStock ? 'text-accent-700' : 'text-ink-900'"
                      >{{ product.quantity }}</strong
                    ><span class="text-ink-500"> / {{ product.minStock }}</span>
                  </span>
                  <span class="h-1 rounded-full bg-ink-900/10" aria-hidden="true">
                    <span
                      class="block h-full rounded-full"
                      :class="product.isLowStock ? 'bg-accent-600' : 'bg-brand-600'"
                      :style="{ width: `${stockPercent(product)}%` }"
                    />
                  </span>
                </span>
              </RouterLink>

              <RouterLink
                v-if="product.isActive"
                :to="{ path: '/admin/ingresar', query: { producto: product.id } }"
                class="grid h-11 w-11 place-items-center rounded-[10px] text-lg font-black no-underline transition-colors"
                :class="
                  product.quantity === 0
                    ? 'bg-success-700 text-white hover:bg-success-800'
                    : 'bg-success-50 text-success-700 hover:bg-success-100'
                "
                :aria-label="`Ingresar ${product.name}`"
                title="Ingresar stock"
              >
                <Icon name="plus" :size="18" :stroke="2.6" />
              </RouterLink>
              <span v-else aria-hidden="true" />
            </li>
          </ul>
        </section>

        <p class="mx-auto mt-3 max-w-md px-2 text-center text-[11px] text-ink-500">
          El código es el que el empleado marca en la máquina. Toca un producto para editarlo.
        </p>
        <div v-if="inactiveCount && auth.isAdmin" class="mt-1 text-center">
          <button
            type="button"
            class="inline-flex min-h-11 items-center text-xs font-extrabold text-brand-700 hover:text-ink-900"
            :aria-pressed="filters.showInactive"
            @click="filters.showInactive = !filters.showInactive"
          >
            {{ filters.showInactive ? 'Ocultar desactivados' : `Mostrar desactivados (${inactiveCount})` }}
          </button>
        </div>
      </template>
    </section>
  </AdminPage>
</template>

<style scoped>
/* Misma cuadrícula para los títulos de columna y las filas (como el mockup: 34px · 1fr · 64px · 44px). */
.products-grid {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 64px 44px;
  column-gap: 8px;
}
@media (min-width: 640px) {
  .products-grid {
    grid-template-columns: 40px minmax(0, 1fr) 96px 120px 44px;
    column-gap: 14px;
  }
}
</style>
