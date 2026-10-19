<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ConsumptionCharge } from '@/domain/models';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { formatMoney, fullName, toCents } from '@/utils/format';
import ChargePaymentDialog from './ChargePaymentDialog.vue';
import Avatar from './ui/Avatar.vue';

/**
 * En la quincena abierta: lo que la gente todavía debe por lo que consumió en quincenas anteriores.
 * Cada pago entra como aporte a esta quincena (el fondo del siguiente mercado).
 */
const props = defineProps<{ refreshKey?: number }>();
const emit = defineEmits<{ changed: [] }>();

const { funding } = useServices();
const auth = useAuthStore();

const pending = useAsync(() => funding.pendingCharges());
watch(
  () => props.refreshKey,
  () => pending.run(),
  { immediate: true },
);

const total = computed(
  () => (pending.data.value ?? []).reduce((sum, c) => sum + toCents(c.pending), 0) / 100,
);

const paying = ref<ConsumptionCharge | null>(null);
async function onPaid() {
  paying.value = null;
  await pending.run();
  emit('changed');
}
</script>

<template>
  <section
    v-if="pending.data.value?.length"
    class="card overflow-hidden ring-1 ring-accent-200/70"
    aria-labelledby="pending-charges-title"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 bg-accent-50/70 px-[22px] py-4"
    >
      <div>
        <h2 id="pending-charges-title" class="text-[19px] font-black text-ink-900">Por cobrar</h2>
        <p class="text-[13px] text-ink-600">
          Lo que cada uno consumió en quincenas anteriores. Al pagar, entra como aporte a esta quincena.
        </p>
      </div>
      <span class="font-black text-accent-700 tabular-nums">{{ formatMoney(total) }}</span>
    </div>
    <ul class="divide-y divide-ink-200/60">
      <li
        v-for="c in pending.data.value"
        :key="c.id ?? c.user.id"
        class="flex items-center gap-3 px-[22px] py-2.5"
      >
        <Avatar :person="c.user" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold text-ink-800">{{ fullName(c.user) }}</p>
          <p class="text-xs text-ink-500">
            {{ c.period.name }} · consumió {{ formatMoney(c.amount) }}
            <span v-if="toCents(c.paid) > 0"> · pagó {{ formatMoney(c.paid) }}</span>
          </p>
        </div>
        <span class="shrink-0 font-extrabold text-accent-700 tabular-nums">{{ formatMoney(c.pending) }}</span>
        <button
          v-if="auth.isAdmin"
          type="button"
          class="btn-secondary min-h-11 shrink-0"
          :aria-label="`Registrar pago de ${fullName(c.user)}`"
          @click="paying = c"
        >
          Registrar pago
        </button>
      </li>
    </ul>
    <ChargePaymentDialog :charge="paying" @close="paying = null" @done="onPaid" />
  </section>
</template>
