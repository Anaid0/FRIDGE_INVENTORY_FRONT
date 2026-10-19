<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, ref, watch } from 'vue';
import BarChart from '@/components/charts/BarChart.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { RankingPeriod } from '@/domain/models';
import { useServices } from '@/services/container';
import { formatNumber, fullName } from '@/utils/format';

const PERIODS: { value: RankingPeriod; label: string }[] = [
  { value: 'all', label: 'Desde siempre' },
  { value: 'month', label: 'Últimos 30 días' },
  { value: 'week', label: 'Últimos 7 días' },
];

const { movements } = useServices();
const period = ref<RankingPeriod>('all');
const { data, error, loading, run } = useAsync(() => movements.topWithdrawers(period.value, 20));
useOnEnter(run);
watch(period, run);

const rows = computed(() =>
  (data.value ?? []).map((row) => ({
    key: row.user.id,
    label: fullName(row.user),
    value: row.totalWithdrawn,
    valueLabel: `${formatNumber(row.totalWithdrawn)} und.`,
    detail: `${row.withdrawals} ${row.withdrawals === 1 ? 'retiro' : 'retiros'}`,
  })),
);
const periodLabel = computed(() => PERIODS.find((p) => p.value === period.value)?.label.toLowerCase() ?? '');
</script>

<template>
  <AdminPage title="Ranking">
    <section>
      <PageHeader
        title="Ranking"
        subtitle="Quién saca más productos de la nevera. Cuentan solo los retiros, no las entradas ni las compras."
      />

      <div
        class="mb-4 inline-flex rounded-lg border border-ink-200 bg-white p-1"
        role="tablist"
        aria-label="Periodo"
      >
        <button
          v-for="p in PERIODS"
          :key="p.value"
          type="button"
          role="tab"
          :aria-selected="period === p.value"
          class="rounded-md px-3 py-1.5 text-sm font-medium"
          :class="period === p.value ? 'bg-brand-700 text-white' : 'text-ink-600 hover:bg-ink-100'"
          @click="period = p.value"
        >
          {{ p.label }}
        </button>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else
        class="grid grid-cols-1 gap-6 transition-opacity lg:grid-cols-[1.3fr_1fr]"
        :class="{ 'opacity-60': loading && data }"
      >
        <div class="card p-6">
          <h2 class="font-semibold text-ink-900">Unidades retiradas por persona</h2>
          <p class="mb-5 text-xs text-ink-500">{{ periodLabel }} · el primer lugar va resaltado</p>
          <EmptyState v-if="data && !rows.length" icon="trophy" title="Sin retiros en este periodo" />
          <BarChart
            v-else
            :rows="rows"
            :caption="`Unidades retiradas por persona, ${periodLabel}`"
            label-header="Persona"
            value-header="Unidades retiradas"
            :emphasize-key="rows[0]?.key ?? null"
          />
        </div>

        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-ink-100 bg-ink-50 text-xs text-ink-500">
              <tr>
                <th scope="col" class="px-4 py-3 text-left font-medium">#</th>
                <th scope="col" class="px-4 py-3 text-left font-medium">Persona</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Unidades</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Retiros</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="(row, index) in data ?? []" :key="row.user.id">
                <td class="px-4 py-3 text-ink-500 tabular-nums">{{ index + 1 }}</td>
                <td class="px-4 py-3 font-medium text-ink-900">{{ fullName(row.user) }}</td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums">
                  {{ formatNumber(row.totalWithdrawn) }}
                </td>
                <td class="px-4 py-3 text-right text-ink-600 tabular-nums">
                  {{ formatNumber(row.withdrawals) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AdminPage>
</template>
