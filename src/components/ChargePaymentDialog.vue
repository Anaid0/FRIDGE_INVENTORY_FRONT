<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ConsumptionCharge } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useToastStore } from '@/stores/toasts';
import { formatMoney, fullName, parseMoneyInput, toCents } from '@/utils/format';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

/**
 * Pago de un cobro por consumo: entra como aporte de esa persona a la quincena abierta (el fondo del
 * siguiente mercado). Por defecto, todo lo pendiente; también admite pagos parciales.
 */
const props = defineProps<{ charge: ConsumptionCharge | null }>();
const emit = defineEmits<{ close: []; done: [] }>();

const { funding } = useServices();
const toasts = useToastStore();

/** El último cobro mostrado: se mantiene mientras el diálogo se cierra (si no, se vería vacío). */
const shown = ref<ConsumptionCharge | null>(null);
const amount = ref('');
const note = ref('');
const saving = ref(false);
const error = ref<string | null>(null);
const amountError = ref<string | undefined>();

watch(
  () => props.charge,
  (charge) => {
    if (!charge) return;
    shown.value = charge;
    amount.value = String(toCents(charge.pending) / 100);
    note.value = '';
    error.value = null;
    amountError.value = undefined;
  },
  { immediate: true },
);

async function submit() {
  const charge = shown.value;
  if (!props.charge || !charge?.id) return;
  error.value = null;
  const parsed = parseMoneyInput(amount.value);
  if (!parsed || toCents(parsed) <= 0) {
    amountError.value = 'Escribe un monto válido, por ejemplo 20000 o 20.000.';
    return;
  }
  if (toCents(parsed) > toCents(charge.pending)) {
    amountError.value = `No puede ser mayor que lo pendiente (${formatMoney(charge.pending)}).`;
    return;
  }
  amountError.value = undefined;
  saving.value = true;
  try {
    await funding.payCharge(charge.id, { amount: parsed, note: note.value.trim() || null });
    toasts.success(`Pago de ${formatMoney(parsed)} de ${fullName(charge.user)} registrado como aporte.`);
    emit('done');
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError && e.fieldErrors.amount) amountError.value = e.fieldErrors.amount;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :open="charge !== null"
    title="Registrar pago"
    description="Entra como aporte a la quincena abierta, para el siguiente mercado."
    @close="emit('close')"
  >
    <form v-if="shown" class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
        {{ error }}
      </p>
      <dl class="grid grid-cols-3 gap-3 rounded-2xl bg-ink-50/90 px-4 py-3 text-sm">
        <div>
          <dt class="text-ink-500">Consumió</dt>
          <dd class="font-extrabold text-ink-900 tabular-nums">{{ formatMoney(shown.amount) }}</dd>
        </div>
        <div>
          <dt class="text-ink-500">Ya pagó</dt>
          <dd class="font-extrabold text-ink-900 tabular-nums">{{ formatMoney(shown.paid) }}</dd>
        </div>
        <div>
          <dt class="text-ink-500">Pendiente</dt>
          <dd class="font-extrabold text-accent-700 tabular-nums">{{ formatMoney(shown.pending) }}</dd>
        </div>
      </dl>
      <p class="text-sm text-ink-600">
        <strong class="text-ink-900">{{ fullName(shown.user) }}</strong> · {{ shown.period.name }}
      </p>
      <FormField id="cp-amount" label="Monto" hint="Puede ser un pago parcial" :error="amountError">
        <input
          id="cp-amount"
          v-model="amount"
          type="text"
          inputmode="decimal"
          class="input tabular-nums"
          :aria-invalid="Boolean(amountError)"
        />
      </FormField>
      <FormField id="cp-note" label="Nota" optional>
        <input
          id="cp-note"
          v-model="note"
          type="text"
          maxlength="255"
          class="input"
          placeholder="Ej.: transferencia"
        />
      </FormField>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" :disabled="saving || !amount">
          {{ saving ? 'Guardando…' : 'Registrar pago' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
