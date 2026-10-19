<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import FormField from '@/components/ui/FormField.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import type { PeriodSummary } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { dateInputToISO, toLocalDateInput } from '@/utils/dates';
import { formatMoney, fullName, parseMoneyInput, toCents } from '@/utils/format';

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

const activeProducts = computed(() => lookups.products.filter((p) => p.isActive));
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

function lineError(line: Line): string | null {
  if (!line.productId) return 'Elige un producto';
  if (form.lines.filter((l) => l.productId === line.productId).length > 1) return 'Producto repetido';
  if (line.mode === 'unit') {
    if (!isCount(line.quantity)) return 'Cantidad inválida';
    if (!parseMoneyInput(line.unitPrice)) return 'Precio inválido';
    return null;
  }
  if (!isCount(line.packageCount) || !isCount(line.unitsPerPackage)) return 'Paquetes inválidos';
  if (line.total.trim() && !parseMoneyInput(line.total)) return 'Total inválido';
  if (!subtotalCents(line)) return 'Escribe el precio por paquete o el total pagado';
  return null;
}

const totalCents = computed(() => form.lines.reduce((sum, line) => sum + subtotalCents(line), 0));
const isValid = computed(
  () => form.periodId && form.buyerId && form.lines.length > 0 && form.lines.every((l) => !lineError(l)),
);

function removeLine(uid: number) {
  form.lines = form.lines.filter((line) => line.uid !== uid);
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
  <AdminPage title="Registrar compra" narrow>
    <section>
      <PageHeader
        title="Registrar compra"
        subtitle="Lo comprado con el fondo entra automáticamente a la nevera."
      >
        <template #eyebrow>
          <RouterLink
            to="/admin/compras"
            class="mb-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-brand-600 hover:text-brand-800"
          >
            <Icon name="chevronLeft" :size="14" /> Compras
          </RouterLink>
        </template>
      </PageHeader>

      <ErrorState v-if="loadError" :message="loadError" @retry="load" />

      <div v-else-if="ready && !openPeriods.length" class="card">
        <EmptyState
          icon="wallet"
          title="No hay una quincena abierta"
          message="Las compras se registran dentro de una quincena abierta."
        >
          <RouterLink to="/admin/quincenas" class="btn-primary">Ir a quincenas</RouterLink>
        </EmptyState>
      </div>

      <form v-else-if="ready" class="space-y-6" novalidate @submit.prevent="submit">
        <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {{ error }}
        </p>

        <div class="card grid gap-5 p-6 sm:grid-cols-2">
          <FormField id="pf-period" label="Quincena">
            <select id="pf-period" v-model="form.periodId" class="input">
              <option v-for="p in openPeriods" :key="p.periodId" :value="p.periodId">
                {{ p.name }} · saldo {{ formatMoney(p.balance) }}
              </option>
            </select>
          </FormField>
          <FormField id="pf-buyer" label="¿Quién compró?">
            <select id="pf-buyer" v-model="form.buyerId" class="input">
              <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
            </select>
          </FormField>
          <FormField id="pf-store" label="Tienda" optional>
            <input
              id="pf-store"
              v-model="form.store"
              type="text"
              maxlength="120"
              class="input"
              placeholder="Ej.: Éxito"
            />
          </FormField>
          <FormField id="pf-date" label="Fecha de la compra">
            <input id="pf-date" v-model="form.date" type="date" class="input" :max="toLocalDateInput()" />
          </FormField>
        </div>

        <div class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-ink-200/70 px-5 py-4">
            <h2 class="text-[19px] font-black text-ink-900">Productos comprados</h2>
            <button type="button" class="btn-secondary px-3 py-1.5" @click="form.lines.push(newLine())">
              <Icon name="plus" :size="16" /> Agregar producto
            </button>
          </div>
          <div class="divide-y divide-ink-200/60">
            <div v-for="(line, index) in form.lines" :key="line.uid" class="flex flex-col gap-3 px-5 py-4">
              <div class="flex flex-wrap items-start gap-3">
                <div class="min-w-0 flex-[1_1_220px]">
                  <label :for="`pl-product-${line.uid}`" class="sr-only">Producto {{ index + 1 }}</label>
                  <select
                    :id="`pl-product-${line.uid}`"
                    v-model="line.productId"
                    class="input"
                    :aria-invalid="showErrors && Boolean(lineError(line))"
                  >
                    <option value="" disabled>Elige un producto</option>
                    <option v-for="p in activeProducts" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                  <p v-if="showErrors && lineError(line)" class="mt-1 text-xs text-danger-700">
                    {{ lineError(line) }}
                  </p>
                </div>
                <div class="segmented" role="group" :aria-label="`Cómo se compró el producto ${index + 1}`">
                  <button
                    type="button"
                    class="segmented-option"
                    :aria-pressed="line.mode === 'unit'"
                    @click="line.mode = 'unit'"
                  >
                    Por unidad
                  </button>
                  <button
                    type="button"
                    class="segmented-option"
                    :aria-pressed="line.mode === 'package'"
                    @click="line.mode = 'package'"
                  >
                    Por paquete
                  </button>
                </div>
                <button
                  type="button"
                  class="rounded-md p-2.5 text-ink-400 hover:bg-white/70 hover:text-danger-700 disabled:opacity-30"
                  :disabled="form.lines.length === 1"
                  :aria-label="`Quitar producto ${index + 1}`"
                  @click="removeLine(line.uid)"
                >
                  <Icon name="x" :size="16" />
                </button>
              </div>

              <!-- Por unidad: cantidad × precio -->
              <div
                v-if="line.mode === 'unit'"
                class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[8rem_10rem_1fr]"
              >
                <div>
                  <label :for="`pl-qty-${line.uid}`" class="text-xs font-bold text-ink-500">Cantidad</label>
                  <div class="flex items-center gap-1.5">
                    <input
                      :id="`pl-qty-${line.uid}`"
                      v-model.number="line.quantity"
                      type="number"
                      min="1"
                      step="1"
                      class="input tabular-nums"
                    />
                    <span class="text-xs text-ink-500">{{ productUnit(line.productId) }}</span>
                  </div>
                </div>
                <div>
                  <label :for="`pl-price-${line.uid}`" class="text-xs font-bold text-ink-500"
                    >Precio unitario</label
                  >
                  <input
                    :id="`pl-price-${line.uid}`"
                    v-model="line.unitPrice"
                    type="text"
                    inputmode="decimal"
                    class="input tabular-nums"
                    placeholder="Ej.: 2500"
                  />
                </div>
                <p
                  class="col-span-2 pb-2.5 text-right font-extrabold text-ink-900 tabular-nums sm:col-span-1"
                >
                  {{ formatMoney(subtotalCents(line) / 100) }}
                </p>
              </div>

              <!-- Por paquete: paquetes × unidades, precio por paquete o total pagado -->
              <div v-else class="flex flex-col gap-2">
                <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                  <div>
                    <label :for="`pl-packs-${line.uid}`" class="text-xs font-bold text-ink-500"
                      >Paquetes</label
                    >
                    <input
                      :id="`pl-packs-${line.uid}`"
                      v-model.number="line.packageCount"
                      type="number"
                      min="1"
                      step="1"
                      class="input tabular-nums"
                    />
                  </div>
                  <div>
                    <label :for="`pl-per-${line.uid}`" class="text-xs font-bold text-ink-500"
                      >Unidades por paquete</label
                    >
                    <input
                      :id="`pl-per-${line.uid}`"
                      v-model.number="line.unitsPerPackage"
                      type="number"
                      min="1"
                      step="1"
                      class="input tabular-nums"
                    />
                  </div>
                  <div>
                    <label :for="`pl-pack-price-${line.uid}`" class="text-xs font-bold text-ink-500"
                      >Precio por paquete</label
                    >
                    <input
                      :id="`pl-pack-price-${line.uid}`"
                      v-model="line.packagePrice"
                      type="text"
                      inputmode="decimal"
                      class="input tabular-nums"
                      placeholder="Ej.: 13800"
                    />
                  </div>
                  <div>
                    <label :for="`pl-total-${line.uid}`" class="text-xs font-bold text-ink-500"
                      >Total pagado</label
                    >
                    <input
                      :id="`pl-total-${line.uid}`"
                      v-model="line.total"
                      type="text"
                      inputmode="decimal"
                      class="input tabular-nums"
                      :placeholder="
                        packagesCents(line) ? String(packagesCents(line) / 100) : 'Si hubo descuento'
                      "
                      :aria-describedby="`pl-calc-${line.uid}`"
                    />
                  </div>
                </div>
                <p
                  :id="`pl-calc-${line.uid}`"
                  class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-brand-50/90 px-3.5 py-2 text-sm text-ink-700"
                  aria-live="polite"
                >
                  <span>
                    <strong class="text-ink-900 tabular-nums">{{ unitsOf(line) }}</strong>
                    {{ unitsOf(line) === 1 ? 'unidad' : 'unidades' }} ·
                    <strong class="text-ink-900 tabular-nums">{{
                      formatMoney(unitPriceCents(line) / 100)
                    }}</strong>
                    c/u
                    <span class="text-ink-500">(lo que se cobra a quien lo saque)</span>
                  </span>
                  <strong class="text-ink-900 tabular-nums">{{
                    formatMoney(subtotalCents(line) / 100)
                  }}</strong>
                </p>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between glass-inset px-5 py-4">
            <span class="text-sm text-ink-600">Total</span>
            <span class="text-3xl font-black text-ink-900">{{ formatMoney(totalCents / 100) }}</span>
          </div>
        </div>

        <div class="card grid gap-5 p-6 sm:grid-cols-2">
          <FormField
            id="pf-receipt"
            label="Comprobante"
            optional
            hint="Foto o PDF del recibo, hasta 5 MB."
            :error="receiptError ?? undefined"
          >
            <input
              id="pf-receipt"
              :key="formKey"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
              @change="onReceipt"
            />
          </FormField>
          <FormField id="pf-note" label="Nota" optional>
            <input id="pf-note" v-model="form.note" type="text" maxlength="255" class="input" />
          </FormField>
        </div>

        <div class="flex justify-end gap-2">
          <RouterLink to="/admin/compras" class="btn-secondary">Cancelar</RouterLink>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Registrando…' : `Registrar compra · ${formatMoney(totalCents / 100)}` }}
          </button>
        </div>
      </form>
    </section>
  </AdminPage>
</template>
