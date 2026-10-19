<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { ConsumptionCharge } from '@/domain/models';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { formatDateTime, formatMoney, formatNumber, fullName, toCents } from '@/utils/format';
import ChargePaymentDialog from './ChargePaymentDialog.vue';
import Avatar from './ui/Avatar.vue';
import Badge from './ui/Badge.vue';
import EmptyState from './ui/EmptyState.vue';
import Icon from './ui/Icon.vue';

/**
 * "Quien más consume, más aporta": cuánto aporta cada persona según lo que consumió en la quincena,
 * valorado al precio de compra de cada producto. Abierta: estimación en vivo. Cerrada: los cobros
 * guardados al cerrarla, con lo pagado y lo pendiente (se paga como aporte a la quincena siguiente).
 */
const props = defineProps<{ periodId: string; refreshKey?: number }>();
const emit = defineEmits<{ changed: [] }>();

const { funding } = useServices();
const auth = useAuthStore();
const toasts = useToastStore();

const charges = useAsync(() => funding.charges(props.periodId));
watch(
  () => [props.periodId, props.refreshKey],
  () => charges.run(),
  { immediate: true },
);

const data = computed(() => charges.data.value);
const generated = computed(() => data.value?.status === 'generated');
const maxAmount = computed(() => Math.max(1, ...(data.value?.charges ?? []).map((c) => toCents(c.amount))));
const width = (c: ConsumptionCharge) => `${Math.max(2, (toCents(c.amount) / maxAmount.value) * 100)}%`;
const isPaid = (c: ConsumptionCharge) => toCents(c.pending) <= 0;

const paying = ref<ConsumptionCharge | null>(null);
async function onPaid() {
  paying.value = null;
  await charges.run();
  emit('changed');
}

const regenerating = ref(false);
async function regenerate() {
  regenerating.value = true;
  try {
    await funding.generateCharges(props.periodId);
    await charges.run();
    toasts.success('Cobros recalculados con los retiros y precios actuales.');
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    regenerating.value = false;
  }
}
</script>

<template>
  <section class="card overflow-hidden" aria-labelledby="charges-title">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/70 px-[22px] py-4">
      <div class="min-w-0">
        <h2 id="charges-title" class="text-[19px] font-black text-ink-900">Cuánto aporta cada uno</h2>
        <p class="mt-0.5 max-w-2xl text-[13px] text-ink-500">
          <template v-if="generated">
            Quien más consume, más aporta: lo que cada uno sacó, al precio de compra. Se paga como aporte a la
            siguiente quincena.
          </template>
          <template v-else>
            Lo que cada uno lleva consumido en esta quincena, al precio de compra. Al cerrarla se convierte en
            su aporte para el siguiente mercado.
          </template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge v-if="data && !generated" tone="info">Estimado</Badge>
        <button
          v-if="auth.isAdmin && data?.canGenerate"
          type="button"
          class="btn-secondary min-h-11"
          :disabled="regenerating"
          @click="regenerate"
        >
          <Icon name="refresh" :size="16" />
          {{ regenerating ? 'Recalculando…' : generated ? 'Recalcular cobros' : 'Generar cobros' }}
        </button>
      </div>
    </div>

    <p v-if="charges.error.value && !data" class="px-[22px] py-4 text-sm text-danger-700">
      {{ charges.error.value }}
    </p>
    <EmptyState
      v-else-if="data && !data.charges.length"
      icon="wallet"
      title="Nadie ha sacado nada en esta quincena"
    />
    <template v-else-if="data">
      <ul class="divide-y divide-ink-200/60" aria-label="Aporte por persona">
        <li
          v-for="c in data.charges"
          :key="c.user.id"
          class="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 px-[22px] py-3 sm:grid-cols-[auto_minmax(0,14rem)_1fr_auto]"
        >
          <Avatar :person="c.user" size="sm" />
          <div class="min-w-0">
            <p class="truncate font-bold text-ink-800">{{ fullName(c.user) }}</p>
            <p class="text-xs text-ink-500">
              {{ formatNumber(c.units) }} und.
              <span v-if="c.unpricedUnits" class="text-accent-700">
                · {{ formatNumber(c.unpricedUnits) }} sin precio</span
              >
            </p>
          </div>
          <span
            class="col-span-3 row-start-2 h-2 overflow-hidden rounded-full bg-ink-100 sm:col-span-1 sm:row-start-auto"
          >
            <span class="block h-full rounded-full bg-accent-500" :style="{ width: width(c) }" />
          </span>
          <div class="flex flex-col items-end gap-1">
            <span class="font-black text-ink-900 tabular-nums">{{ formatMoney(c.amount) }}</span>
            <template v-if="generated">
              <Badge v-if="isPaid(c)" tone="success"><Icon name="check" :size="12" /> Pagado</Badge>
              <span v-else class="flex flex-wrap items-center justify-end gap-2">
                <Badge tone="accent">Debe {{ formatMoney(c.pending) }}</Badge>
                <button
                  v-if="auth.isAdmin && c.id"
                  type="button"
                  class="text-sm font-extrabold text-brand-600 hover:text-brand-800"
                  :aria-label="`Registrar pago de ${fullName(c.user)}`"
                  @click="paying = c"
                >
                  Registrar pago
                </button>
              </span>
            </template>
          </div>
        </li>
      </ul>
      <div
        class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-ink-200/70 bg-ink-50/70 px-[22px] py-3 text-sm"
      >
        <span class="font-extrabold text-ink-900"> Total {{ formatMoney(data.totals.amount) }} </span>
        <span v-if="generated" class="text-ink-600">
          Pagado <strong class="text-success-800">{{ formatMoney(data.totals.paid) }}</strong> · Pendiente
          <strong class="text-accent-700">{{ formatMoney(data.totals.pending) }}</strong>
        </span>
        <span v-if="generated && data.charges[0]?.computedAt" class="text-xs text-ink-500">
          Calculado el {{ formatDateTime(data.charges[0].computedAt) }}
        </span>
      </div>
      <p
        v-if="data.totals.unpricedUnits"
        class="flex items-start gap-2 border-t border-accent-200/70 bg-accent-50/80 px-[22px] py-3 text-sm text-accent-700"
        role="note"
      >
        <Icon name="alert" :size="16" class="mt-0.5" />
        <span>
          {{ formatNumber(data.totals.unpricedUnits) }}
          {{ data.totals.unpricedUnits === 1 ? 'unidad' : 'unidades' }} de productos sin compras ni precio de
          referencia se valoraron en $0. Ponles precio en
          <RouterLink to="/admin/productos" class="font-extrabold underline">Productos</RouterLink>
          <template v-if="generated"> y recalcula los cobros</template>.
        </span>
      </p>
    </template>
    <p v-else class="px-[22px] py-6 text-center text-sm text-ink-500">Cargando…</p>

    <ChargePaymentDialog :charge="paying" @close="paying = null" @done="onPaid" />
  </section>
</template>
