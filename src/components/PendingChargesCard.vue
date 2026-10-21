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
    class="card flex flex-col px-3 pt-1 pb-1.5 ring-1 ring-accent-200/70 lg:px-4"
    aria-labelledby="pending-charges-title"
  >
    <div class="flex items-start justify-between gap-2 py-2.5">
      <div class="min-w-0">
        <h2 id="pending-charges-title" class="section-title">Por cobrar</h2>
        <p class="mt-0.5 text-[11px] text-ink-500 lg:text-xs">
          Lo que cada uno consumió en quincenas anteriores. Al pagar, entra como aporte a esta quincena.
        </p>
      </div>
      <span class="num shrink-0 text-[15px] text-accent-700">{{ formatMoney(total) }}</span>
    </div>
    <ul>
      <li
        v-for="c in pending.data.value"
        :key="c.id ?? c.user.id"
        class="flex min-h-11 items-center gap-2 border-t border-ink-900/8 py-1.5"
      >
        <Avatar :person="c.user" size="sm" class="size-[26px]! text-[10px]!" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-bold text-ink-800 lg:text-[13px]">{{ fullName(c.user) }}</p>
          <p class="truncate text-[10px] text-ink-500 lg:text-[11px]">
            {{ c.period.name }} · consumió {{ formatMoney(c.amount) }}
            <span v-if="toCents(c.paid) > 0"> · pagó {{ formatMoney(c.paid) }}</span>
          </p>
        </div>
        <span class="num shrink-0 text-xs text-accent-700 lg:text-[13px]">{{ formatMoney(c.pending) }}</span>
        <button
          v-if="auth.isAdmin"
          type="button"
          class="inline-flex min-h-11 shrink-0 items-center rounded-[10px] border border-ink-300 bg-white/80 px-2.5 text-[11px] font-extrabold text-brand-700 hover:bg-white"
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
