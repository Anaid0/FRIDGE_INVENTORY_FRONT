<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import type { PeriodSummary } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { dateInputToISO, toLocalDateInput } from '@/utils/dates';
import { formatMoney, formatNumber, fullName, parseMoneyInput, toCents } from '@/utils/format';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * Línea de la compra. Por unidad: cantidad × precio. Por paquete: paquetes × unidades por paquete y lo
 * pagado (precio por paquete, o el total si hubo descuento); el precio por unidad sale de total ÷ unidades
 * y es el que se cobra a quien saque el producto.
 */
interface Line {
  uid: number;
  productId: string;
  mode: 'unit' | 'package';
  quantity: number;
  unitPrice: string;
  packageCount: number;
  unitsPerPackage: number;
  packagePrice: string;
  /** Total pagado por la línea (por paquete). Vacío: paquetes × precio por paquete. */
  total: string;
  /** Ya se salió de algún campo de la línea: desde ahí se muestran sus errores (antes de enviar). */
  touched: boolean;
}

const { funding, purchases } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const toasts = useToastStore();
const route = useRoute();
const router = useRouter();

const openPeriods = ref<PeriodSummary[]>([]);
const loadError = ref<string | null>(null);
const ready = ref(false);

let nextUid = 1;
const newLine = (): Line => ({
  uid: nextUid++,
  productId: '',
  mode: 'unit',
  quantity: 1,
  unitPrice: '',
  packageCount: 1,
  unitsPerPackage: 6,
  packagePrice: '',
  total: '',
  touched: false,
});

const form = reactive({
  periodId: '',
  buyerId: auth.user?.id ?? '',
  store: '',
  date: toLocalDateInput(),
  note: '',
  lines: [newLine()] as Line[],
  receipt: null as File | null,
});
const saving = ref(false);
const error = ref<string | null>(null);
const receiptError = ref<string | null>(null);
const showErrors = ref(false);

/** La página puede reutilizarse al volver: se empieza siempre con una compra nueva. */
const formKey = ref(0);
function reset() {
  Object.assign(form, {
    buyerId: auth.user?.id ?? '',
    store: '',
    date: toLocalDateInput(),
    note: '',
    lines: [newLine()],
    receipt: null,
  });
  error.value = null;
  receiptError.value = null;
  showErrors.value = false;
  formKey.value += 1; // re-crea el <input type="file"> para vaciarlo
}

async function load() {
  loadError.value = null;
  reset();
  try {
    const [periods] = await Promise.all([
      funding.list(),
      lookups.ensureUsers(),
      lookups.ensureProducts(true),
    ]);
    openPeriods.value = periods.filter((p) => p.status === 'OPEN');
    const requested = typeof route.query.periodo === 'string' ? route.query.periodo : '';
    form.periodId =
      openPeriods.value.find((p) => p.periodId === requested)?.periodId ??
      openPeriods.value[0]?.periodId ??
      '';
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    ready.value = true;
  }
}
useOnEnter(load);

/** Productos activos, por código de la máquina ("21 · Coca cola 250ml"); los que no tienen código, al final. */
const activeProducts = computed(() =>
  lookups.products
    .filter((p) => p.isActive)
    .sort((a, b) => (a.code ?? '999').localeCompare(b.code ?? '999') || a.name.localeCompare(b.name)),
);
const productLabel = (p: { code: string | null; name: string }) =>
  p.code ? `${p.code} · ${p.name}` : p.name;
const selectedPeriod = computed(() => openPeriods.value.find((p) => p.periodId === form.periodId) ?? null);
const productUnit = (id: string) => activeProducts.value.find((p) => p.id === id)?.unit ?? '';

const isCount = (n: number) => Number.isInteger(n) && n >= 1;

/** Unidades de la línea (por paquete: paquetes × unidades por paquete). */
function unitsOf(line: Line): number {
  if (line.mode === 'unit') return isCount(line.quantity) ? line.quantity : 0;
  return isCount(line.packageCount) && isCount(line.unitsPerPackage)
    ? line.packageCount * line.unitsPerPackage
    : 0;
}

/** Total por paquetes sugerido: paquetes × precio por paquete. */
function packagesCents(line: Line): number {
  const price = parseMoneyInput(line.packagePrice);
  return price && isCount(line.packageCount) ? toCents(price) * line.packageCount : 0;
}

function subtotalCents(line: Line): number {
  if (line.mode === 'package') {
    const total = parseMoneyInput(line.total);
    return total ? toCents(total) : packagesCents(line);
  }
  const price = parseMoneyInput(line.unitPrice);
  return price && unitsOf(line) ? toCents(price) * unitsOf(line) : 0;
}

/** Precio por unidad que quedará guardado (lo que se cobra a quien saque el producto). */
function unitPriceCents(line: Line): number {
  const units = unitsOf(line);
  return units ? Math.round(subtotalCents(line) / units) : 0;
}

type LineField = 'product' | 'quantity' | 'unitPrice' | 'packages' | 'total';

/** Primer error de la línea y el campo al que corresponde (se marca en rojo). */
function lineProblem(line: Line): { field: LineField; message: string } | null {
  if (!line.productId) return { field: 'product', message: 'Elige un producto' };
  if (form.lines.filter((l) => l.productId === line.productId).length > 1)
    return { field: 'product', message: 'Producto repetido' };
  if (line.mode === 'unit') {
    if (!isCount(line.quantity)) return { field: 'quantity', message: 'Cantidad inválida' };
    if (!line.unitPrice.trim())
      return { field: 'unitPrice', message: 'Escribe cuánto pagaste por cada unidad' };
    if (!parseMoneyInput(line.unitPrice)) return { field: 'unitPrice', message: 'Precio inválido' };
    return null;
  }
  if (!isCount(line.packageCount) || !isCount(line.unitsPerPackage))
    return { field: 'packages', message: 'Paquetes inválidos' };
  if (line.total.trim() && !parseMoneyInput(line.total)) return { field: 'total', message: 'Total inválido' };
  if (!subtotalCents(line))
    return { field: 'total', message: 'Escribe el precio por paquete o el total pagado' };
  return null;
}
const lineError = (line: Line) => lineProblem(line)?.message ?? null;
/** El error de la línea se ve después de tocarla o de intentar registrar. */
const shownProblem = (line: Line) => (showErrors.value || line.touched ? lineProblem(line) : null);
const invalid = (line: Line, field: LineField) => shownProblem(line)?.field === field;

const totalCents = computed(() => form.lines.reduce((sum, line) => sum + subtotalCents(line), 0));
const totalUnits = computed(() => form.lines.reduce((sum, line) => sum + unitsOf(line), 0));
const isValid = computed(
  () => form.periodId && form.buyerId && form.lines.length > 0 && form.lines.every((l) => !lineError(l)),
);

function removeLine(uid: number) {
  form.lines = form.lines.filter((line) => line.uid !== uid);
}

function clearReceipt() {
  form.receipt = null;
  receiptError.value = null;
  formKey.value += 1;
}

function onReceipt(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  receiptError.value = null;
  if (file && !RECEIPT_TYPES.includes(file.type))
    receiptError.value = 'Debe ser una foto (JPG o PNG) o un PDF.';
  else if (file && file.size > MAX_RECEIPT_BYTES) receiptError.value = 'El archivo pesa más de 5 MB.';
  form.receipt = receiptError.value ? null : file;
}

async function submit() {
  showErrors.value = true;
  error.value = null;
  if (!isValid.value || receiptError.value) return;
  saving.value = true;
  try {
    const purchase = await purchases.register({
      periodId: form.periodId,
      buyerId: form.buyerId,
      store: form.store.trim() || null,
      purchasedAt: dateInputToISO(form.date),
      note: form.note.trim() || null,
      items: form.lines.map((line) =>
        line.mode === 'unit'
          ? {
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: parseMoneyInput(line.unitPrice) as string,
            }
          : {
              productId: line.productId,
              packageCount: line.packageCount,
              unitsPerPackage: line.unitsPerPackage,
              total: (subtotalCents(line) / 100).toFixed(2),
            },
      ),
      receipt: form.receipt,
    });
    toasts.success(
      `Compra de ${formatMoney(purchase.total)} registrada. Los productos ya están en la nevera.`,
    );
    void lookups.ensureProducts(true).catch(() => undefined);
    await router.push(`/admin/compras/${purchase.id}`);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError && e.code === 'PERIOD_CLOSED') await load();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdminPage title="Nueva compra" narrow :with-tabs="false">
    <section>
      <header class="mb-2.5 flex items-center gap-2">
        <RouterLink
          :to="form.periodId ? `/admin/quincenas/${form.periodId}` : '/admin/quincenas/actual'"
          class="glass grid size-11 shrink-0 place-items-center rounded-full text-ink-900"
          aria-label="Cancelar"
        >
          <Icon name="x" :size="18" :stroke="2.6" />
        </RouterLink>
        <div class="flex min-w-0 flex-1 flex-col">
          <h1 class="font-display text-lg leading-tight font-black text-ink-900 lg:text-[22px]">
            Nueva compra
          </h1>
          <p v-if="selectedPeriod" class="truncate text-[11px] text-ink-500 lg:text-xs">
            {{ selectedPeriod.name }} · saldo
            <strong
              class="num"
              :class="selectedPeriod.isOverspent ? 'text-danger-700' : 'text-success-700'"
              >{{ formatMoney(selectedPeriod.balance) }}</strong
            >
          </p>
        </div>
      </header>

      <ErrorState v-if="loadError" :message="loadError" @retry="load" />

      <div v-else-if="ready && !openPeriods.length" class="card">
        <EmptyState
          icon="wallet"
          title="No hay una quincena abierta"
          message="Las compras se registran dentro de una quincena abierta."
        >
          <RouterLink to="/admin/quincenas/actual" class="btn-primary min-h-11">Ir a la quincena</RouterLink>
        </EmptyState>
      </div>

      <form v-else-if="ready" class="flex flex-col gap-2.5" novalidate @submit.prevent="submit">
        <p
          v-if="error"
          class="rounded-xl bg-danger-50 px-3 py-2 text-xs font-bold text-danger-700"
          role="alert"
        >
          {{ error }}
        </p>

        <!-- Datos de la compra -->
        <div class="card grid grid-cols-2 gap-2 p-2.5">
          <label v-if="openPeriods.length > 1" class="field col-span-2">
            Quincena
            <select id="pf-period" v-model="form.periodId" class="control font-bold">
              <option v-for="p in openPeriods" :key="p.periodId" :value="p.periodId">
                {{ p.name }} · saldo {{ formatMoney(p.balance) }}
              </option>
            </select>
          </label>
          <label class="field col-span-2 sm:col-span-1">
            ¿Quién compró?
            <select id="pf-buyer" v-model="form.buyerId" class="control font-bold">
              <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
            </select>
          </label>
          <label class="field col-span-1">
            Fecha de la compra
            <input id="pf-date" v-model="form.date" type="date" class="control" :max="toLocalDateInput()" />
          </label>
          <label class="field col-span-1">
            <span>Tienda <span class="font-semibold text-ink-500">(opcional)</span></span>
            <input
              id="pf-store"
              v-model="form.store"
              type="text"
              maxlength="120"
              class="control"
              placeholder="Ej.: Éxito"
            />
          </label>
          <label class="field col-span-2 sm:col-span-1">
            <span>Nota <span class="font-semibold text-ink-500">(opcional)</span></span>
            <input id="pf-note" v-model="form.note" type="text" maxlength="255" class="control" />
          </label>
        </div>

        <!-- Una tarjeta por producto -->
        <section
          v-for="(line, index) in form.lines"
          :key="line.uid"
          class="card flex flex-col gap-2 bg-white/66! p-2.5"
          :aria-label="`Línea ${index + 1}`"
          @focusout="line.touched = true"
        >
          <div class="flex gap-1.5">
            <label :for="`pl-product-${line.uid}`" class="sr-only">Producto {{ index + 1 }}</label>
            <select
              :id="`pl-product-${line.uid}`"
              v-model="line.productId"
              class="control h-11 min-w-0 flex-1 font-extrabold"
              :aria-invalid="invalid(line, 'product')"
            >
              <option value="" disabled>Elige un producto</option>
              <option v-for="p in activeProducts" :key="p.id" :value="p.id">{{ productLabel(p) }}</option>
            </select>
            <div
              class="flex h-11 shrink-0 gap-0.5 rounded-[10px] bg-ink-900/7 p-[3px]"
              role="group"
              :aria-label="`Cómo se compró el producto ${index + 1}`"
            >
              <button
                type="button"
                class="mode"
                :aria-pressed="line.mode === 'unit'"
                @click="line.mode = 'unit'"
              >
                Unidad
              </button>
              <button
                type="button"
                class="mode"
                :aria-pressed="line.mode === 'package'"
                @click="line.mode = 'package'"
              >
                Paquete
              </button>
            </div>
          </div>

          <!-- Por unidad: cantidad × precio -->
          <div v-if="line.mode === 'unit'" class="grid grid-cols-2 gap-1.5">
            <label class="field" :class="{ 'text-danger-700!': invalid(line, 'quantity') }">
              <span
                >Cantidad<span v-if="productUnit(line.productId)" class="font-semibold text-ink-500">
                  · {{ productUnit(line.productId) }}</span
                ></span
              >
              <input
                :id="`pl-qty-${line.uid}`"
                v-model.number="line.quantity"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="control num text-sm"
                :aria-invalid="invalid(line, 'quantity')"
              />
            </label>
            <label class="field" :class="{ 'text-danger-700!': invalid(line, 'unitPrice') }">
              <span aria-hidden="true">Precio c/u</span>
              <input
                :id="`pl-price-${line.uid}`"
                v-model="line.unitPrice"
                type="text"
                inputmode="decimal"
                class="control num text-sm"
                placeholder="$0"
                aria-label="Precio unitario"
                :aria-invalid="invalid(line, 'unitPrice')"
                :aria-describedby="shownProblem(line) ? `pl-error-${line.uid}` : undefined"
              />
            </label>
          </div>

          <!-- Por paquete: paquetes × unidades, precio por paquete o total pagado -->
          <div v-else class="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-4">
            <label class="field" :class="{ 'text-danger-700!': invalid(line, 'packages') }">
              Paquetes
              <input
                :id="`pl-packs-${line.uid}`"
                v-model.number="line.packageCount"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="control num text-sm"
                :aria-invalid="invalid(line, 'packages')"
              />
            </label>
            <label class="field" :class="{ 'text-danger-700!': invalid(line, 'packages') }">
              <span aria-hidden="true">Und. × paquete</span>
              <input
                :id="`pl-per-${line.uid}`"
                v-model.number="line.unitsPerPackage"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="control num text-sm"
                aria-label="Unidades por paquete"
                :aria-invalid="invalid(line, 'packages')"
              />
            </label>
            <label class="field">
              <span aria-hidden="true">$ × paquete</span>
              <input
                :id="`pl-pack-price-${line.uid}`"
                v-model="line.packagePrice"
                type="text"
                inputmode="decimal"
                class="control num text-sm"
                placeholder="$0"
                aria-label="Precio por paquete"
              />
            </label>
            <label class="field" :class="{ 'text-danger-700!': invalid(line, 'total') }">
              <span aria-hidden="true">Pagado</span>
              <input
                :id="`pl-total-${line.uid}`"
                v-model="line.total"
                type="text"
                inputmode="decimal"
                class="control num text-sm"
                :placeholder="packagesCents(line) ? formatMoney(packagesCents(line) / 100) : '$0'"
                aria-label="Total pagado"
                :aria-invalid="invalid(line, 'total')"
                :aria-describedby="`pl-calc-${line.uid}`"
              />
            </label>
          </div>

          <p
            v-if="shownProblem(line)"
            :id="`pl-error-${line.uid}`"
            class="text-[11px] font-extrabold text-danger-700"
          >
            {{ shownProblem(line)!.message }}
          </p>
          <div class="flex items-center justify-between gap-2">
            <p
              v-if="line.mode === 'package'"
              :id="`pl-calc-${line.uid}`"
              class="flex min-w-0 flex-1 flex-wrap justify-between gap-x-3 text-[11px] font-extrabold text-success-700"
              aria-live="polite"
            >
              <span>Entran {{ unitsOf(line) }} {{ unitsOf(line) === 1 ? 'unidad' : 'unidades' }}</span>
              <span class="num">{{ formatMoney(unitPriceCents(line) / 100) }} c/u</span>
            </p>
            <p v-else class="min-w-0 flex-1 text-[11px] font-extrabold text-success-700">
              <template v-if="subtotalCents(line)">
                Subtotal <span class="num">{{ formatMoney(subtotalCents(line) / 100) }}</span>
              </template>
            </p>
            <button
              v-if="form.lines.length > 1"
              type="button"
              class="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-[11px] font-extrabold text-ink-500 hover:text-danger-700"
              :aria-label="`Quitar producto ${index + 1}`"
              @click="removeLine(line.uid)"
            >
              <Icon name="x" :size="14" :stroke="2.4" /> Quitar
            </button>
          </div>
        </section>

        <button
          type="button"
          class="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#9DB6C9] bg-white/40 text-xs font-extrabold text-brand-700 hover:bg-white/60"
          @click="form.lines.push(newLine())"
        >
          <Icon name="plus" :size="14" :stroke="2.8" /> Agregar producto
        </button>

        <!-- Comprobante (opcional): foto con la cámara o archivo -->
        <section class="card flex flex-col gap-1.5 bg-white/55! p-2.5">
          <span class="flex justify-between text-[11px] font-extrabold text-ink-700">
            <span>Comprobante</span><span class="font-bold text-ink-500">Opcional</span>
          </span>
          <div :key="formKey" class="grid grid-cols-2 gap-1.5">
            <label class="receipt-btn">
              <Icon name="camera" :size="16" :stroke="2.2" /> Tomar foto
              <input type="file" accept="image/*" capture="environment" class="sr-only" @change="onReceipt" />
            </label>
            <label class="receipt-btn">
              <Icon name="upload" :size="16" :stroke="2.2" /> Subir archivo
              <input
                id="pf-receipt"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                class="sr-only"
                aria-label="Comprobante"
                @change="onReceipt"
              />
            </label>
          </div>
          <p v-if="receiptError" class="text-[11px] font-extrabold text-danger-700" role="alert">
            {{ receiptError }}
          </p>
          <p v-else-if="form.receipt" class="flex items-center gap-2 text-[11px] text-ink-700">
            <Icon name="receipt" :size="14" class="shrink-0 text-success-700" />
            <span class="min-w-0 flex-1 truncate font-bold">{{ form.receipt.name }}</span>
            <button
              type="button"
              class="-my-2 min-h-11 shrink-0 px-1 font-extrabold text-ink-500 hover:text-danger-700"
              @click="clearReceipt"
            >
              Quitar
            </button>
          </p>
          <p v-else class="text-[10px] text-ink-500">Foto o PDF del recibo, hasta 5 MB.</p>
        </section>
        <p class="text-center text-[11px] text-ink-500">
          Al registrarla, sus productos entran solos a la nevera.
        </p>

        <!-- Espacio para que la barra fija no tape lo último -->
        <div class="h-24" aria-hidden="true" />

        <!-- Barra fija: total y registrar (esta página no lleva la barra de pestañas) -->
        <div
          class="buy-bar fixed inset-x-0 bottom-0 z-30 border-t border-white/95 bg-white/75 backdrop-blur-xl"
        >
          <div class="mx-auto flex max-w-2xl items-center gap-2.5 px-3.5 pt-2.5 sm:px-6">
            <span class="flex shrink-0 flex-col">
              <span class="text-[10px] text-ink-500">Total · {{ formatNumber(totalUnits) }} und.</span>
              <span class="num text-lg text-ink-900">{{ formatMoney(totalCents / 100) }}</span>
            </span>
            <button
              type="submit"
              class="btn-primary h-[46px] flex-1 rounded-[14px] font-display text-[15px] font-black"
              :disabled="saving || !isValid || Boolean(receiptError)"
            >
              <span
                v-if="saving"
                class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              {{ saving ? 'Registrando…' : 'Registrar compra' }}
            </button>
          </div>
        </div>
      </form>

      <div v-else class="flex flex-col gap-2.5" aria-busy="true">
        <div class="h-[120px] animate-pulse rounded-[18px] bg-white/50" />
        <div class="h-[120px] animate-pulse rounded-[18px] bg-white/50" />
      </div>
    </section>
  </AdminPage>
</template>

<style scoped>
/* Campo compacto del mockup: etiqueta pequeña (10px, 800) encima del control. */
.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  color: #2c4a60;
}
.control {
  height: 2.75rem;
  width: 100%;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid #c9dcea;
  background: #fff;
  padding: 0 0.625rem;
  font-size: 13px;
  color: #073b5e;
}
.control:focus {
  outline: none;
  border-color: #0b79c3;
  box-shadow: 0 0 0 3px rgb(11 121 195 / 0.2);
}
.control[aria-invalid='true'] {
  border: 1.5px solid #e05a4b;
  background: #fff6f5;
}
/* Unidad / Paquete: la opción activa en blanco. */
.mode {
  border-radius: 8px;
  padding: 0 0.6rem;
  font-size: 11px;
  font-weight: 700;
  color: #2c4a60;
}
.mode[aria-pressed='true'] {
  background: #fff;
  box-shadow: 0 1px 3px rgb(7 59 94 / 0.14);
  color: #073b5e;
  font-weight: 900;
}
.receipt-btn {
  display: flex;
  height: 2.75rem;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  border: 1px solid #c9dcea;
  background: #fff;
  font-size: 12px;
  font-weight: 800;
  color: #073b5e;
}
.receipt-btn:hover {
  background: #f1f8fd;
}
.receipt-btn:focus-within {
  outline: 2px solid #1a88cf;
  outline-offset: 2px;
}
.buy-bar {
  padding-bottom: calc(var(--ion-safe-area-bottom, 0px) + 0.875rem);
}
@media (min-width: 1024px) {
  .field {
    font-size: 11px;
  }
  .mode {
    font-size: 12px;
  }
}
</style>
