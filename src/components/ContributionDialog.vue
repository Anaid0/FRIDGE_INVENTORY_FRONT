<script setup lang="ts">
import { ref, watch } from 'vue';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { dateInputToISO, toLocalDateInput } from '@/utils/dates';
import { formatMoney, fullName, parseMoneyInput } from '@/utils/format';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

const props = defineProps<{ open: boolean; periodId: string }>();
const emit = defineEmits<{ close: []; done: [] }>();

const { funding } = useServices();
const lookups = useLookupsStore();
const toasts = useToastStore();

const userId = ref('');
const amount = ref('');
const paidAt = ref('');
const note = ref('');
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    userId.value = '';
    amount.value = '';
    note.value = '';
    paidAt.value = toLocalDateInput();
    error.value = null;
    fieldErrors.value = {};
    await lookups.ensureUsers().catch(() => undefined);
  },
  { immediate: true },
);

async function submit() {
  error.value = null;
  fieldErrors.value = {};
  const parsedAmount = parseMoneyInput(amount.value);
  if (!userId.value || !parsedAmount) {
    fieldErrors.value = {
      ...(!userId.value && { userId: 'Elige quién aportó.' }),
      ...(!parsedAmount && { amount: 'Escribe un monto válido, por ejemplo 50000 o 50.000.' }),
    };
    return;
  }
  saving.value = true;
  try {
    const contribution = await funding.contribute(props.periodId, {
      userId: userId.value,
      amount: parsedAmount,
      paidAt: dateInputToISO(paidAt.value),
      note: note.value.trim() || null,
    });
    const who = lookups.users.find((u) => u.id === contribution.userId);
    toasts.success(
      `Aporte de ${formatMoney(contribution.amount)}${who ? ` de ${fullName(who)}` : ''} registrado.`,
    );
    emit('done');
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
    title="Registrar aporte"
    description="Dinero que alguien puso para esta quincena."
    @close="emit('close')"
  >
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
        {{ error }}
      </p>
      <FormField id="ct-user" label="¿Quién aportó?" :error="fieldErrors.userId">
        <select id="ct-user" v-model="userId" class="input" :aria-invalid="Boolean(fieldErrors.userId)">
          <option value="" disabled>Elige una persona</option>
          <option v-for="user in lookups.users" :key="user.id" :value="user.id">{{ fullName(user) }}</option>
        </select>
      </FormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField id="ct-amount" label="Monto" hint="Ej.: 20.000" :error="fieldErrors.amount">
          <input
            id="ct-amount"
            v-model="amount"
            type="text"
            inputmode="decimal"
            class="input num text-base"
            placeholder="$ 20.000"
            :aria-invalid="Boolean(fieldErrors.amount)"
          />
        </FormField>
        <FormField id="ct-date" label="Fecha" :error="fieldErrors.paidAt">
          <input id="ct-date" v-model="paidAt" type="date" class="input" />
        </FormField>
      </div>
      <FormField id="ct-note" label="Nota" optional>
        <input
          id="ct-note"
          v-model="note"
          type="text"
          maxlength="255"
          class="input"
          placeholder="Ej.: transferencia"
        />
      </FormField>
      <div class="grid grid-cols-2 gap-2 pt-2">
        <button type="button" class="btn-secondary min-h-11" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button type="submit" class="btn-primary min-h-11" :disabled="saving || !amount">
          {{ saving ? 'Guardando…' : 'Registrar aporte' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
