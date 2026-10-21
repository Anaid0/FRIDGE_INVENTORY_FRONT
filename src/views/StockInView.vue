<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminPage from '@/layouts/AdminPage.vue';
import ProductArt from '@/components/machine/ProductArt.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { formatNumber } from '@/utils/format';

/**
 * Ingresar stock (solo admin): lo que entra a la nevera sin ser una compra (regalos, stock inicial).
 * Se arma una lista de productos con cantidades y, al confirmar, se registra una entrada por producto.
 * `?producto=<id>` deja ese producto elegido con 1 unidad (botones "+" de Productos).
 */
const { catalog, movements } = useServices();
const route = useRoute();
const router = useRouter();
const toasts = useToastStore();
const lookups = useLookupsStore();

const products = useAsync(() => catalog.listProducts());
const categories = useAsync(() => catalog.listCategories());

/** Cantidad elegida por producto (id → unidades). El orden de inserción es el orden de registro. */
const cart = reactive(new Map<string, number>());
const search = ref('');
const categoryId = ref<string | null>(null);

useOnEnter(async () => {
  void categories.run();
  await products.run();
  const preselect = route.query.producto;
  if (typeof preselect === 'string' && !cart.has(preselect) && byId(preselect)) cart.set(preselect, 1);
});

function byId(id: string): Product | undefined {
  return products.data.value?.find((p) => p.id === id);
}

/** Sin tildes ni mayúsculas, para buscar "lacteos" y encontrar "Lácteos". */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const visible = computed(() => {
  const term = normalize(search.value.trim());
  return (products.data.value ?? []).filter(
    (p) =>
      (!categoryId.value || p.categoryId === categoryId.value) &&
      (!term || normalize(p.name).includes(term) || p.code === term),
  );
});

// --- Cantidades ---
const MAX_QTY = 999;

function qty(id: string): number {
  return cart.get(id) ?? 0;
}
function add(id: string) {
  cart.set(id, Math.min(MAX_QTY, qty(id) + 1));
}
function remove(id: string) {
  const next = qty(id) - 1;
  if (next > 0) cart.set(id, next);
  else cart.delete(id);
}
/** Cantidad escrita a mano: vacía o 0 quita el producto de la lista. */
function setQty(id: string, raw: string) {
  const value = Math.min(MAX_QTY, Math.max(0, Math.floor(Number(raw.replace(/\D/g, '')) || 0)));
  if (value > 0) cart.set(id, value);
  else cart.delete(id);
}

const lines = computed(() =>
  [...cart.entries()]
    .map(([id, quantity]) => ({ product: byId(id), quantity }))
    .filter((line): line is { product: Product; quantity: number } => Boolean(line.product)),
);
const totalUnits = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0));
/** "4 Agua · 6 Leche Semidescremada". */
const summary = computed(() => lines.value.map((l) => `${l.quantity} ${l.product.name}`).join(' · '));
const unitsLabel = (n: number) => `${formatNumber(n)} ${n === 1 ? 'producto' : 'productos'}`;

function clear() {
  cart.clear();
  saveError.value = null;
}

// --- Registrar ---
const confirmOpen = ref(false);
const saving = ref(false);
const progress = ref(0);
const note = ref('');
const saveError = ref<string | null>(null);

function openConfirm() {
  if (!lines.value.length) return;
  saveError.value = null;
  confirmOpen.value = true;
}

/** Mientras guarda no se puede cerrar (quedaría a medias sin ver el resultado). */
function closeConfirm() {
  if (!saving.value) confirmOpen.value = false;
}

/**
 * Registra una entrada por producto, en orden. Cada línea guardada sale de la lista; si una falla se
 * detiene y quedan las que faltan (para reintentar sin duplicar las ya guardadas).
 */
async function save() {
  saving.value = true;
  progress.value = 0;
  const total = lines.value.length;
  let units = 0;
  const text = note.value.trim() || null;
  try {
    for (const line of [...lines.value]) {
      const { product } = await movements.stockIn({
        productId: line.product.id,
        quantity: line.quantity,
        note: text,
      });
      units += line.quantity;
      progress.value += 1;
      cart.delete(line.product.id);
      // Se actualiza el "Hay N" del producto con lo que devolvió la API.
      products.data.value = (products.data.value ?? []).map((p) => (p.id === product.id ? product : p));
    }
  } catch (e) {
    const done = progress.value;
    saveError.value =
      done > 0
        ? `Se guardaron ${done} de ${total}. No se pudo guardar el resto: ${errorMessage(e)}`
        : errorMessage(e);
    toasts.error(saveError.value);
    return;
  } finally {
    saving.value = false;
    confirmOpen.value = false;
    void lookups.ensureProducts(true).catch(() => undefined);
  }
  note.value = '';
  toasts.success(`Ingresaron ${formatNumber(units)} ${units === 1 ? 'unidad' : 'unidades'} a la nevera`);
  await router.push('/admin');
}
</script>

<template>
  <AdminPage title="Ingresar stock">
    <PageHeader
      title="Ingresar stock"
      subtitle="Lo que entra a la nevera (regalos, stock inicial). Las compras se registran en Quincena."
      back="/admin"
    />

    <div class="flex flex-col gap-3">
      <label class="glass-strong flex h-12 items-center gap-2.5 rounded-[14px] px-3.5 text-ink-500">
        <Icon name="search" :size="20" :stroke="2.2" />
        <span class="sr-only">Buscar producto</span>
        <input
          v-model="search"
          type="search"
          placeholder="Buscar producto"
          class="min-w-0 flex-1 border-0 bg-transparent text-base text-ink-800 placeholder:text-ink-500 focus:outline-none"
        />
      </label>

      <div
        v-if="categories.data.value?.length"
        class="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Categoría"
      >
        <button
          type="button"
          class="chip min-h-11 shrink-0 px-[18px] text-[15px]"
          :aria-pressed="categoryId === null"
          @click="categoryId = null"
        >
          Todo
        </button>
        <button
          v-for="c in categories.data.value"
          :key="c.id"
          type="button"
          class="chip min-h-11 shrink-0 px-[18px] text-[15px]"
          :aria-pressed="categoryId === c.id"
          @click="categoryId = categoryId === c.id ? null : c.id"
        >
          {{ c.name }}
        </button>
      </div>

      <ErrorState
        v-if="products.error.value && !products.data.value"
        :message="products.error.value"
        @retry="products.run"
      />

      <ul v-else-if="!products.data.value" class="grid gap-2 lg:grid-cols-2" aria-label="Cargando productos">
        <li v-for="i in 4" :key="i" class="h-[76px] animate-pulse rounded-[18px] bg-white/60" />
      </ul>

      <EmptyState
        v-else-if="!visible.length"
        icon="search"
        title="No hay productos que coincidan"
        message="Prueba con otro nombre o con otra categoría."
      />

      <ul v-else class="grid gap-2 lg:grid-cols-2" aria-label="Productos">
        <li
          v-for="p in visible"
          :key="p.id"
          class="flex min-h-[76px] items-center gap-3 rounded-[18px] border-2 p-3 transition-colors"
          :class="
            qty(p.id) ? 'border-[#2E9A62] bg-[#EFF9F3]' : 'border-white/90 bg-white/80 backdrop-blur-md'
          "
        >
          <span
            class="grid size-12 shrink-0 place-items-center rounded-[14px]"
            :class="qty(p.id) ? 'bg-success-100' : 'bg-brand-50'"
          >
            <ProductArt :name="p.name" :size="30" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="font-display text-[17px] leading-tight font-black text-ink-900">{{ p.name }}</span>
            <span v-if="qty(p.id)" class="text-sm font-bold text-success-700"
              >Hay {{ formatNumber(p.quantity) }} → quedarán {{ formatNumber(p.quantity + qty(p.id)) }}</span
            >
            <span v-else class="text-sm text-ink-500">Hay {{ formatNumber(p.quantity) }}</span>
          </span>

          <span v-if="qty(p.id)" class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="press grid size-11 place-items-center rounded-xl border border-[#B7E1C9] bg-white text-success-700"
              :aria-label="`Quitar un ${p.name}`"
              :disabled="saving"
              @click="remove(p.id)"
            >
              <Icon name="minus" :size="20" :stroke="3" />
            </button>
            <input
              :value="qty(p.id)"
              type="text"
              inputmode="numeric"
              class="h-11 w-10 rounded-lg bg-transparent text-center font-display text-[22px] font-black text-ink-900 focus:bg-white focus:ring-2 focus:ring-success-600/40 focus:outline-none"
              :aria-label="`Cantidad de ${p.name}`"
              :disabled="saving"
              @change="setQty(p.id, ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="press grid size-11 place-items-center rounded-xl bg-success-700 text-white"
              :aria-label="`Agregar un ${p.name}`"
              :disabled="saving"
              @click="add(p.id)"
            >
              <Icon name="plus" :size="20" :stroke="3" />
            </button>
          </span>
          <button
            v-else
            type="button"
            class="press grid size-12 shrink-0 place-items-center rounded-[14px] border-2 border-success-700 bg-white text-success-700"
            :aria-label="`Agregar ${p.name}`"
            :disabled="saving"
            @click="add(p.id)"
          >
            <Icon name="plus" :size="24" :stroke="3" />
          </button>
        </li>
      </ul>
    </div>

    <!-- Resumen y "Continuar": pegado abajo, encima de la barra de pestañas flotante. -->
    <div class="stock-bar sticky z-10 mt-4">
      <div class="glass-strong flex flex-col gap-2.5 rounded-[22px] p-3">
        <p
          v-if="saveError"
          class="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-600/20"
          role="alert"
        >
          {{ saveError }}
        </p>
        <div class="flex min-h-9 items-center justify-between gap-3">
          <p class="min-w-0 flex-1 truncate text-sm text-ink-700">
            {{ summary || 'Elige lo que entra a la nevera.' }}
          </p>
          <button
            v-if="lines.length"
            type="button"
            class="min-h-9 shrink-0 px-1 text-sm font-extrabold text-brand-700 hover:text-ink-900"
            :disabled="saving"
            @click="clear"
          >
            Vaciar
          </button>
        </div>
        <button
          type="button"
          class="press flex h-14 items-center gap-3 rounded-[18px] bg-success-700 px-5 font-display text-white shadow-[0_8px_20px_-8px_rgb(21_122_75/0.6)] hover:bg-success-800 disabled:opacity-50"
          :disabled="!lines.length || saving"
          @click="openConfirm"
        >
          <span class="flex-1 text-left text-[19px] font-black">{{
            saving ? 'Guardando…' : 'Continuar'
          }}</span>
          <span
            v-if="totalUnits"
            class="rounded-full bg-white px-3 py-1 font-sans text-sm font-extrabold text-success-700"
            >{{ unitsLabel(totalUnits) }}</span
          >
          <Icon name="arrowRight" :size="22" :stroke="2.6" />
        </button>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="Ingresar a la nevera"
      :message="`Vas a ingresar ${unitsLabel(totalUnits)}: ${summary}.`"
      confirm-label="Ingresar"
      :loading="saving"
      @confirm="save"
      @close="closeConfirm"
    >
      <div class="mt-4">
        <label for="stock-in-note" class="label"
          >Nota <span class="font-normal text-ink-400">(opcional)</span></label
        >
        <input
          id="stock-in-note"
          v-model="note"
          type="text"
          maxlength="200"
          class="input"
          placeholder="Ej.: regalo del cliente, stock inicial"
          :disabled="saving"
        />
      </div>
      <p v-if="saving" class="mt-3 text-sm font-bold text-success-700" role="status">
        Guardando… {{ progress }} de {{ lines.length + progress }}
      </p>
    </ConfirmDialog>
  </AdminPage>
</template>

<style scoped>
/* La barra de pestañas mide 62px y flota a 22px del borde: el resumen queda justo encima. */
.stock-bar {
  bottom: calc(var(--ion-safe-area-bottom) + 92px);
}
</style>
