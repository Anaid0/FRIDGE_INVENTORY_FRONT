<script setup lang="ts">
import { onIonViewDidLeave } from '@ionic/vue';
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import HungriestCard from '@/components/brand/HungriestCard.vue';
import PeriodRankingResult from '@/components/brand/PeriodRankingResult.vue';
import Avatar from '@/components/ui/Avatar.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SkeletonRows from '@/components/ui/SkeletonRows.vue';
import SpinnerLabel from '@/components/ui/SpinnerLabel.vue';
import { useAsync } from '@/composables/useAsync';
import type { PeriodRanking, PeriodSummary, RankingPeriod, TopWithdrawer, UserRef } from '@/domain/models';
import { errorMessage } from '@/services/errors';
import { useServices } from '@/services/container';
import { useToastStore } from '@/stores/toasts';
import { formatDateOnly, formatNumber, fullName } from '@/utils/format';

/** 'quincena' = la quincena elegida arriba; el resto, ventanas de tiempo. */
type Tab = 'quincena' | Exclude<RankingPeriod, 'period'>;
const TABS: { value: Tab; label: string; long: string }[] = [
  { value: 'quincena', label: 'Quincena', long: 'quincena' },
  { value: 'month', label: '30 días', long: 'últimos 30 días' },
  { value: 'week', label: '7 días', long: 'últimos 7 días' },
  { value: 'all', label: 'Siempre', long: 'desde siempre' },
];
/** Cuántas personas trae el ranking en vivo. Si llegan menos, el resto de personas no sacó nada. */
const LIMIT = 20;
const REFRESH_MS = 60_000;

const { movements, funding, people } = useServices();
const toasts = useToastStore();
const route = useRoute();

// --- Quincenas y su "más hambriento" ---
const periods = ref<PeriodSummary[]>([]);
const periodsLoaded = ref(false);
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
  periodsLoaded.value = true;
  const wanted = typeof route.query.quincena === 'string' ? route.query.quincena : '';
  if (wanted && periods.value.some((p) => p.periodId === wanted)) periodId.value = wanted;
  else if (!periodId.value) {
    // Por defecto la quincena abierta; si no hay, la más reciente.
    periodId.value = (periods.value.find((p) => p.status === 'OPEN') ?? periods.value[0])?.periodId ?? '';
  } else if (periodId.value) {
    void status.run(periodId.value);
    void periodLive.run();
  }
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

/** "1 de noviembre": desde cuándo se puede calcular. */
function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(new Date(iso));
}

// --- Ranking en vivo: el de la quincena elegida (también alimenta "va ganando") y el de las ventanas ---
const tab = ref<Tab>('quincena');
const periodLive = useAsync(() =>
  periodId.value ? movements.topWithdrawers({ periodId: periodId.value }, LIMIT) : Promise.resolve([]),
);
const windowLive = useAsync(() =>
  tab.value === 'quincena' ? Promise.resolve([]) : movements.topWithdrawers(tab.value, LIMIT),
);
const live = computed(() => (tab.value === 'quincena' ? periodLive : windowLive));

/** Personas activas: las que no aparecen en el ranking se listan con "Sin retiros". */
const everyone = ref<UserRef[]>([]);
async function loadPeople() {
  try {
    everyone.value = await people.list({ isActive: true });
  } catch {
    everyone.value = [];
  }
}

watch(periodId, (id) => {
  if (!id) return;
  void status.run(id);
  void periodLive.run();
  void loadLastWinner();
});
watch(tab, (t) => (t === 'quincena' ? periodLive.run() : windowLive.run()));

// "Se actualiza cada minuto": solo mientras la página está a la vista.
let timer: ReturnType<typeof setInterval> | undefined;
function refreshLive() {
  void periodLive.run();
  if (tab.value !== 'quincena') void windowLive.run();
}
useOnEnter(async () => {
  void loadPeople();
  await loadPeriods();
  if (tab.value !== 'quincena') void windowLive.run();
  clearInterval(timer);
  timer = setInterval(refreshLive, REFRESH_MS);
});
onIonViewDidLeave(() => clearInterval(timer));
onBeforeUnmount(() => clearInterval(timer));

/** Puesto con empates (1, 2, 2, 4…), la barra relativa al primero y "Sin retiros" para el resto. */
const rows = computed(() => {
  const data: TopWithdrawer[] = live.value.data.value ?? [];
  const max = Math.max(1, ...data.map((r) => r.totalWithdrawn));
  let position = 0;
  const ranked = data.map((row, index) => {
    if (index === 0 || row.totalWithdrawn !== data[index - 1]!.totalWithdrawn) position = index + 1;
    return {
      user: row.user,
      position,
      units: row.totalWithdrawn,
      withdrawals: row.withdrawals,
      width: `${Math.max((row.totalWithdrawn / max) * 100, 3)}%`,
    };
  });
  if (data.length >= LIMIT) return { ranked, idle: [] as UserRef[] };
  const seen = new Set(data.map((r) => r.user.id));
  return { ranked, idle: everyone.value.filter((p) => !seen.has(p.id)) };
});
const tabLabel = computed(() =>
  tab.value === 'quincena'
    ? (selected.value?.name ?? 'quincena')
    : (TABS.find((t) => t.value === tab.value)?.long ?? ''),
);

/** "Va ganando": los primeros de la quincena elegida (varios si empatan). */
const periodLeaders = computed(() => {
  const data = periodLive.data.value ?? [];
  const top = data[0]?.totalWithdrawn ?? 0;
  return top > 0 ? data.filter((r) => r.totalWithdrawn === top) : [];
});

// --- La quincena anterior a la elegida: quién fue el más hambriento ---
const lastWinner = ref<{ period: PeriodSummary; ranking: PeriodRanking } | null>(null);
async function loadLastWinner() {
  const index = periods.value.findIndex((p) => p.periodId === periodId.value);
  const previous = index >= 0 ? periods.value[index + 1] : undefined;
  lastWinner.value = null;
  if (!previous) return;
  try {
    const result = await funding.ranking(previous.periodId);
    if (result.ranking?.hungriest.length && previous.periodId === periods.value[index + 1]?.periodId)
      lastWinner.value = { period: previous, ranking: result.ranking };
  } catch {
    // Es un dato de contexto: si falla, simplemente no se muestra.
  }
}
const lastWinnerNames = computed(() =>
  (lastWinner.value?.ranking.hungriest ?? []).map((e) => fullName(e.user)).join(' y '),
);
</script>

<template>
  <AdminPage title="Ranking">
    <section>
      <PageHeader title="Ranking" back="/admin/mas">
        <template #actions>
          <select
            v-if="periods.length"
            v-model="periodId"
            class="max-w-[10.5rem] min-h-10 truncate rounded-xl border border-white/90 bg-white/60 py-1.5 pr-2 pl-2.5 text-xs font-bold text-ink-700 backdrop-blur-md sm:max-w-[16rem]"
            aria-label="Quincena"
          >
            <option v-for="p in periods" :key="p.periodId" :value="p.periodId">
              {{ p.name }}{{ p.status === 'OPEN' ? ' (abierta)' : '' }}
            </option>
          </select>
        </template>
      </PageHeader>

      <div
        class="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-5"
      >
        <!-- Columna 1: el más hambriento de la quincena elegida -->
        <div class="flex flex-col gap-2.5" aria-label="El más hambriento de la quincena" role="region">
          <EmptyState
            v-if="periodsLoaded && !periods.length"
            card
            title="Todavía no hay quincenas"
            message="Abre una quincena en la pestaña Quincena para ver quién va ganando."
          />
          <ErrorState
            v-else-if="status.error.value && !status.data.value"
            :message="status.error.value"
            @retry="status.run(periodId)"
          />

          <template v-else-if="status.data.value">
            <!-- Ya calculado: resultado guardado + podio -->
            <PeriodRankingResult
              v-if="status.data.value.ranking"
              :ranking="status.data.value.ranking"
              show-meta
            >
              <template #actions>
                <button
                  type="button"
                  class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 text-xs font-extrabold text-white hover:bg-white/25"
                  @click="confirmRecompute = true"
                >
                  <Icon name="refresh" :size="14" :stroke="2.2" /> Volver a calcular
                </button>
              </template>
            </PeriodRankingResult>

            <!-- Sin calcular: quién va ganando y el botón para calcular -->
            <HungriestCard
              v-else
              size="lg"
              :title="
                status.data.value.canCompute ? 'Ganó el más hambriento' : 'Va ganando el más hambriento'
              "
              :leaders="periodLeaders"
              :units-label="
                status.data.value.canCompute ? `en ${selected?.name ?? 'la quincena'}` : 'esta quincena'
              "
              empty-label="Nadie ha sacado nada aún"
              :caption="`${selected?.name ?? 'La quincena'} ${status.data.value.canCompute ? 'ya terminó.' : 'sigue en curso.'}`"
            >
              <button
                type="button"
                class="min-h-10 rounded-xl px-3.5 text-xs font-extrabold transition-colors"
                :class="
                  status.data.value.canCompute
                    ? 'bg-accent-500 text-ink-900 hover:bg-accent-600'
                    : 'cursor-default bg-white/14 text-[#CFE3F1]'
                "
                :disabled="!status.data.value.canCompute || computing"
                :aria-busy="computing"
                aria-describedby="rk-habilita"
                @click="computeRanking"
              >
                <SpinnerLabel
                  :busy="computing"
                  label="Calcular el más hambriento"
                  busy-label="Calculando…"
                  :size="14"
                />
              </button>
              <p id="rk-habilita" class="min-w-0 flex-1 text-xs leading-snug text-[#CFE3F1]">
                <template v-if="status.data.value.canCompute">
                  Retiros del {{ selected && formatDateOnly(selected.startDate) }} al
                  {{ selected && formatDateOnly(selected.endDate) }}
                </template>
                <template v-else>Se habilita el {{ dayMonth(status.data.value.availableFrom) }}</template>
              </p>
            </HungriestCard>
          </template>
          <SkeletonRows v-else-if="periods.length || !periodsLoaded" :rows="2" label="Cargando la quincena" />

          <!-- Quincena anterior -->
          <div
            v-if="lastWinner"
            class="flex items-center gap-2.5 rounded-[18px] border border-white/85 bg-white/50 py-1.5 pr-1.5 pl-3 backdrop-blur-md"
          >
            <span class="text-accent-700"><Icon name="trophy" :size="20" :stroke="2.2" /></span>
            <p class="min-w-0 flex-1 text-[13px] text-ink-700">
              {{ lastWinner.period.name }}: <strong class="text-ink-900">{{ lastWinnerNames }}</strong>
              {{
                lastWinner.ranking.hungriest.length > 1
                  ? 'fueron los más hambrientos'
                  : 'fue el más hambriento'
              }}
            </p>
            <button
              type="button"
              class="min-h-11 shrink-0 rounded-xl px-3 text-[13px] font-extrabold text-brand-700 hover:bg-white/60"
              :aria-label="`Ver ${lastWinner.period.name}`"
              @click="periodId = lastWinner.period.periodId"
            >
              Ver
            </button>
          </div>
        </div>

        <!-- Columna 2: ranking en vivo -->
        <div class="flex flex-col gap-2.5">
          <div class="segmented grid w-full grid-cols-4" role="group" aria-label="Periodo">
            <button
              v-for="t in TABS"
              :key="t.value"
              type="button"
              :aria-pressed="tab === t.value"
              class="segmented-option min-h-9 px-1 text-xs"
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
          <SkeletonRows v-else-if="!live.data.value" :rows="4" round label="Cargando el ranking" />
          <EmptyState
            v-else-if="!rows.ranked.length && !rows.idle.length"
            card
            title="Sin retiros"
            :message="`Nadie ha sacado nada de la nevera (${tabLabel}).`"
          />
          <section
            v-else
            class="card flex flex-col px-3 py-1.5 transition-opacity"
            :class="{ 'opacity-60': live.loading.value }"
            aria-label="Quién retira más"
          >
            <ol
              class="m-0 list-none divide-y divide-ink-900/8 p-0"
              :aria-label="`Unidades retiradas por persona, ${tabLabel}`"
            >
              <li
                v-for="(row, index) in rows.ranked"
                :key="row.user.id"
                class="flex min-h-[52px] items-center gap-2.5 py-1.5"
                :aria-label="`${fullName(row.user)}: ${formatNumber(row.units)} und., ${row.withdrawals} ${row.withdrawals === 1 ? 'retiro' : 'retiros'}`"
              >
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-lg font-mono text-xs font-extrabold text-ink-900"
                  :class="row.position === 1 ? 'bg-[#FFC93C]' : 'bg-[#CFE3F1]'"
                  aria-hidden="true"
                  >{{ row.position }}</span
                >
                <Avatar :person="row.user" size="xs" :solid="index === 0" />
                <span class="flex min-w-0 flex-1 flex-col gap-[3px]" aria-hidden="true">
                  <span class="truncate font-extrabold text-ink-900">{{ fullName(row.user) }}</span>
                  <span class="h-[5px] rounded-full bg-ink-900/8">
                    <span
                      class="block h-full rounded-full"
                      :class="row.position === 1 ? 'bg-brand-600' : 'bg-brand-300'"
                      :style="{ width: row.width }"
                    />
                  </span>
                </span>
                <span class="flex shrink-0 flex-col items-end" aria-hidden="true">
                  <span class="num min-w-7 text-right text-[15px] text-ink-900">{{
                    formatNumber(row.units)
                  }}</span>
                  <span class="text-[10px] text-ink-500">
                    {{ row.withdrawals }} {{ row.withdrawals === 1 ? 'retiro' : 'retiros' }}
                  </span>
                </span>
              </li>
              <li
                v-for="person in rows.idle"
                :key="person.id"
                class="flex min-h-12 items-center gap-2.5 py-1.5"
                :aria-label="`${fullName(person)}: sin retiros`"
              >
                <span class="w-6 shrink-0 text-center font-extrabold text-ink-500" aria-hidden="true">–</span>
                <Avatar :person="person" size="xs" />
                <span class="min-w-0 flex-1 truncate font-bold text-ink-700" aria-hidden="true">{{
                  fullName(person)
                }}</span>
                <span class="shrink-0 text-xs text-ink-500" aria-hidden="true">Sin retiros</span>
              </li>
            </ol>
          </section>
          <p class="text-center text-xs text-ink-500">Solo cuentan los retiros · se actualiza cada minuto</p>
        </div>
      </div>

      <ConfirmDialog
        :open="confirmRecompute"
        title="¿Volver a calcular?"
        message="Se reemplaza el resultado guardado con los retiros que hay ahora en esta quincena (por ejemplo, si se registró uno tarde)."
        confirm-label="Volver a calcular"
        loading-label="Calculando…"
        :loading="computing"
        @confirm="computeRanking"
        @close="confirmRecompute = false"
      />
    </section>
  </AdminPage>
</template>
