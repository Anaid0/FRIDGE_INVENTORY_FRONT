<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import MovementDialog from '@/components/MovementDialog.vue';
import Badge from '@/components/ui/Badge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ProductIcon from '@/components/ui/ProductIcon.vue';
import { useAsync } from '@/composables/useAsync';
import type { MovementType, Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useStatsStore } from '@/stores/stats';
import { useToastStore } from '@/stores/toasts';
import { formatMoney, formatNumber, fullName, parseMoneyInput, toCents, withUnit } from '@/utils/format';

const { catalog, movements } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const stats = useStatsStore();
const toasts = useToastStore();

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
  void lookups.ensureUsers().catch(() => undefined);
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

const visible = computed(() => {
  const search = normalize(filters.search.trim());
  return (products.value ?? [])
    .filter((p) => p.isActive || filters.showInactive)
    .filter((p) => !search || normalize(p.name).includes(search))
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

/** La barrita de stock se mide contra el producto con más unidades (mínimo 20, como en el mockup). */
const scaleMax = computed(() => Math.max(20, ...active.value.map((p) => p.quantity)));

function replaceProduct(updated: Product) {
  if (products.value) products.value = products.value.map((p) => (p.id === updated.id ? updated : p));
}

function unitLabel(p: Product): string {
  return p.unit || 'unidad';
}

// --- Meter / Sacar desde la fila (diálogo) ---
const dialog = ref<{ type: MovementType; product: Product } | null>(null);

function openMovement(type: MovementType, product: Product) {
  dialog.value = { type, product };
}

function onDone(updated: Product) {
  dialog.value = null;
  replaceProduct(updated);
}

// --- Panel "Editar producto" ---
const UNITS = ['unidad', 'botella', 'lata', 'paquete', 'caja', 'bolsa'];
const selectedId = ref<string | null>(null);
const selected = computed(() => products.value?.find((p) => p.id === selectedId.value) ?? null);
const panel = ref<HTMLElement | null>(null);
const form = reactive({
  name: '',
  categoryId: '',
  unit: 'unidad',
  minStock: 0,
  referencePrice: '',
  isActive: true,
});
const performer = ref('');
const saving = ref(false);
const registering = ref<MovementType | null>(null);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});
const unitOptions = computed(() => (UNITS.includes(form.unit) ? UNITS : [...UNITS, form.unit]));

async function select(product: Product) {
  if (selectedId.value === product.id) {
    selectedId.value = null;
    return;
  }
  selectedId.value = product.id;
  Object.assign(form, {
    name: product.name,
    categoryId: product.categoryId ?? '',
    unit: product.unit || 'unidad',
    minStock: product.minStock,
    referencePrice: product.referencePrice ? String(toCents(product.referencePrice) / 100) : '',
    isActive: product.isActive,
  });
  performer.value ||= auth.user?.id ?? '';
  formError.value = null;
  fieldErrors.value = {};
  // Si el panel quedó debajo de la tabla (pantallas angostas), se lleva a la vista.
  await nextTick();
  panel.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Si el producto elegido desaparece (p. ej. se recargó la lista), se cierra el panel.
watch(products, () => {
  if (selectedId.value && !selected.value) selectedId.value = null;
});

async function save(changes?: { isActive: boolean }) {
  if (!selected.value) return;
  formError.value = null;
  fieldErrors.value = {};
  saving.value = true;
  try {
    const updated = await catalog.updateProduct(
      selected.value.id,
      changes ?? {
        name: form.name,
        unit: form.unit.trim() || 'unidad',
        minStock: Number(form.minStock) || 0,
        categoryId: form.categoryId || null,
        referencePrice: form.referencePrice.trim() ? parseMoneyInput(form.referencePrice) : null,
        isActive: form.isActive,
      },
    );
    replaceProduct(updated);
    form.isActive = updated.isActive;
    toasts.success(
      changes
        ? `"${updated.name}" ${updated.isActive ? 'activado' : 'desactivado'}.`
        : `"${updated.name}" actualizado.`,
    );
    void lookups.ensureProducts(true).catch(() => undefined);
  } catch (e) {
    formError.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (e.code === 'PRODUCT_NAME_TAKEN') fieldErrors.value = { name: e.message };
    }
  } finally {
    saving.value = false;
  }
}

/** "+ Meter" / "− Sacar" del panel: una unidad a nombre de la persona elegida (queda quién lo registró). */
async function register(type: MovementType) {
  const product = selected.value;
  if (!product) return;
  registering.value = type;
  try {
    const input = {
      productId: product.id,
      quantity: 1,
      performedBy: performer.value && performer.value !== auth.user?.id ? performer.value : null,
    };
    const result = type === 'OUT' ? await movements.stockOut(input) : await movements.stockIn(input);
    replaceProduct(result.product);
    const who = lookups.users.find((u) => u.id === result.movement.performedBy);
    const onBehalf =
      result.movement.performedBy !== auth.user?.id && who ? ` a nombre de ${fullName(who)}` : '';
    toasts.success(
      `${type === 'OUT' ? 'Retiro' : 'Entrada'} registrado${onBehalf}: ${withUnit(1, product.unit)} de ${product.name}.`,
    );
    void stats.refresh();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    registering.value = null;
  }
}
</script>

<template>
  <AdminPage title="Productos">
    <section>
      <PageHeader title="Productos">
        <template #subtitle>
          <template v-if="products">
            {{ formatNumber(active.length) }} {{ active.length === 1 ? 'activo' : 'activos' }} ·
            {{ formatNumber(totalUnits) }} {{ totalUnits === 1 ? 'unidad' : 'unidades' }} en la nevera
            <template v-if="lowCount">
              · <span class="font-extrabold text-accent-700">{{ lowCount }} por reponer</span>
            </template>
          </template>
          <template v-else>Lo que hay en la nevera.</template>
        </template>
        <template #actions>
          <RouterLink v-if="auth.isAdmin" to="/admin/productos/nuevo" class="btn-primary min-h-11 px-[18px]">
            <Icon name="plus" :size="18" :stroke="2" /> Nuevo producto
          </RouterLink>
        </template>
      </PageHeader>

      <div class="mb-5 flex flex-wrap items-center gap-2.5">
        <label
          class="flex h-[46px] min-w-0 flex-[1_1_260px] items-center gap-2.5 rounded-xl border border-ink-300 bg-white/80 px-3.5 text-ink-500 backdrop-blur-md focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200"
        >
          <Icon name="search" :size="18" />
          <span class="sr-only">Buscar producto</span>
          <input
            v-model="filters.search"
            type="search"
            class="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 focus-visible:outline-none"
            placeholder="Buscar producto…"
          />
        </label>
        <div role="group" aria-label="Categoría" class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="chip min-h-11"
            :aria-pressed="filters.categoryId === ''"
            @click="filters.categoryId = ''"
          >
            Todas
          </button>
          <button
            v-for="c in categoryChips"
            :key="c.id"
            type="button"
            class="chip min-h-11"
            :aria-pressed="filters.categoryId === c.id"
            @click="filters.categoryId = filters.categoryId === c.id ? '' : c.id"
          >
            {{ c.name }} · {{ c.count }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-extrabold backdrop-blur-md transition-colors"
            :class="
              filters.lowStock
                ? 'border-accent-500 bg-accent-500 text-ink-900'
                : 'border-accent-200 bg-accent-50/80 text-accent-700 hover:bg-accent-100'
            "
            :aria-pressed="filters.lowStock"
            @click="filters.lowStock = !filters.lowStock"
          >
            Solo por reponer
          </button>
        </div>
      </div>

      <ErrorState v-if="error && !products" :message="error" @retry="run" />

      <div v-else class="flex flex-wrap items-start gap-5">
        <section
          aria-label="Lista de productos"
          class="card min-w-0 flex-[999_1_560px] overflow-x-auto transition-opacity"
          :class="{ 'opacity-60': loading && products }"
        >
          <EmptyState
            v-if="products && !visible.length"
            :title="hasFilters ? 'Ningún producto coincide' : 'Aún no hay productos'"
            :message="hasFilters ? 'Prueba con otros filtros.' : 'Créalos desde Nuevo producto.'"
          />
          <table v-else class="w-full text-left text-[15px] max-sm:block sm:min-w-[560px]">
            <caption class="sr-only">
              Productos de la nevera
            </caption>
            <thead class="text-[13px] text-ink-500 max-sm:sr-only">
              <tr>
                <th scope="col" class="py-3.5 pr-3 pl-5 font-extrabold">Producto</th>
                <th scope="col" class="px-3 py-3.5 font-extrabold">Stock</th>
                <th scope="col" class="px-3 py-3.5 font-extrabold">Estado</th>
                <th scope="col" class="py-3.5 pr-5 pl-3 text-right font-extrabold">Acciones</th>
              </tr>
            </thead>
            <tbody class="max-sm:block">
              <tr v-if="!products">
                <td colspan="4" class="px-5 py-5">
                  <div class="h-5 w-1/3 animate-pulse rounded bg-ink-100" />
                </td>
              </tr>
              <tr
                v-for="product in visible"
                :key="product.id"
                class="border-t border-ink-200/60 transition-colors max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3"
                :class="[
                  selectedId === product.id
                    ? 'bg-brand-50/80 shadow-[inset_4px_0_0_var(--color-brand-600)]'
                    : '',
                  { 'opacity-70': !product.isActive },
                ]"
              >
                <td class="py-2.5 pr-3 pl-5 max-sm:col-span-2 max-sm:p-0">
                  <div class="flex items-center gap-3">
                    <ProductIcon
                      :category="product.categoryId ? lookups.categoryName(product.categoryId) : null"
                    />
                    <div class="min-w-0">
                      <p class="font-extrabold text-ink-900">{{ product.name }}</p>
                      <p class="text-[13px]" :class="product.categoryId ? 'text-ink-500' : 'text-accent-700'">
                        {{ lookups.categoryName(product.categoryId) }}
                        <span class="text-ink-500">· {{ unitLabel(product) }}</span>
                        <span v-if="product.currentPrice" class="text-ink-500">
                          · {{ formatMoney(product.currentPrice) }}</span
                        >
                        <span v-else class="text-accent-700"> · sin precio</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 max-sm:p-0">
                  <div
                    class="flex w-28 flex-col gap-1.5 max-sm:w-auto max-sm:min-w-32 min-[1400px]:w-[140px]"
                  >
                    <p class="font-extrabold text-ink-900">
                      <span data-stock class="tabular-nums">{{ product.quantity }}</span>
                      <span class="text-[13px] font-semibold text-ink-500">
                        / mín. {{ product.minStock }}</span
                      >
                    </p>
                    <div class="h-1.5 rounded-full bg-ink-100/90" aria-hidden="true">
                      <div
                        class="h-full rounded-full"
                        :class="product.isLowStock ? 'bg-accent-600' : 'bg-brand-600'"
                        :style="{
                          width: `${Math.max(product.quantity ? 5 : 0, (product.quantity / scaleMax) * 100)}%`,
                        }"
                      />
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 max-sm:self-center max-sm:p-0 max-sm:text-right">
                  <Badge v-if="!product.isActive" tone="neutral">Desactivado</Badge>
                  <Badge v-else-if="product.quantity === 0" tone="danger">Agotado</Badge>
                  <Badge v-else-if="product.isLowStock" tone="accent">Por reponer</Badge>
                  <Badge v-else tone="success">Disponible</Badge>
                </td>
                <td class="py-2.5 pr-5 pl-3 max-sm:col-span-2 max-sm:p-0">
                  <div class="flex justify-end gap-1.5">
                    <button
                      type="button"
                      class="grid size-10 place-items-center rounded-xl border min-[1400px]:size-11 border-success-100 bg-success-50/80 text-success-700 hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="!product.isActive"
                      :aria-label="`Meter ${product.name}`"
                      title="Meter"
                      @click="openMovement('IN', product)"
                    >
                      <Icon name="plus" :size="20" :stroke="2" />
                    </button>
                    <button
                      type="button"
                      class="grid size-10 place-items-center rounded-xl border min-[1400px]:size-11 border-accent-200 bg-accent-50/80 text-accent-700 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="!product.isActive || product.quantity === 0"
                      :aria-label="`Sacar ${product.name}`"
                      title="Sacar"
                      @click="openMovement('OUT', product)"
                    >
                      <Icon name="minus" :size="20" :stroke="2" />
                    </button>
                    <button
                      v-if="auth.isAdmin"
                      type="button"
                      class="grid size-10 place-items-center rounded-xl border min-[1400px]:size-11 transition-colors"
                      :class="
                        selectedId === product.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-ink-200 bg-white/75 text-ink-700 hover:bg-white'
                      "
                      :aria-label="`Editar ${product.name}`"
                      :aria-pressed="selectedId === product.id"
                      title="Editar"
                      @click="select(product)"
                    >
                      <Icon name="edit" :size="18" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="inactiveCount && auth.isAdmin"
            class="border-t border-ink-200/60 px-5 py-2 text-right max-sm:text-left"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center text-sm font-extrabold text-brand-600 hover:text-brand-800"
              @click="filters.showInactive = !filters.showInactive"
            >
              {{ filters.showInactive ? 'Ocultar desactivados' : `Mostrar desactivados (${inactiveCount})` }}
            </button>
          </div>
        </section>

        <!-- Panel lateral: editar el producto elegido y registrar movimientos a nombre de alguien. -->
        <aside
          v-if="selected"
          ref="panel"
          aria-labelledby="edit-title"
          class="flex min-w-0 flex-[1_1_300px] scroll-mt-4 flex-col gap-4 rounded-[var(--radius-card)] glass-strong p-[22px]"
        >
          <div class="flex items-center justify-between gap-2">
            <h2 id="edit-title" class="text-[21px] font-black text-ink-900">Editar producto</h2>
            <button
              type="button"
              class="grid size-11 place-items-center rounded-xl bg-ink-50/90 text-ink-700 hover:bg-white"
              aria-label="Cerrar"
              @click="selectedId = null"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <form class="flex flex-col gap-4" novalidate @submit.prevent="save()">
            <p
              v-if="formError"
              class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700"
              role="alert"
            >
              {{ formError }}
            </p>
            <div>
              <label for="pe-name" class="label">Nombre</label>
              <input
                id="pe-name"
                v-model="form.name"
                type="text"
                maxlength="120"
                class="input h-[46px]"
                :aria-invalid="Boolean(fieldErrors.name)"
                required
              />
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-danger-700">{{ fieldErrors.name }}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="min-w-0">
                <label for="pe-category" class="label">Categoría</label>
                <select id="pe-category" v-model="form.categoryId" class="input h-[46px]">
                  <option value="">Sin categoría</option>
                  <option v-for="c in lookups.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div class="min-w-0">
                <label for="pe-unit" class="label">Se cuenta por</label>
                <select id="pe-unit" v-model="form.unit" class="input h-[46px] capitalize">
                  <option v-for="u in unitOptions" :key="u" :value="u">
                    {{ u.charAt(0).toUpperCase() + u.slice(1) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="min-w-0">
                <label for="pe-min" class="label">Stock mínimo</label>
                <input
                  id="pe-min"
                  v-model.number="form.minStock"
                  type="number"
                  min="0"
                  step="1"
                  class="input h-[46px]"
                  :aria-invalid="Boolean(fieldErrors.minStock)"
                />
              </div>
              <div class="min-w-0">
                <p id="pe-stock-label" class="label">Stock actual</p>
                <p
                  class="flex h-[46px] items-center rounded-xl bg-ink-50/90 px-3.5 font-extrabold text-ink-900"
                  aria-labelledby="pe-stock-label"
                >
                  {{ withUnit(selected.quantity, selected.unit) }}
                </p>
              </div>
            </div>
            <!-- Quien más consume, más aporta: cada retiro se valora a este precio. -->
            <div class="grid grid-cols-2 gap-3">
              <div class="min-w-0">
                <p id="pe-price-label" class="label">Precio actual</p>
                <p
                  class="flex h-[46px] items-center rounded-xl bg-ink-50/90 px-3.5 font-extrabold tabular-nums"
                  :class="selected.currentPrice ? 'text-ink-900' : 'text-accent-700'"
                  aria-labelledby="pe-price-label"
                >
                  {{ selected.currentPrice ? formatMoney(selected.currentPrice) : 'Sin precio' }}
                </p>
              </div>
              <div class="min-w-0">
                <label for="pe-ref-price" class="label">Precio de referencia</label>
                <input
                  id="pe-ref-price"
                  v-model="form.referencePrice"
                  type="text"
                  inputmode="decimal"
                  class="input h-[46px] tabular-nums"
                  placeholder="Opcional"
                  aria-describedby="pe-price-hint"
                  :aria-invalid="Boolean(fieldErrors.referencePrice)"
                />
              </div>
              <p id="pe-price-hint" class="col-span-2 text-[13px] text-ink-500">
                Lo que sale de la nevera se cobra al precio de la última compra. El de referencia se usa si el
                producto nunca se ha comprado (regalos, stock inicial).
              </p>
            </div>
            <label
              class="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl bg-ink-50/90 px-3.5 font-extrabold text-ink-900"
            >
              Visible en la tablet
              <input v-model="form.isActive" type="checkbox" class="size-[22px] accent-brand-600" />
            </label>

            <div class="h-px bg-ink-200/70" />

            <div class="flex flex-col gap-2.5">
              <label for="pe-performer" class="font-extrabold text-ink-900">Registrar a nombre de</label>
              <select id="pe-performer" v-model="performer" class="input h-[46px]">
                <option v-for="user in lookups.users" :key="user.id" :value="user.id">
                  {{ fullName(user) }}{{ user.id === auth.user?.id ? ' (yo)' : '' }}
                </option>
              </select>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn min-h-[46px] flex-1 border border-success-100 bg-success-50/80 text-success-700 hover:bg-success-50"
                  :disabled="!selected.isActive || registering !== null"
                  @click="register('IN')"
                >
                  {{ registering === 'IN' ? 'Guardando…' : '+ Meter' }}
                </button>
                <button
                  type="button"
                  class="btn min-h-[46px] flex-1 border border-accent-200 bg-accent-50/80 text-accent-700 hover:bg-accent-100"
                  :disabled="!selected.isActive || selected.quantity === 0 || registering !== null"
                  @click="register('OUT')"
                >
                  {{ registering === 'OUT' ? 'Guardando…' : '− Sacar' }}
                </button>
              </div>
              <p class="text-[13px] text-ink-500">Queda en el log con tu nombre como quien registra.</p>
            </div>

            <div class="mt-1 flex gap-2">
              <button
                type="button"
                class="btn-secondary min-h-12 flex-1 px-3"
                :disabled="saving"
                @click="save({ isActive: !selected.isActive })"
              >
                {{ selected.isActive ? 'Desactivar' : 'Activar' }}
              </button>
              <button
                type="submit"
                class="btn-primary min-h-12 flex-[2]"
                :disabled="saving || !form.name.trim()"
              >
                {{ saving ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
            <RouterLink
              :to="`/admin/productos/${selected.id}/editar`"
              class="self-center text-sm font-extrabold text-brand-600 hover:text-brand-800"
            >
              Descripción y más opciones
            </RouterLink>
          </form>
        </aside>
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
