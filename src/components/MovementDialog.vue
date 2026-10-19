<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MovementType, Product } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { useStatsStore } from '@/stores/stats';
import { useToastStore } from '@/stores/toasts';
import { fullName, withUnit } from '@/utils/format';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

/**
 * Meter o sacar productos de la nevera. Si quien registra es admin, puede elegir quién lo realizó
 * (por defecto él mismo); los empleados no ven ese campo.
 */
const props = defineProps<{ open: boolean; type: MovementType; product: Product | null }>();
const emit = defineEmits<{ close: []; done: [product: Product] }>();

const { movements } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();
const stats = useStatsStore();
const toasts = useToastStore();

const quantity = ref(1);
const note = ref('');
const performedBy = ref('');
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

const isOut = computed(() => props.type === 'OUT');
const title = computed(() => (isOut.value ? 'Sacar de la nevera' : 'Meter a la nevera'));
const exceedsStock = computed(
  () => isOut.value && props.product !== null && quantity.value > props.product.quantity,
);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    quantity.value = 1;
    note.value = '';
    error.value = null;
    fieldErrors.value = {};
    performedBy.value = auth.user?.id ?? '';
    if (auth.isAdmin) await lookups.ensureUsers().catch(() => undefined);
  },
  { immediate: true },
);

async function submit() {
  if (!props.product) return;
  error.value = null;
  fieldErrors.value = {};
  saving.value = true;
  try {
    const input = {
      productId: props.product.id,
      quantity: Number(quantity.value),
      note: note.value.trim() || null,
      performedBy: auth.isAdmin && performedBy.value !== auth.user?.id ? performedBy.value : null,
    };
    const result = isOut.value ? await movements.stockOut(input) : await movements.stockIn(input);
    const who = lookups.users.find((u) => u.id === result.movement.performedBy);
    const onBehalf =
      result.movement.performedBy !== auth.user?.id && who ? ` a nombre de ${fullName(who)}` : '';
    toasts.success(
      `${isOut.value ? 'Retiro' : 'Entrada'} registrado${onBehalf}: ${withUnit(result.movement.quantity, props.product.unit)} de ${props.product.name}.`,
    );
    void stats.refresh();
    emit('done', result.product);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="title"
    :description="product ? `${product.name} · hay ${withUnit(product.quantity, product.unit)}` : undefined"
    @close="emit('close')"
  >
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
        {{ error }}
      </p>

      <FormField
        v-if="auth.isAdmin"
        id="mv-performer"
        label="¿Quién lo realizó?"
        hint="Como administrador puedes registrarlo a nombre de otra persona."
        :error="fieldErrors.performedBy"
      >
        <select id="mv-performer" v-model="performedBy" class="input">
          <option v-for="user in lookups.users" :key="user.id" :value="user.id">
            {{ fullName(user) }}{{ user.id === auth.user?.id ? ' (yo)' : '' }}
          </option>
        </select>
      </FormField>

      <FormField
        id="mv-quantity"
        label="Cantidad"
        :error="
          fieldErrors.quantity ?? (exceedsStock ? `Solo hay ${product?.quantity} disponibles.` : undefined)
        "
      >
        <input
          id="mv-quantity"
          v-model.number="quantity"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          class="input"
          :aria-invalid="exceedsStock || Boolean(fieldErrors.quantity)"
          required
        />
      </FormField>

      <FormField id="mv-note" label="Nota" optional :error="fieldErrors.note">
        <input
          id="mv-note"
          v-model="note"
          type="text"
          maxlength="255"
          class="input"
          :placeholder="isOut ? 'Ej.: para la reunión de las 3' : 'Ej.: traídas de casa'"
        />
      </FormField>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="saving || !quantity || quantity < 1 || exceedsStock"
        >
          {{ saving ? 'Guardando…' : isOut ? 'Sacar' : 'Meter' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
