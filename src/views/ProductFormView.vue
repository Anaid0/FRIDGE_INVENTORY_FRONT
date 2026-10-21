<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, nextTick, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import MovementDialog from '@/components/MovementDialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import type { Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useStatsStore } from '@/stores/stats';
import { useToastStore } from '@/stores/toasts';
import { formatMoney, parseMoneyInput, toCents, withUnit } from '@/utils/format';

/**
 * Crear o editar un producto (mockup EditarProducto). Al editar, arriba va el stock con "Ingresar N a la
 * nevera" (solo admin) y el retiro a nombre de otra persona; abajo, los datos y la barra fija de guardar.
 */
const props = defineProps<{ id?: string }>();
const { catalog, movements } = useServices();
const lookups = useLookupsStore();
const stats = useStatsStore();
const toasts = useToastStore();
const router = useRouter();

/** Campos compactos del mockup: etiqueta 11px y controles blancos de 44px con borde azulado. */
const FIELD_LABEL = 'mb-1 block text-[11px] font-extrabold text-ink-700';
const FIELD_INPUT =
  'block h-11 w-full rounded-[10px] border border-ink-200 bg-white px-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 focus:outline-none aria-invalid:border-danger-600';

const UNITS = ['unidad', 'botella', 'lata', 'paquete', 'caja', 'bolsa'];
const CODE_RE = /^\d{2}$/;

const isEdit = computed(() => Boolean(props.id));
const form = reactive({
  name: '',
  code: '',
  description: '',
  unit: 'unidad',
  minStock: 0,
  categoryId: '',
  referencePrice: '',
  initialQuantity: 0,
  isActive: true,
});
/** El producto tal como está guardado (solo al editar): stock, código y precio actual. */
const product = ref<Product | null>(null);
const loadError = ref<string | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

const unitOptions = computed(() => (UNITS.includes(form.unit) ? UNITS : [...UNITS, form.unit]));

const newCategory = ref('');
const showNewCategory = ref(false);
const creatingCategory = ref(false);
const newCategoryInput = ref<HTMLInputElement | null>(null);

/** La página puede reutilizarse al volver: se empieza siempre con el formulario limpio. */
function reset() {
  Object.assign(form, {
    name: '',
    code: '',
    description: '',
    unit: 'unidad',
    minStock: 0,
    categoryId: '',
    referencePrice: '',
    initialQuantity: 0,
    isActive: true,
  });
  product.value = null;
  error.value = null;
  fieldErrors.value = {};
  newCategory.value = '';
  showNewCategory.value = false;
  stockQty.value = 1;
}

function fillForm(p: Product) {
  Object.assign(form, {
    name: p.name,
    code: p.code ?? '',
    description: p.description ?? '',
    unit: p.unit || 'unidad',
    minStock: p.minStock,
    categoryId: p.categoryId ?? '',
    referencePrice: p.referencePrice ? String(toCents(p.referencePrice) / 100) : '',
    isActive: p.isActive,
  });
}

async function load() {
  loadError.value = null;
  reset();
  try {
    await lookups.ensureCategories();
    if (!props.id) return;
    const detail = await catalog.getProduct(props.id);
    product.value = detail.product;
    fillForm(detail.product);
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
useOnEnter(load);

// --- Categoría (chips + crear una nueva sin salir) ---
function toggleCategory(id: string) {
  form.categoryId = form.categoryId === id ? '' : id;
}

async function openNewCategory() {
  showNewCategory.value = !showNewCategory.value;
  if (showNewCategory.value) {
    await nextTick();
    newCategoryInput.value?.focus();
  }
}

async function createCategory() {
  if (!newCategory.value.trim()) return;
  creatingCategory.value = true;
  try {
    const category = await catalog.createCategory(newCategory.value.trim());
    await lookups.ensureCategories(true);
    form.categoryId = category.id;
    newCategory.value = '';
    showNewCategory.value = false;
    toasts.success(`Categoría "${category.name}" creada.`);
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    creatingCategory.value = false;
  }
}

/** El código solo admite dígitos (el teclado de la máquina es numérico). */
function onCodeInput(event: Event) {
  const input = event.target as HTMLInputElement;
  form.code = input.value.replace(/\D/g, '').slice(0, 2);
  input.value = form.code;
}

// --- Guardar ---
/** Errores de la API que corresponden a un campo concreto. */
function mapApiError(e: unknown) {
  error.value = errorMessage(e);
  if (!(e instanceof ApiError)) return;
  fieldErrors.value = e.fieldErrors;
  if (e.code === 'PRODUCT_NAME_TAKEN') fieldErrors.value = { name: e.message };
  if (e.code === 'PRODUCT_CODE_TAKEN' || e.code === 'INVALID_PRODUCT_CODE')
    fieldErrors.value = { code: e.message };
}

function validateCode(): boolean {
  const code = form.code.trim();
  if (code && !CODE_RE.test(code)) {
    fieldErrors.value = { code: 'El código tiene 2 dígitos.' };
    return false;
  }
  // La API no deja quitar el código a un producto que ya tiene uno.
  if (!code && product.value?.code) {
    fieldErrors.value = { code: 'Escribe el código (2 dígitos).' };
    return false;
  }
  return true;
}

async function submit() {
  error.value = null;
  fieldErrors.value = {};
  if (!validateCode()) return;
  saving.value = true;
  const code = form.code.trim();
  const details = {
    name: form.name,
    description: form.description.trim() || null,
    unit: form.unit.trim() || 'unidad',
    minStock: Number(form.minStock) || 0,
    categoryId: form.categoryId || null,
    referencePrice: form.referencePrice.trim() ? parseMoneyInput(form.referencePrice) : null,
  };
  try {
    if (props.id) {
      const updated = await catalog.updateProduct(props.id, {
        ...details,
        ...(code ? { code } : {}),
        isActive: form.isActive,
      });
      toasts.success(`"${updated.name}" actualizado.`);
    } else {
      const created = await catalog.createProduct({
        ...details,
        code: code || null,
        initialQuantity: Number(form.initialQuantity) || undefined,
      });
      toasts.success(`"${created.name}" creado${created.code ? ` con el código ${created.code}` : ''}.`);
    }
    void lookups.ensureProducts(true).catch(() => undefined);
    await router.push('/admin/productos');
  } catch (e) {
    mapApiError(e);
  } finally {
    saving.value = false;
  }
}

// --- Stock: ingresar N a la nevera ---
const MAX_STOCK_IN = 999;
const stockQty = ref(1);
const stockingIn = ref(false);
const afterStockIn = computed(() => (product.value?.quantity ?? 0) + stockQty.value);

function setStockQty(value: number) {
  stockQty.value = Math.min(MAX_STOCK_IN, Math.max(1, Math.floor(Number(value) || 1)));
}

/** "und" para unidades (como en la máquina); el resto, la unidad tal cual en plural si toca. */
function unitShort(p: Product): string {
  if (!p.unit || p.unit === 'unidad') return 'und';
  return withUnit(p.quantity, p.unit).replace(/^\d+\s/, '');
}

function replaceProduct(updated: Product) {
  product.value = updated;
  void lookups.ensureProducts(true).catch(() => undefined);
}

async function stockIn() {
  const current = product.value;
  if (!current) return;
  stockingIn.value = true;
  try {
    const result = await movements.stockIn({ productId: current.id, quantity: stockQty.value });
    replaceProduct(result.product);
    toasts.success(
      `Entrada registrada: ${withUnit(result.movement.quantity, current.unit)} de ${current.name}. Quedan ${result.product.quantity}.`,
    );
    stockQty.value = 1;
    void stats.refresh();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    stockingIn.value = false;
  }
}

// --- Retiro a nombre de otra persona (diálogo existente) ---
const withdrawOpen = ref(false);

function onWithdrawn(updated: Product) {
  withdrawOpen.value = false;
  replaceProduct(updated);
}

// --- Desactivar / activar ---
const confirmDeactivate = ref(false);
const toggling = ref(false);

async function setActive(isActive: boolean) {
  const current = product.value;
  if (!current) return;
  toggling.value = true;
  try {
    const updated = await catalog.updateProduct(current.id, { isActive });
    replaceProduct(updated);
    form.isActive = updated.isActive;
    confirmDeactivate.value = false;
    toasts.success(`"${updated.name}" ${updated.isActive ? 'activado' : 'desactivado'}.`);
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    toggling.value = false;
  }
}
</script>

<template>
  <AdminPage :title="isEdit ? 'Editar producto' : 'Nuevo producto'" narrow :with-tabs="false">
    <section class="pb-24">
      <PageHeader
        :title="isEdit ? (product?.name ?? 'Editar producto') : 'Nuevo producto'"
        back="/admin/productos"
      >
        <template #eyebrow>
          <span class="block text-[11px] text-ink-500">Productos</span>
        </template>
        <template v-if="product?.code" #actions>
          <span
            class="rounded-lg bg-ink-900 px-2 py-1 font-mono text-[13px] font-extrabold text-white"
            :aria-label="`Código ${product.code}`"
            >{{ product.code }}</span
          >
        </template>
      </PageHeader>

      <ErrorState v-if="loadError" :message="loadError" @retry="load" />

      <div v-else class="flex flex-col gap-2.5">
        <!-- Stock en la nevera: ingresar unidades o registrar un retiro a nombre de alguien. -->
        <section
          v-if="isEdit && product"
          aria-label="Stock"
          class="flex flex-col gap-2.5 rounded-[18px] glass-strong p-3 shadow-[0_8px_22px_rgb(7_59_94/0.08)]"
        >
          <div class="flex items-center gap-2.5">
            <p class="flex min-w-0 flex-1 flex-col">
              <span class="text-[11px] font-extrabold tracking-[0.08em] text-ink-500">EN LA NEVERA</span>
              <span class="font-mono text-[22px] font-extrabold text-ink-900">
                <span data-stock>{{ product.quantity }}</span>
                <span class="text-xs text-ink-500">
                  {{ unitShort(product) }} · mín. {{ product.minStock }}</span
                >
              </span>
            </p>
            <div class="flex items-center gap-0.5 rounded-xl bg-ink-900/[0.06] p-[3px]">
              <button
                type="button"
                class="press grid size-11 place-items-center rounded-[10px] bg-white text-ink-900"
                aria-label="Menos"
                :disabled="stockQty <= 1"
                @click="setStockQty(stockQty - 1)"
              >
                <Icon name="minus" :size="18" :stroke="2.6" />
              </button>
              <input
                :value="stockQty"
                type="text"
                inputmode="numeric"
                aria-label="Unidades a ingresar"
                class="w-9 border-0 bg-transparent p-0 text-center font-mono text-base font-extrabold text-ink-900 outline-none"
                @change="setStockQty(Number(($event.target as HTMLInputElement).value))"
              />
              <button
                type="button"
                class="press grid size-11 place-items-center rounded-[10px] bg-white text-ink-900"
                aria-label="Más"
                :disabled="stockQty >= MAX_STOCK_IN"
                @click="setStockQty(stockQty + 1)"
              >
                <Icon name="plus" :size="18" :stroke="2.6" />
              </button>
            </div>
          </div>

          <button
            type="button"
            class="btn-success h-11 w-full rounded-xl text-sm"
            :disabled="stockingIn || !product.isActive"
            @click="stockIn"
          >
            <span
              v-if="stockingIn"
              class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
            <Icon v-else name="putIn" :size="18" :stroke="2.2" />
            <template v-if="stockingIn">Guardando…</template>
            <template v-else>Ingresar {{ stockQty }} a la nevera · quedarán {{ afterStockIn }}</template>
          </button>
          <p v-if="!product.isActive" class="text-[11px] text-accent-700">
            Está desactivado: actívalo para ingresar stock.
          </p>

          <div class="border-t border-ink-900/[0.08] pt-1.5">
            <button
              type="button"
              class="flex min-h-11 items-center text-xs font-extrabold text-brand-700 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!product.isActive || product.quantity === 0"
              @click="withdrawOpen = true"
            >
              Registrar un retiro a nombre de otra persona
            </button>
            <p class="text-[11px] text-ink-500">Queda en el log con tu nombre como quien registra.</p>
          </div>
        </section>

        <form
          id="product-form"
          aria-label="Datos del producto"
          class="flex flex-col gap-3 rounded-[18px] glass p-3"
          novalidate
          @submit.prevent="submit"
        >
          <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
            {{ error }}
          </p>

          <div class="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
            <div class="min-w-0">
              <label for="p-name" :class="FIELD_LABEL">Nombre</label>
              <input
                id="p-name"
                v-model="form.name"
                type="text"
                maxlength="120"
                :class="[FIELD_INPUT, 'font-semibold']"
                placeholder="Ej.: Gaseosa 400 ml"
                :aria-invalid="Boolean(fieldErrors.name)"
                :aria-describedby="fieldErrors.name ? 'p-name-error' : undefined"
                required
              />
            </div>
            <div class="min-w-0">
              <label for="p-code" :class="FIELD_LABEL">Código</label>
              <input
                id="p-code"
                :value="form.code"
                type="text"
                inputmode="numeric"
                maxlength="2"
                pattern="[0-9]{2}"
                autocomplete="off"
                :class="[FIELD_INPUT, 'font-mono text-[15px] font-extrabold text-ink-900']"
                :placeholder="isEdit ? '' : 'Auto'"
                :aria-invalid="Boolean(fieldErrors.code)"
                :aria-describedby="fieldErrors.code ? 'p-code-error' : !isEdit ? 'p-code-hint' : undefined"
                @input="onCodeInput"
              />
            </div>
            <p v-if="fieldErrors.name" id="p-name-error" class="col-span-2 text-xs text-danger-700">
              {{ fieldErrors.name }}
            </p>
            <p v-if="fieldErrors.code" id="p-code-error" class="col-span-2 text-xs text-danger-700">
              {{ fieldErrors.code }}
            </p>
            <p v-else-if="!isEdit" id="p-code-hint" class="col-span-2 text-[11px] text-ink-500">
              El código es el que se marca en la máquina. Si lo dejas vacío se asigna solo.
            </p>
          </div>

          <div>
            <label for="p-description" :class="FIELD_LABEL">
              Descripción <span class="font-normal text-ink-500">(opcional)</span>
            </label>
            <input
              id="p-description"
              v-model="form.description"
              type="text"
              maxlength="255"
              :class="FIELD_INPUT"
              :aria-invalid="Boolean(fieldErrors.description)"
            />
            <p v-if="fieldErrors.description" class="mt-1 text-xs text-danger-700">
              {{ fieldErrors.description }}
            </p>
          </div>

          <div role="group" aria-labelledby="p-category-label">
            <span id="p-category-label" :class="FIELD_LABEL">Categoría</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="c in lookups.categories"
                :key="c.id"
                type="button"
                class="min-h-11 rounded-[10px] border px-3 text-xs transition-colors"
                :class="
                  form.categoryId === c.id
                    ? 'border-[1.5px] border-brand-600 bg-brand-50 font-extrabold text-ink-900'
                    : 'border-ink-200 bg-white font-bold text-ink-700 hover:bg-ink-50'
                "
                :aria-pressed="form.categoryId === c.id"
                @click="toggleCategory(c.id)"
              >
                {{ c.name }}
              </button>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-[10px] border border-dashed border-ink-300 text-brand-700 hover:bg-white/60"
                aria-label="Nueva categoría"
                :aria-expanded="showNewCategory"
                @click="openNewCategory"
              >
                <Icon name="plus" :size="16" :stroke="2.4" />
              </button>
            </div>
            <div v-if="showNewCategory" class="mt-2 flex gap-2">
              <input
                ref="newCategoryInput"
                v-model="newCategory"
                type="text"
                maxlength="80"
                :class="FIELD_INPUT"
                placeholder="Nombre de la categoría"
                aria-label="Nombre de la nueva categoría"
                @keydown.enter.prevent="createCategory"
              />
              <button
                type="button"
                class="btn-primary h-11 shrink-0 rounded-[10px]"
                :disabled="creatingCategory || !newCategory.trim()"
                @click="createCategory"
              >
                {{ creatingCategory ? 'Creando…' : 'Crear' }}
              </button>
            </div>
            <p v-if="fieldErrors.categoryId" class="mt-1 text-xs text-danger-700">
              {{ fieldErrors.categoryId }}
            </p>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div class="min-w-0">
              <label for="p-unit" :class="FIELD_LABEL">Se cuenta por</label>
              <select id="p-unit" v-model="form.unit" :class="[FIELD_INPUT, 'text-[13px]']">
                <option v-for="u in unitOptions" :key="u" :value="u">
                  {{ u.charAt(0).toUpperCase() + u.slice(1) }}
                </option>
              </select>
            </div>
            <div class="min-w-0">
              <label for="p-min" :class="FIELD_LABEL">Stock mínimo</label>
              <input
                id="p-min"
                v-model.number="form.minStock"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                :class="[FIELD_INPUT, 'font-mono text-sm font-extrabold text-ink-900']"
                :aria-invalid="Boolean(fieldErrors.minStock)"
              />
            </div>
            <div class="min-w-0">
              <label for="p-ref-price" :class="FIELD_LABEL">Precio ref.</label>
              <input
                id="p-ref-price"
                v-model="form.referencePrice"
                type="text"
                inputmode="decimal"
                :class="[FIELD_INPUT, 'font-mono text-[13px] font-extrabold text-ink-900']"
                placeholder="$ 0"
                aria-describedby="p-price-hint"
                :aria-invalid="Boolean(fieldErrors.referencePrice)"
              />
            </div>
            <p
              v-if="fieldErrors.minStock || fieldErrors.referencePrice || fieldErrors.unit"
              class="col-span-3 text-xs text-danger-700"
            >
              {{ fieldErrors.unit ?? fieldErrors.minStock ?? fieldErrors.referencePrice }}
            </p>
            <!-- Quien más consume, más aporta: cada retiro se valora al precio actual. -->
            <p id="p-price-hint" class="col-span-3 text-[11px] text-ink-500">
              <template v-if="product">
                Precio actual:
                <strong
                  class="font-mono"
                  :class="product.currentPrice ? 'text-ink-900' : 'text-accent-700'"
                  >{{ product.currentPrice ? formatMoney(product.currentPrice) : 'sin precio' }}</strong
                >.
              </template>
              Se cobra al precio de la última compra; el de referencia se usa si nunca se ha comprado
              (regalos, stock inicial).
            </p>
          </div>

          <div v-if="!isEdit">
            <label for="p-initial" :class="FIELD_LABEL">
              Stock inicial <span class="font-normal text-ink-500">(opcional)</span>
            </label>
            <input
              id="p-initial"
              v-model.number="form.initialQuantity"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              :class="[FIELD_INPUT, 'font-mono font-extrabold text-ink-900']"
              aria-describedby="p-initial-hint"
            />
            <p id="p-initial-hint" class="mt-1 text-[11px] text-ink-500">
              Si ya hay unidades en la nevera; se registra como una entrada a tu nombre.
            </p>
          </div>

          <label v-else class="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span class="flex flex-col">
              <span class="text-xs font-extrabold text-ink-700">Visible en la máquina</span>
              <span class="text-[11px] text-ink-500">Los empleados lo ven y lo pueden retirar</span>
            </span>
            <input
              v-model="form.isActive"
              type="checkbox"
              role="switch"
              class="size-[26px] accent-brand-600"
            />
          </label>
        </form>

        <template v-if="isEdit && product">
          <button
            v-if="product.isActive"
            type="button"
            class="min-h-11 self-center px-3 text-xs font-extrabold text-danger-700 hover:text-danger-600"
            @click="confirmDeactivate = true"
          >
            Desactivar producto…
          </button>
          <button
            v-else
            type="button"
            class="min-h-11 self-center px-3 text-xs font-extrabold text-brand-700 hover:text-ink-900"
            :disabled="toggling"
            @click="setActive(true)"
          >
            {{ toggling ? 'Activando…' : 'Activar producto' }}
          </button>
        </template>
      </div>

      <!-- Barra fija de guardar (esta página no lleva la barra de pestañas). -->
      <div
        v-if="!loadError"
        class="save-bar fixed inset-x-0 bottom-0 z-30 border-t border-white/90 bg-white/80 backdrop-blur-xl"
      >
        <div class="mx-auto flex max-w-2xl gap-2.5 px-3.5 pt-3 sm:px-6">
          <RouterLink to="/admin/productos" class="btn-secondary h-12 flex-1 rounded-xl bg-white text-[15px]">
            Cancelar
          </RouterLink>
          <button
            type="submit"
            form="product-form"
            class="btn-primary h-12 flex-[2] rounded-xl text-[15px]"
            :disabled="saving || !form.name.trim()"
          >
            <span
              v-if="saving"
              class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
            {{ saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto' }}
          </button>
        </div>
      </div>

      <MovementDialog
        :open="withdrawOpen"
        type="OUT"
        :product="product"
        @close="withdrawOpen = false"
        @done="onWithdrawn"
      />
      <ConfirmDialog
        :open="confirmDeactivate"
        title="¿Desactivar producto?"
        :message="`${product?.name ?? 'El producto'} deja de verse en la máquina y nadie lo podrá retirar. Puedes volver a activarlo cuando quieras.`"
        confirm-label="Desactivar"
        danger
        :loading="toggling"
        @confirm="setActive(false)"
        @close="confirmDeactivate = false"
      />
    </section>
  </AdminPage>
</template>

<style scoped>
.save-bar {
  padding-bottom: calc(var(--ion-safe-area-bottom, 0px) + 0.875rem);
}
</style>
