<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ErrorState from '@/components/ui/ErrorState.vue';
import FormField from '@/components/ui/FormField.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { parseMoneyInput, toCents } from '@/utils/format';

const props = defineProps<{ id?: string }>();
const { catalog } = useServices();
const lookups = useLookupsStore();
const toasts = useToastStore();
const router = useRouter();

const isEdit = computed(() => Boolean(props.id));
const form = reactive({
  name: '',
  description: '',
  unit: 'unidad',
  minStock: 0,
  categoryId: '',
  referencePrice: '',
  initialQuantity: 0,
  isActive: true,
});
const currentStock = ref(0);
const loadError = ref<string | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

const newCategory = ref('');
const showNewCategory = ref(false);
const creatingCategory = ref(false);

/** La página puede reutilizarse al volver: se empieza siempre con el formulario limpio. */
function reset() {
  Object.assign(form, {
    name: '',
    description: '',
    unit: 'unidad',
    minStock: 0,
    categoryId: '',
    referencePrice: '',
    initialQuantity: 0,
    isActive: true,
  });
  error.value = null;
  fieldErrors.value = {};
  newCategory.value = '';
  showNewCategory.value = false;
}

async function load() {
  loadError.value = null;
  reset();
  try {
    await lookups.ensureCategories();
    if (!props.id) return;
    const { product } = await catalog.getProduct(props.id);
    Object.assign(form, {
      name: product.name,
      description: product.description ?? '',
      unit: product.unit,
      minStock: product.minStock,
      categoryId: product.categoryId ?? '',
      referencePrice: product.referencePrice ? String(toCents(product.referencePrice) / 100) : '',
      isActive: product.isActive,
    });
    currentStock.value = product.quantity;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
useOnEnter(load);

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

async function submit() {
  error.value = null;
  fieldErrors.value = {};
  saving.value = true;
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
      const product = await catalog.updateProduct(props.id, { ...details, isActive: form.isActive });
      toasts.success(`"${product.name}" actualizado.`);
    } else {
      const product = await catalog.createProduct({
        ...details,
        initialQuantity: Number(form.initialQuantity) || undefined,
      });
      toasts.success(`"${product.name}" creado.`);
    }
    void lookups.ensureProducts(true).catch(() => undefined);
    await router.push('/admin/productos');
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (e.code === 'PRODUCT_NAME_TAKEN') fieldErrors.value = { name: e.message };
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdminPage :title="isEdit ? 'Editar producto' : 'Nuevo producto'" narrow>
    <section>
      <PageHeader :title="isEdit ? 'Editar producto' : 'Nuevo producto'">
        <template #eyebrow>
          <RouterLink
            to="/admin/productos"
            class="mb-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-brand-600 hover:text-brand-800"
          >
            <Icon name="chevronLeft" :size="14" /> Productos
          </RouterLink>
        </template>
      </PageHeader>

      <ErrorState v-if="loadError" :message="loadError" @retry="load" />

      <form v-else class="card space-y-5 p-6" novalidate @submit.prevent="submit">
        <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {{ error }}
        </p>

        <FormField id="p-name" label="Nombre" :error="fieldErrors.name">
          <input
            id="p-name"
            v-model="form.name"
            type="text"
            maxlength="120"
            class="input"
            placeholder="Ej.: Gaseosa 400 ml"
            :aria-invalid="Boolean(fieldErrors.name)"
            required
          />
        </FormField>

        <FormField id="p-description" label="Descripción" optional :error="fieldErrors.description">
          <input id="p-description" v-model="form.description" type="text" maxlength="255" class="input" />
        </FormField>

        <div class="grid gap-5 sm:grid-cols-2">
          <FormField
            id="p-unit"
            label="Unidad"
            hint="Cómo se cuenta: unidad, lata, botella…"
            :error="fieldErrors.unit"
          >
            <input id="p-unit" v-model="form.unit" type="text" maxlength="20" class="input" />
          </FormField>
          <FormField
            id="p-min"
            label="Stock mínimo"
            hint="Con esta cantidad o menos se marca para reponer."
            :error="fieldErrors.minStock"
          >
            <input id="p-min" v-model.number="form.minStock" type="number" min="0" step="1" class="input" />
          </FormField>
        </div>

        <FormField
          id="p-ref-price"
          label="Precio de referencia"
          optional
          hint="Lo que se saca se cobra al precio de la última compra; este se usa si el producto nunca se ha comprado (regalos, stock inicial)."
          :error="fieldErrors.referencePrice"
        >
          <input
            id="p-ref-price"
            v-model="form.referencePrice"
            type="text"
            inputmode="decimal"
            class="input tabular-nums"
            placeholder="Ej.: 2500"
          />
        </FormField>

        <FormField id="p-category" label="Categoría" optional :error="fieldErrors.categoryId">
          <div class="flex gap-2">
            <select id="p-category" v-model="form.categoryId" class="input">
              <option value="">Sin categoría</option>
              <option v-for="c in lookups.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button
              type="button"
              class="btn-secondary shrink-0 px-3"
              @click="showNewCategory = !showNewCategory"
            >
              <Icon name="plus" :size="16" /> Nueva
            </button>
          </div>
        </FormField>
        <div v-if="showNewCategory" class="flex gap-2 rounded-xl glass-inset p-3">
          <input
            v-model="newCategory"
            type="text"
            maxlength="80"
            class="input"
            placeholder="Nombre de la categoría"
            aria-label="Nombre de la nueva categoría"
            @keydown.enter.prevent="createCategory"
          />
          <button
            type="button"
            class="btn-primary shrink-0"
            :disabled="creatingCategory"
            @click="createCategory"
          >
            Crear
          </button>
        </div>

        <FormField
          v-if="!isEdit"
          id="p-initial"
          label="Stock inicial"
          optional
          hint="Si ya hay unidades en la nevera; se registra como una entrada a tu nombre."
        >
          <input
            id="p-initial"
            v-model.number="form.initialQuantity"
            type="number"
            min="0"
            step="1"
            class="input"
          />
        </FormField>

        <div v-else class="flex items-center justify-between rounded-xl glass-inset px-4 py-3 text-sm">
          <span class="text-ink-600">
            Stock actual: <strong class="text-ink-900">{{ currentStock }}</strong> (cambia solo con
            movimientos)
          </span>
          <label class="flex items-center gap-2 text-ink-700">
            <input v-model="form.isActive" type="checkbox" class="size-4 accent-brand-700" /> Activo
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-ink-200/70 pt-5">
          <RouterLink to="/admin/productos" class="btn-secondary">Cancelar</RouterLink>
          <button type="submit" class="btn-primary" :disabled="saving || !form.name.trim()">
            {{ saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto' }}
          </button>
        </div>
      </form>
    </section>
  </AdminPage>
</template>
