<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import HungriestMonkey from '@/components/brand/HungriestMonkey.vue';
import PeriodRankingResult from '@/components/brand/PeriodRankingResult.vue';
import RankingPodium from '@/components/brand/RankingPodium.vue';
import BarChart from '@/components/charts/BarChart.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import type { PeriodSummary, RankingPeriod } from '@/domain/models';
import { errorMessage } from '@/services/errors';
import { useServices } from '@/services/container';
import { useToastStore } from '@/stores/toasts';
import { formatDateOnly, formatDateTime, formatNumber, fullName } from '@/utils/format';

/** 'quincena' = la quincena elegida arriba; el resto, ventanas de tiempo. */
type Tab = 'quincena' | Exclude<RankingPeriod, 'period'>;
const TABS: { value: Tab; label: string }[] = [
  { value: 'quincena', label: 'Quincena elegida' },
  { value: 'all', label: 'Desde siempre' },
  { value: 'month', label: 'Últimos 30 días' },
  { value: 'week', label: 'Últimos 7 días' },
];

const { movements, funding } = useServices();
const toasts = useToastStore();
const route = useRoute();

// --- Quincenas y su "más hambriento" ---
const periods = ref<PeriodSummary[]>([]);
const periodId = ref('');
const selected = computed(() => periods.value.find((p) => p.periodId === periodId.value) ?? null);
const status = useAsync((id: string) => funding.ranking(id));
const computing = ref(false);
const confirmRecompute = ref(false);

async function loadPeriods() {
  try {
    periods.value = await funding.list();
  } catch {
    periods.value = [];
  }
  const wanted = typeof route.query.quincena === 'string' ? route.query.quincena : '';
  if (wanted && periods.value.some((p) => p.periodId === wanted)) periodId.value = wanted;
  else if (!periodId.value) {
    // Por defecto la quincena abierta; si no hay, la más reciente.
    periodId.value = (periods.value.find((p) => p.status === 'OPEN') ?? periods.value[0])?.periodId ?? '';
  } else if (periodId.value) void status.run(periodId.value);
}

async function computeRanking() {
  if (!periodId.value) return;
  computing.value = true;
  try {
    const result = await funding.computeRanking(periodId.value);
    const names = result.hungriest.map((e) => fullName(e.user)).join(' y ');
    toasts.success(names ? `El más hambriento de la quincena: ${names}` : 'Nadie sacó nada en esta quincena');
    confirmRecompute.value = false;
    await status.run(periodId.value);
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    computing.value = false;
  }
}

// --- Ranking en vivo ---
const tab = ref<Tab>('quincena');
const live = useAsync(() =>
  tab.value === 'quincena'
    ? periodId.value
      ? movements.topWithdrawers({ periodId: periodId.value }, 20)
      : Promise.resolve([])
    : movements.topWithdrawers(tab.value, 20),
);

watch(periodId, (id) => {
  if (id) void status.run(id);
  if (tab.value === 'quincena') void live.run();
});
watch(tab, () => live.run());

useOnEnter(async () => {
  await loadPeriods();
  void live.run();
});

const rows = computed(() =>
  (live.data.value ?? []).map((row) => ({
    key: row.user.id,
    label: fullName(row.user),
    value: row.totalWithdrawn,
    valueLabel: `${formatNumber(row.totalWithdrawn)} und.`,
    detail: `${row.withdrawals} ${row.withdrawals === 1 ? 'retiro' : 'retiros'}`,
  })),
);
const tabLabel = computed(() =>
  tab.value === 'quincena'
    ? (selected.value?.name ?? 'quincena')
    : (TABS.find((t) => t.value === tab.value)?.label.toLowerCase() ?? ''),
);
</script>

<template>
  <AdminPage title="Ranking">
    <section>
      <div class="mb-6 flex items-center gap-4">
        <RankingPodium decorative class="hidden w-28 shrink-0 sm:block" />
        <PageHeader
          class="mb-0!"
          title="Ranking"
          subtitle="Quién saca más productos de la nevera. Cuentan solo los retiros, no las entradas ni las compras."
        />
      </div>

      <!-- El más hambriento de la quincena -->
      <div class="card mb-6 p-5 sm:p-6">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-[21px] font-black text-ink-900">El más hambriento de la quincena</h2>
            <p class="text-xs text-ink-500">
              Al terminar cada quincena, calcula su podio. El resultado queda guardado y se ve en la tablet.
            </p>
          </div>
          <select v-if="periods.length" v-model="periodId" class="input w-auto" aria-label="Quincena">
            <option v-for="p in periods" :key="p.periodId" :value="p.periodId">
              {{ p.name }}{{ p.status === 'OPEN' ? ' (abierta)' : '' }}
            </option>
          </select>
        </div>

        <EmptyState
          v-if="!periods.length"
          icon="wallet"
          title="Todavía no hay quincenas"
          message="Abre una quincena en Dinero → Quincenas."
        />
        <ErrorState
          v-else-if="status.error.value && !status.data.value"
          :message="status.error.value"
          @retry="status.run(periodId)"
        />

        <template v-else-if="status.data.value">
          <template v-if="status.data.value.ranking">
            <PeriodRankingResult :ranking="status.data.value.ranking" show-meta />
            <div class="mt-5 flex justify-end">
              <button type="button" class="btn-secondary" @click="confirmRecompute = true">
                <Icon name="refresh" :size="16" /> Volver a calcular
              </button>
            </div>
          </template>

          <div v-else class="flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:text-left">
            <HungriestMonkey decorative class="w-36 shrink-0 opacity-90" />
            <div class="min-w-0 flex-1">
              <template v-if="status.data.value.canCompute">
                <p class="font-extrabold text-ink-900">{{ selected?.name }} ya terminó.</p>
                <p class="mt-1 text-sm text-ink-600">
                  Calcula quién sacó más productos de la nevera entre el
                  {{ selected && formatDateOnly(selected.startDate) }} y el
                  {{ selected && formatDateOnly(selected.endDate) }}.
                </p>
                <button
                  type="button"
                  class="btn-primary mt-4 px-6 py-3 text-base"
                  :disabled="computing"
                  @click="computeRanking"
                >
                  <Icon name="trophy" :size="18" />
                  {{ computing ? 'Calculando…' : 'Calcular el más hambriento' }}
                </button>
              </template>
              <template v-else>
                <p class="font-extrabold text-ink-900">{{ selected?.name }} sigue en curso.</p>
                <p class="mt-1 text-sm text-ink-600">
                  Se podrá calcular desde el {{ formatDateTime(status.data.value.availableFrom) }}, o antes si
                  cierras la quincena. Mientras tanto, abajo ves el ranking en vivo.
                </p>
                <button type="button" class="btn-primary mt-4 px-6 py-3 text-base" disabled>
                  <Icon name="trophy" :size="18" /> Calcular el más hambriento
                </button>
              </template>
            </div>
          </div>
        </template>
        <p v-else class="py-8 text-center text-sm text-ink-500">Cargando…</p>
      </div>

      <!-- Ranking en vivo -->
      <div class="segmented mb-4 flex-wrap" role="tablist" aria-label="Periodo">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          role="tab"
          :aria-selected="tab === t.value"
          class="segmented-option min-h-10"
          @click="tab = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <ErrorState
        v-if="live.error.value && !live.data.value"
        :message="live.error.value"
        @retry="live.run()"
      />

      <div
        v-else
        class="grid grid-cols-1 gap-6 transition-opacity lg:grid-cols-[1.3fr_1fr]"
        :class="{ 'opacity-60': live.loading.value && live.data.value }"
      >
        <div class="card p-6">
          <h2 class="text-[19px] font-black text-ink-900">Unidades retiradas por persona</h2>
          <p class="mb-5 text-xs text-ink-500">En vivo · {{ tabLabel }} · el primer lugar va resaltado</p>
          <EmptyState
            v-if="live.data.value && !rows.length"
            icon="trophy"
            title="Sin retiros en este periodo"
          />
          <BarChart
            v-else
            :rows="rows"
            :caption="`Unidades retiradas por persona, ${tabLabel}`"
            label-header="Persona"
            value-header="Unidades retiradas"
            :emphasize-key="rows[0]?.key ?? null"
          />
        </div>

        <div class="card overflow-hidden">
          <table class="w-full text-[15px]">
            <thead class="border-b border-ink-200/70 glass-inset text-[13px] text-ink-500">
              <tr>
                <th scope="col" class="px-4 py-3 text-left font-extrabold">#</th>
                <th scope="col" class="px-4 py-3 text-left font-extrabold">Persona</th>
                <th scope="col" class="px-4 py-3 text-right font-extrabold">Unidades</th>
                <th scope="col" class="px-4 py-3 text-right font-extrabold">Retiros</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200/60">
              <tr v-for="(row, index) in live.data.value ?? []" :key="row.user.id">
                <td class="px-4 py-3 text-ink-500 tabular-nums">{{ index + 1 }}</td>
                <td class="px-4 py-3 font-extrabold text-ink-900">{{ fullName(row.user) }}</td>
                <td class="px-4 py-3 text-right font-extrabold tabular-nums">
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

      <ConfirmDialog
        :open="confirmRecompute"
        title="Volver a calcular"
        message="Se reemplaza el resultado guardado con los retiros que hay ahora en esta quincena (por ejemplo, si se registró uno tarde). ¿Continuar?"
        confirm-label="Volver a calcular"
        :loading="computing"
        @confirm="computeRanking"
        @close="confirmRecompute = false"
      />
    </section>
  </AdminPage>
</template>
