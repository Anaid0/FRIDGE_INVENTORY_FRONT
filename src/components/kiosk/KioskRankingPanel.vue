<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import HungriestMonkey from '@/components/brand/HungriestMonkey.vue';
import LoadingFridge from '@/components/brand/LoadingFridge.vue';
import PeriodPodium from '@/components/brand/PeriodPodium.vue';
import Avatar from '@/components/ui/Avatar.vue';
import Icon from '@/components/ui/Icon.vue';
import { useAsync } from '@/composables/useAsync';
import type { RankingPeriodOption, TopWithdrawer, UserRef } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useKioskStore } from '@/stores/kiosk';
import { formatDateOnly, formatDateTime, formatNumber, fullName } from '@/utils/format';
import { joinList } from './kioskText';

const REFRESH_MS = 60_000;
const LIMIT = 50;

const { kiosk } = useServices();
const store = useKioskStore();

// --- Quincenas y "el más hambriento" ---
const periods = ref<RankingPeriodOption[]>([]);
const periodId = ref('');
const selected = computed(() => periods.value.find((p) => p.id === periodId.value) ?? null);
const status = useAsync((id: string) => kiosk.periodRanking(id));
const computing = ref(false);
const computeError = ref<string | null>(null);

/** Por defecto: una quincena que ya terminó y falta calcular; si no, la última calculada; si no, la actual. */
function defaultPeriod(list: RankingPeriodOption[]): string {
  return (list.find((p) => p.finished && !p.computed) ?? list.find((p) => p.computed) ?? list[0])?.id ?? '';
}

const loadingPeriods = ref(true);
async function loadPeriods() {
  try {
    periods.value = await kiosk.rankingPeriods();
  } catch {
    periods.value = [];
  } finally {
    loadingPeriods.value = false;
  }
  if (!periods.value.some((p) => p.id === periodId.value)) periodId.value = defaultPeriod(periods.value);
  if (!periods.value.length && tab.value === 'quincena') tab.value = 'month';
}

async function computeRanking() {
  if (!periodId.value) return;
  computing.value = true;
  computeError.value = null;
  try {
    await kiosk.computeRanking(periodId.value);
  } catch (e) {
    // P. ej. otra tablet lo calculó un momento antes: se muestra lo que quedó guardado.
    computeError.value = errorMessage(e);
  } finally {
    computing.value = false;
  }
  await Promise.all([status.run(periodId.value), loadPeriods()]);
}

// --- Ranking en vivo ---
type Tab = 'quincena' | 'month' | 'week' | 'all';
const tab = ref<Tab>('quincena');
const TABS: { value: Tab; label: string }[] = [
  { value: 'quincena', label: 'Esta quincena' },
  { value: 'month', label: '30 días' },
  { value: 'week', label: '7 días' },
  { value: 'all', label: 'Siempre' },
];
/** La quincena elegida (o la abierta): alimenta la columna "Va ganando" y la pestaña "Esta quincena". */
const periodLive = useAsync((id: string) => kiosk.topWithdrawers({ periodId: id }, LIMIT));
const windowLive = useAsync((scope: Exclude<Tab, 'quincena'>) => kiosk.topWithdrawers(scope, LIMIT));
const live = computed(() => (tab.value === 'quincena' ? periodLive : windowLive));

function reloadLive() {
  if (periodId.value) void periodLive.run(periodId.value);
  if (tab.value !== 'quincena') void windowLive.run(tab.value);
}

watch(periodId, (id) => {
  computeError.value = null;
  if (!id) return;
  void status.run(id);
  void periodLive.run(id);
});
watch(tab, (value) => {
  if (value !== 'quincena') void windowLive.run(value);
});

void loadPeriods();

// Al día mientras se mira el ranking.
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(reloadLive, REFRESH_MS)));
onBeforeUnmount(() => clearInterval(timer));

const isCurrent = computed(
  () => !!selected.value && selected.value.status === 'OPEN' && !selected.value.finished,
);
/** Sin quincenas no hay pestaña "Esta quincena"; si la elegida ya terminó, se llama solo "Quincena". */
const visibleTabs = computed(() =>
  TABS.filter((t) => t.value !== 'quincena' || periods.value.length).map((t) => ({
    ...t,
    label: t.value === 'quincena' && selected.value && !isCurrent.value ? 'Quincena' : t.label,
  })),
);

/** Quien va ganando la quincena (varias personas si empatan). */
const leaders = computed<TopWithdrawer[]>(() => {
  const list = (periodLive.data.value ?? []).filter((row) => row.totalWithdrawn > 0);
  const top = list[0]?.totalWithdrawn ?? 0;
  return list.filter((row) => row.totalWithdrawn === top);
});
const leaderNames = computed(() => joinList(leaders.value.map((l) => fullName(l.user))));

const availableFrom = computed(() => {
  const from = status.data.value?.availableFrom;
  return from ? new Date(from).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : null;
});

interface Row {
  user: UserRef;
  units: number;
  /** Puesto (los empates comparten número); null = sin retiros. */
  rank: number | null;
}

/** Quienes retiraron, y al final las personas activas que no han sacado nada ("Sin retiros"). */
const rows = computed<Row[]>(() => {
  const data = (live.value.data.value ?? []).filter((r) => r.totalWithdrawn > 0);
  const ranked: Row[] = data.map((r) => ({
    user: r.user,
    units: r.totalWithdrawn,
    rank: 1 + data.filter((other) => other.totalWithdrawn > r.totalWithdrawn).length,
  }));
  if (!live.value.data.value) return ranked;
  const seen = new Set(ranked.map((r) => r.user.id));
  const idle = store.people
    .filter((p) => !seen.has(p.id))
    .map((p) => ({ user: p, units: 0, rank: null }) as Row);
  return [...ranked, ...idle];
});
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.units)));

const footer = computed(() => {
  const label =
    tab.value === 'quincena'
      ? (selected.value?.name ?? 'Esta quincena')
      : tab.value === 'month'
        ? 'Últimos 30 días'
        : tab.value === 'week'
          ? 'Últimos 7 días'
          : 'Desde siempre';
  return `${label} · se actualiza cada minuto`;
});
</script>

<template>
  <div class="ranking grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
    <!-- El más hambriento de la quincena -->
    <section
      class="glass flex flex-col items-center rounded-3xl border-accent-200/80! bg-accent-50/75! px-5 py-6 text-center sm:px-7"
      aria-labelledby="kiosk-hungriest-title"
    >
      <h2 id="kiosk-hungriest-title" class="eyebrow text-sm! text-accent-700">
        El más hambriento de la quincena
      </h2>
      <select
        v-if="periods.length > 1"
        v-model="periodId"
        class="input mt-4 w-full py-3 text-base"
        aria-label="Quincena"
      >
        <option v-for="p in periods" :key="p.id" :value="p.id">
          {{ p.name }} · {{ formatDateOnly(p.startDate) }} – {{ formatDateOnly(p.endDate) }}
        </option>
      </select>

      <LoadingFridge v-if="loadingPeriods" class="my-auto py-4" subtitle="Buscando las quincenas" />
      <p v-else-if="!periods.length" class="my-auto py-6 text-ink-500">
        Todavía no hay quincenas. El administrador las abre en Dinero → Quincenas.
      </p>
      <p v-else-if="status.error.value && !status.data.value" class="my-auto text-danger-700">
        {{ status.error.value }}
      </p>

      <template v-else-if="status.data.value && status.data.value.periodId === periodId">
        <!-- Ya calculado: el ganador y el podio -->
        <div v-if="status.data.value.ranking" class="flex w-full flex-1 flex-col items-center">
          <template v-if="status.data.value.ranking.hungriest.length">
            <HungriestMonkey decorative class="monkey-sm mt-3 w-36" />
            <p class="mt-2 text-ink-700">
              {{ status.data.value.ranking.hungriest.length > 1 ? 'Empataron' : 'Ganó' }}
            </p>
            <p class="text-3xl leading-tight font-black text-ink-900">
              {{ joinList(status.data.value.ranking.hungriest.map((h) => fullName(h.user))) }}
            </p>
            <p class="mt-1 text-ink-700">
              <strong class="font-black text-accent-700"
                >{{ formatNumber(status.data.value.ranking.hungriest[0]!.totalWithdrawn) }} unidades</strong
              >
              en {{ status.data.value.ranking.period.name }}
            </p>
          </template>
          <p v-else class="my-6 text-xl font-black text-ink-700">Nadie sacó nada en esta quincena.</p>
          <PeriodPodium
            v-if="status.data.value.ranking.podium.length"
            :podium="status.data.value.ranking.podium"
            class="mt-4 w-full max-w-[19rem]"
          />
          <p class="mt-auto pt-4 text-xs text-ink-500">
            Calculado el {{ formatDateTime(status.data.value.ranking.computedAt) }}
            {{
              status.data.value.ranking.computedBy.kind === 'kiosk'
                ? `desde la tablet «${status.data.value.ranking.computedBy.name}»`
                : `por ${status.data.value.ranking.computedBy.name}`
            }}
          </p>
        </div>

        <!-- Terminó y falta calcular: el botón -->
        <div v-else-if="status.data.value.canCompute" class="flex w-full flex-1 flex-col items-center">
          <HungriestMonkey decorative class="monkey mt-4 w-56" />
          <p class="mt-4 text-3xl leading-tight font-black text-ink-900">¡{{ selected?.name }} terminó!</p>
          <p class="mt-2 text-lg text-ink-700">Descubre quién sacó más de la nevera en esta quincena.</p>
          <div class="mt-auto w-full pt-6">
            <button
              type="button"
              class="btn-accent min-h-[60px] w-full rounded-[18px]! text-lg! font-black!"
              :disabled="computing"
              @click="computeRanking"
            >
              <Icon name="trophy" :size="22" :stroke="2.25" />
              {{ computing ? 'Calculando…' : 'Calcular el más hambriento' }}
            </button>
            <p v-if="computeError" class="mt-3 text-danger-700" role="alert">{{ computeError }}</p>
          </div>
        </div>

        <!-- En curso: quién va ganando -->
        <div v-else class="flex w-full flex-1 flex-col items-center">
          <HungriestMonkey decorative class="monkey mt-4 w-56" />
          <template v-if="leaders.length">
            <p class="mt-4 text-ink-700">Va ganando</p>
            <p class="text-3xl leading-tight font-black text-ink-900 sm:text-4xl">{{ leaderNames }}</p>
            <p class="mt-1 text-lg text-ink-700">
              <strong class="font-black text-accent-700"
                >{{ formatNumber(leaders[0]!.totalWithdrawn) }}
                {{ leaders[0]!.totalWithdrawn === 1 ? 'unidad' : 'unidades' }}</strong
              >
              esta quincena<template v-if="leaders.length > 1"> cada uno</template>
            </p>
          </template>
          <p v-else-if="periodLive.data.value" class="mt-4 text-xl font-black text-ink-700">
            Todavía nadie ha sacado nada esta quincena.
          </p>
          <div class="mt-auto w-full pt-6">
            <button
              type="button"
              class="min-h-[60px] w-full rounded-[18px] bg-accent-200/45 text-lg font-black text-ink-700 disabled:cursor-not-allowed"
              disabled
            >
              Calcular el más hambriento
            </button>
            <p v-if="availableFrom" class="mt-2.5 text-sm text-ink-700">
              Se habilita el {{ availableFrom }}, cuando termine la quincena.
            </p>
          </div>
        </div>
      </template>
      <LoadingFridge v-else class="my-auto py-4" subtitle="Buscando el podio" />
    </section>

    <!-- Quién saca más (en vivo) -->
    <section class="card flex min-h-0 flex-col p-4 sm:p-6" aria-labelledby="kiosk-live-title">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="kiosk-live-title" class="text-[28px] font-black tracking-tight text-ink-900">
          Quién saca más
        </h2>
        <p class="text-sm text-ink-500">Solo cuentan los retiros</p>
      </div>

      <div
        class="segmented mt-4 w-full"
        :style="{ display: 'grid', gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }"
        role="group"
        aria-label="Periodo del ranking"
      >
        <button
          v-for="t in visibleTabs"
          :key="t.value"
          type="button"
          class="segmented-option min-h-12 px-1! text-[15px]! sm:px-3!"
          :aria-pressed="tab === t.value"
          @click="tab = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="rows mt-4 min-h-0 flex-1" aria-live="polite">
        <p v-if="live.error.value" class="text-danger-700">{{ live.error.value }}</p>
        <LoadingFridge v-else-if="!live.data.value" class="py-6" subtitle="Contando retiros" />
        <p v-else-if="!rows.length" class="py-8 text-center text-ink-500">
          Nadie ha sacado nada en este periodo.
        </p>
        <ol v-else class="m-0 list-none space-y-2.5 p-0" aria-label="Unidades retiradas por persona">
          <li
            v-for="row in rows"
            :key="row.user.id"
            class="grid grid-cols-[1.75rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 py-3 sm:grid-cols-[2rem_auto_minmax(0,1fr)_minmax(0,10rem)_2.5rem] sm:gap-4 sm:px-4"
            :class="row.rank === 1 ? 'bg-accent-50/85' : 'glass-inset'"
            :aria-label="`${fullName(row.user)}: ${formatNumber(row.units)} und.${row.rank ? `, puesto ${row.rank}` : ', sin retiros'}`"
          >
            <span
              class="text-center text-2xl font-black tabular-nums"
              :class="row.rank === 1 ? 'text-accent-700' : 'text-ink-700'"
              aria-hidden="true"
            >
              {{ row.rank ?? '–' }}
            </span>
            <Avatar :person="row.user" size="lg" class="row-avatar" />
            <span class="min-w-0" aria-hidden="true">
              <span
                class="block truncate text-lg font-black sm:text-xl"
                :class="row.rank ? 'text-ink-900' : 'text-ink-700'"
              >
                {{ fullName(row.user) }}
              </span>
              <!-- En el celular la barra va bajo el nombre -->
              <span class="mt-1.5 block sm:hidden">
                <span
                  v-if="row.rank"
                  class="bar"
                  :class="row.rank === 1 ? 'bg-accent-500' : 'bg-brand-600'"
                  :style="{ width: `${(row.units / max) * 100}%` }"
                />
                <span v-else class="text-sm text-ink-500">Sin retiros</span>
              </span>
            </span>
            <span class="hidden sm:block" aria-hidden="true">
              <span
                v-if="row.rank"
                class="bar"
                :class="row.rank === 1 ? 'bg-accent-500' : 'bg-brand-600'"
                :style="{ width: `${(row.units / max) * 100}%` }"
              />
              <span v-else class="text-[15px] text-ink-500">Sin retiros</span>
            </span>
            <span class="text-right text-2xl font-black text-ink-900 tabular-nums" aria-hidden="true">
              {{ formatNumber(row.units) }}
            </span>
          </li>
        </ol>
      </div>

      <p class="mt-4 text-sm text-ink-500">{{ footer }}</p>
    </section>
  </div>
</template>

<style scoped>
.bar {
  display: block;
  min-width: 1.5rem;
  height: 1rem;
  border-radius: 999px;
}
.row-avatar {
  width: 3.25rem;
  height: 3.25rem;
  font-size: 1rem;
}
/* Tablet en horizontal: las dos tarjetas ocupan el alto disponible y la lista se desplaza por dentro. */
@media (min-width: 1024px) and (min-height: 600px) {
  .ranking {
    height: 100%;
    min-height: 0;
  }
  .rows {
    overflow-y: auto;
  }
}
@media (max-height: 760px) {
  .monkey {
    width: 10rem;
  }
}
</style>
