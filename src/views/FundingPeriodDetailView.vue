<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BarChart from '@/components/charts/BarChart.vue';
import ContributionDialog from '@/components/ContributionDialog.vue';
import PeriodBalanceCard from '@/components/PeriodBalanceCard.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { formatDateTime, formatMoney, fullName } from '@/utils/format';

const props = defineProps<{ id: string }>();
const { funding } = useServices();
const auth = useAuthStore();
const toasts = useToastStore();

const { data, error, loading, run } = useAsync(() => funding.detail(props.id));
useOnEnter(run);
watch(() => props.id, run);

const isOpen = computed(() => data.value?.period.status === 'OPEN');
const contributorRows = computed(() =>
  (data.value?.contributorTotals ?? []).map((row) => ({
    key: row.user.id,
    label: fullName(row.user),
    value: Number(row.total),
    valueLabel: formatMoney(row.total),
    detail: `${row.contributions} ${row.contributions === 1 ? 'aporte' : 'aportes'}`,
  })),
);

const contributionOpen = ref(false);
const confirmClose = ref(false);
const closing = ref(false);

async function onContribution() {
  contributionOpen.value = false;
  await run();
}

async function closePeriod() {
  closing.value = true;
  try {
    await funding.close(props.id);
    toasts.success('Quincena cerrada. Ya no acepta aportes ni compras.');
    confirmClose.value = false;
    await run();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    closing.value = false;
  }
}
</script>

<template>
  <AdminPage :title="data?.period.name ?? 'Quincena'">
    <section>
      <PageHeader :title="data?.period.name ?? 'Quincena'" :subtitle="data?.period.notes ?? undefined">
        <template #eyebrow>
          <RouterLink
            to="/admin/quincenas"
            class="mb-1 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
          >
            <Icon name="chevronLeft" :size="14" /> Quincenas
          </RouterLink>
        </template>
        <template v-if="auth.isAdmin && isOpen" #actions>
          <button type="button" class="btn-secondary" @click="contributionOpen = true">
            <Icon name="wallet" :size="16" /> Registrar aporte
          </button>
          <RouterLink :to="{ path: '/admin/compras/nueva', query: { periodo: id } }" class="btn-primary">
            <Icon name="cart" :size="16" /> Registrar compra
          </RouterLink>
          <button type="button" class="btn-secondary" @click="confirmClose = true">
            <Icon name="lock" :size="16" /> Cerrar
          </button>
        </template>
      </PageHeader>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else-if="data" class="space-y-6 transition-opacity" :class="{ 'opacity-60': loading }">
        <PeriodBalanceCard :summary="data.summary" />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="card p-5">
            <h2 class="font-semibold text-ink-900">Aportes por persona</h2>
            <p class="mb-4 text-xs text-ink-500">Total que puso cada uno en esta quincena</p>
            <BarChart
              v-if="contributorRows.length"
              :rows="contributorRows"
              caption="Total aportado por persona"
              label-header="Persona"
              value-header="Total aportado"
            />
            <EmptyState v-else icon="wallet" title="Aún no hay aportes" />
          </div>

          <div class="card overflow-hidden">
            <h2 class="border-b border-ink-100 px-5 py-4 font-semibold text-ink-900">Detalle de aportes</h2>
            <ul v-if="data.contributions.length" class="max-h-80 divide-y divide-ink-100 overflow-y-auto">
              <li
                v-for="c in data.contributions"
                :key="c.id"
                class="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p class="font-medium text-ink-900">{{ fullName(c.user) }}</p>
                  <p class="text-xs text-ink-500">
                    {{ formatDateTime(c.paidAt) }}<span v-if="c.note"> · {{ c.note }}</span>
                  </p>
                </div>
                <span class="font-semibold tabular-nums">{{ formatMoney(c.amount) }}</span>
              </li>
            </ul>
            <p v-else class="px-5 py-6 text-sm text-ink-500">Sin aportes registrados.</p>
          </div>
        </div>

        <div class="card overflow-hidden">
          <h2 class="border-b border-ink-100 px-5 py-4 font-semibold text-ink-900">Compras de la quincena</h2>
          <EmptyState v-if="!data.purchases.length" icon="cart" title="Aún no hay compras" />
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-ink-50 text-xs text-ink-500">
                <tr>
                  <th scope="col" class="px-5 py-3 text-left font-medium">Fecha</th>
                  <th scope="col" class="px-5 py-3 text-left font-medium">Tienda</th>
                  <th scope="col" class="px-5 py-3 text-left font-medium">Compró</th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">Productos</th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-100">
                <tr
                  v-for="p in data.purchases"
                  :key="p.id"
                  class="hover:bg-ink-50"
                  :class="{ 'text-ink-400': p.voidedAt }"
                >
                  <td class="px-5 py-3 whitespace-nowrap">
                    <RouterLink :to="`/admin/compras/${p.id}`" class="font-medium hover:text-brand-700">
                      {{ formatDateTime(p.purchasedAt) }}
                    </RouterLink>
                  </td>
                  <td class="px-5 py-3">
                    {{ p.store ?? '—' }} <Badge v-if="p.voidedAt" tone="neutral">Anulada</Badge>
                  </td>
                  <td class="px-5 py-3">{{ fullName(p.buyer) }}</td>
                  <td class="px-5 py-3 text-right tabular-nums">{{ p.itemsCount }}</td>
                  <td
                    class="px-5 py-3 text-right font-semibold tabular-nums"
                    :class="{ 'line-through': p.voidedAt }"
                  >
                    {{ formatMoney(p.total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ContributionDialog
        :open="contributionOpen"
        :period-id="id"
        @close="contributionOpen = false"
        @done="onContribution"
      />
      <ConfirmDialog
        :open="confirmClose"
        title="Cerrar quincena"
        message="Después de cerrarla no se podrán registrar aportes, compras ni anulaciones en esta quincena. ¿Continuar?"
        confirm-label="Cerrar quincena"
        :loading="closing"
        @confirm="closePeriod"
        @close="confirmClose = false"
      />
    </section>
  </AdminPage>
</template>
