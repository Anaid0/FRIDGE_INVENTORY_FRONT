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
  <section class="card flex flex-col px-3 pt-1 pb-2 lg:px-4" aria-labelledby="charges-title">
    <div class="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <div class="min-w-0 flex-[1_1_220px]">
        <h2 id="charges-title" class="section-title">Cuánto aporta cada uno</h2>
        <p class="mt-0.5 text-[11px] text-ink-500 lg:text-xs">
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
        <span
          v-if="data && !generated"
          class="inline-flex h-[22px] items-center rounded-full bg-brand-100 px-2 text-[11px] font-extrabold text-brand-700"
          >Estimado</span
        >
        <button
          v-if="auth.isAdmin && data?.canGenerate"
          type="button"
          class="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-ink-300 bg-white/80 px-2.5 text-[11px] font-extrabold text-brand-700 hover:bg-white disabled:opacity-60"
          :disabled="regenerating"
          @click="regenerate"
        >
          <Icon name="refresh" :size="14" :stroke="2.2" />
          {{ regenerating ? 'Recalculando…' : generated ? 'Recalcular cobros' : 'Generar cobros' }}
        </button>
      </div>
    </div>

    <p v-if="charges.error.value && !data" class="border-t border-ink-900/8 py-3 text-xs text-danger-700">
      {{ charges.error.value }}
    </p>
    <EmptyState
      v-else-if="data && !data.charges.length"
      icon="wallet"
      title="Nadie ha sacado nada en esta quincena"
    />
    <template v-else-if="data">
      <ul aria-label="Aporte por persona">
        <li
          v-for="c in data.charges"
          :key="c.user.id"
          class="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border-t border-ink-900/8 py-2"
        >
          <Avatar :person="c.user" size="sm" class="size-[26px]! text-[10px]!" />
          <div class="min-w-0">
            <p class="truncate text-xs font-bold text-ink-800 lg:text-[13px]">{{ fullName(c.user) }}</p>
            <p class="text-[10px] text-ink-500 lg:text-[11px]">
              {{ formatNumber(c.units) }} und.
              <span v-if="c.unpricedUnits" class="text-accent-700">
                · {{ formatNumber(c.unpricedUnits) }} sin precio</span
              >
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="num text-xs text-ink-900 lg:text-[13px]">{{ formatMoney(c.amount) }}</span>
            <template v-if="generated">
              <span
                v-if="isPaid(c)"
                class="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-extrabold text-success-700"
                ><Icon name="check" :size="11" :stroke="2.6" /> Pagado</span
              >
              <span v-else class="flex flex-wrap items-center justify-end gap-1.5">
                <span
                  class="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-extrabold text-accent-700"
                  >Debe {{ formatMoney(c.pending) }}</span
                >
                <button
                  v-if="auth.isAdmin && c.id"
                  type="button"
                  class="min-h-11 px-1 text-[11px] font-extrabold text-brand-700 hover:text-ink-900"
                  :aria-label="`Registrar pago de ${fullName(c.user)}`"
                  @click="paying = c"
                >
                  Registrar pago
                </button>
              </span>
            </template>
          </div>
          <span class="col-span-3 h-1.5 overflow-hidden rounded-full bg-ink-900/7" aria-hidden="true">
            <span class="block h-full rounded-full bg-accent-500" :style="{ width: width(c) }" />
          </span>
        </li>
      </ul>
      <div
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl glass-inset px-2.5 py-2 text-[11px] lg:text-xs"
      >
        <span class="font-extrabold text-ink-900">
          Total <span class="num">{{ formatMoney(data.totals.amount) }}</span>
        </span>
        <span v-if="generated" class="text-ink-600">
          Pagado <strong class="num text-success-700">{{ formatMoney(data.totals.paid) }}</strong> · Pendiente
          <strong class="num text-accent-700">{{ formatMoney(data.totals.pending) }}</strong>
        </span>
        <span v-if="generated && data.charges[0]?.computedAt" class="text-[10px] text-ink-500">
          Calculado el {{ formatDateTime(data.charges[0].computedAt) }}
        </span>
      </div>
      <p
        v-if="data.totals.unpricedUnits"
        class="mt-2 flex items-start gap-2 rounded-xl bg-accent-50/90 px-2.5 py-2 text-[11px] text-accent-700 lg:text-xs"
        role="note"
      >
        <Icon name="alert" :size="14" class="mt-px shrink-0" />
        <span>
          {{ formatNumber(data.totals.unpricedUnits) }}
          {{ data.totals.unpricedUnits === 1 ? 'unidad' : 'unidades' }} de productos sin compras ni precio de
          referencia se valoraron en $0. Ponles precio en
          <RouterLink to="/admin/productos" class="font-extrabold underline">Productos</RouterLink>
          <template v-if="generated"> y recalcula los cobros</template>.
        </span>
      </p>
    </template>
    <p v-else class="border-t border-ink-900/8 py-5 text-center text-xs text-ink-500">Cargando…</p>

    <ChargePaymentDialog :charge="paying" @close="paying = null" @done="onPaid" />
  </section>
</template>
