<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import LoadingFridge from '@/components/brand/LoadingFridge.vue';
import PeriodPodium from '@/components/brand/PeriodPodium.vue';
import { joinList } from '@/components/kiosk/kioskText';
import Avatar from '@/components/ui/Avatar.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { RankingPeriodOption, TopWithdrawer, UserRef } from '@/domain/models';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useKioskStore } from '@/stores/kiosk';
import { formatNumber, fullName } from '@/utils/format';

/**
 * Ranking de la máquina (mockup Ranking): quién va ganando "el más hambriento" de la quincena, el botón para
 * calcularlo cuando termina, la lista por periodo y el último ganador.
 */
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

/** Por defecto: una quincena que ya terminó y falta calcular; si no, la abierta; si no, la última. */
function defaultPeriod(list: RankingPeriodOption[]): string {
  return (
    list.find((p) => p.finished && !p.computed) ??
    list.find((p) => p.status === 'OPEN' && !p.finished) ??
    list[0]
  )?.id ?? '';
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

/** El último más hambriento ya calculado (tarjeta de abajo). */
const lastWinner = computed(() => periods.value.find((p) => p.computed && p.id !== periodId.value) ?? null);
const lastWinnerRanking = useAsync((id: string) => kiosk.periodRanking(id));
watch(lastWinner, (p) => p && void lastWinnerRanking.run(p.id), { immediate: true });

// --- Ranking en vivo ---
type Tab = 'quincena' | 'month' | 'week' | 'all';
const tab = ref<Tab>('quincena');
const TABS: { value: Tab; label: string }[] = [
  { value: 'quincena', label: 'Quincena' },
  { value: 'month', label: '30 días' },
  { value: 'week', label: '7 días' },
  { value: 'all', label: 'Siempre' },
];
const visibleTabs = computed(() => TABS.filter((t) => t.value !== 'quincena' || periods.value.length));
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

// Cada vez que se entra (Ionic conserva la página): la quincena pudo terminar mientras tanto.
useOnEnter(async () => {
  await loadPeriods();
  if (periodId.value) await Promise.all([status.run(periodId.value), periodLive.run(periodId.value)]);
});
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(reloadLive, REFRESH_MS)));
onBeforeUnmount(() => clearInterval(timer));

/** Quien va ganando la quincena elegida (varias personas si empatan). */
const leaders = computed<TopWithdrawer[]>(() => {
  const list = (periodLive.data.value ?? []).filter((row) => row.totalWithdrawn > 0);
  const top = list[0]?.totalWithdrawn ?? 0;
  return list.filter((row) => row.totalWithdrawn === top);
});
const ranking = computed(() => (status.data.value?.periodId === periodId.value ? status.data.value : null));
const availableFrom = computed(() => {
  const from = ranking.value?.availableFrom;
  return from ? new Date(from).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : null;
});

interface Row {
  user: UserRef;
  units: number;
  /** Puesto (los empates comparten número); null = sin retiros. */
  rank: number | null;
}

/** Quienes retiraron y, al final, las personas activas que no han sacado nada ("Sin retiros"). */
const rows = computed<Row[]>(() => {
  const data = (live.value.data.value ?? []).filter((r) => r.totalWithdrawn > 0);
  const ranked: Row[] = data.map((r) => ({
    user: r.user,
    units: r.totalWithdrawn,
    rank: 1 + data.filter((other) => other.totalWithdrawn > r.totalWithdrawn).length,
  }));
  if (!live.value.data.value) return ranked;
  const seen = new Set(ranked.map((r) => r.user.id));
  const idle = store.people.filter((p) => !seen.has(p.id)).map((p) => ({ user: p, units: 0, rank: null }) as Row);
  return [...ranked, ...idle];
});
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.units)));
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true">
      <div class="kiosk-sub mx-auto w-full max-w-2xl">
        <PageHeader title="Ranking" back="/">
          <template #actions>
            <span v-if="selected" class="text-[11px] font-bold text-ink-500">{{ selected.name }}</span>
          </template>
        </PageHeader>

        <!-- Va ganando / el más hambriento -->
        <section class="hero" aria-label="El más hambriento de la quincena">
          <LoadingFridge v-if="loadingPeriods" class="py-4 text-white" subtitle="Buscando las quincenas" />
          <p v-else-if="!periods.length" class="py-4 text-[#cfe3f1]">
            Todavía no hay quincenas. El administrador las abre en Quincena.
          </p>
          <template v-else>
            <select
              v-if="periods.length > 1"
              v-model="periodId"
              class="mb-3 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[13px] font-bold text-white"
              aria-label="Quincena"
            >
              <option v-for="p in periods" :key="p.id" :value="p.id" class="text-ink-900">{{ p.name }}</option>
            </select>

            <!-- Ya calculado -->
            <template v-if="ranking?.ranking">
              <div class="flex items-center gap-3.5">
                <span class="crown" aria-hidden="true">
                  <svg width="46" height="46" viewBox="0 -14 200 196">
                    <path d="M58 22 L72 -8 L88 14 L100 -12 L112 14 L128 -8 L142 22 Z" fill="#ffc93c" stroke="#d9a21b" stroke-width="4" stroke-linejoin="round" />
                    <circle cx="28" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="172" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="100" cy="100" r="74" fill="#0b79c3" />
                    <circle cx="78" cy="90" r="28" fill="#fff" />
                    <circle cx="122" cy="90" r="28" fill="#fff" />
                    <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
                    <circle cx="80" cy="90" r="11" fill="#073b5e" />
                    <circle cx="120" cy="90" r="11" fill="#073b5e" />
                    <ellipse cx="100" cy="136" rx="18" ry="14" fill="#e84a5f" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="eyebrow text-[10px]! text-[#9fd3f5]">
                    {{ ranking.ranking.hungriest.length > 1 ? 'Empataron como el más hambriento' : 'El más hambriento' }}
                  </p>
                  <p class="truncate font-display text-[22px] font-black text-white">
                    {{
                      ranking.ranking.hungriest.length
                        ? joinList(ranking.ranking.hungriest.map((h) => fullName(h.user)))
                        : 'Nadie sacó nada'
                    }}
                  </p>
                  <p v-if="ranking.ranking.hungriest.length" class="text-[13px] font-extrabold text-[#ffb46b]">
                    {{ formatNumber(ranking.ranking.hungriest[0]!.totalWithdrawn) }} unidades en {{ ranking.ranking.period.name }}
                  </p>
                </div>
              </div>
              <PeriodPodium
                v-if="ranking.ranking.podium.length"
                :podium="ranking.ranking.podium"
                class="mx-auto mt-4 w-full max-w-[19rem]"
              />
            </template>

            <!-- En curso o por calcular -->
            <template v-else>
              <div class="flex items-center gap-3.5">
                <span class="crown" aria-hidden="true">
                  <svg width="46" height="46" viewBox="0 -14 200 196">
                    <path d="M58 22 L72 -8 L88 14 L100 -12 L112 14 L128 -8 L142 22 Z" fill="#ffc93c" stroke="#d9a21b" stroke-width="4" stroke-linejoin="round" />
                    <circle cx="28" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="172" cy="100" r="24" fill="#0b79c3" />
                    <circle cx="100" cy="100" r="74" fill="#0b79c3" />
                    <circle cx="78" cy="90" r="28" fill="#fff" />
                    <circle cx="122" cy="90" r="28" fill="#fff" />
                    <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
                    <circle cx="80" cy="90" r="11" fill="#073b5e" />
                    <circle cx="120" cy="90" r="11" fill="#073b5e" />
                    <ellipse cx="100" cy="136" rx="18" ry="14" fill="#e84a5f" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="eyebrow text-[10px]! text-[#9fd3f5]">
                    {{ ranking?.canCompute ? `¡${selected?.name} terminó!` : 'Va ganando el más hambriento' }}
                  </p>
                  <p class="truncate font-display text-[22px] font-black text-white">
                    {{ leaders.length ? joinList(leaders.map((l) => fullName(l.user))) : 'Nadie aún' }}
                  </p>
                  <p v-if="leaders.length" class="text-[13px] font-extrabold text-[#ffb46b]">
                    {{ formatNumber(leaders[0]!.totalWithdrawn) }}
                    {{ leaders[0]!.totalWithdrawn === 1 ? 'unidad' : 'unidades' }} esta quincena
                  </p>
                </div>
              </div>
              <div class="mt-3.5 flex items-center gap-3">
                <button
                  type="button"
                  class="compute press"
                  :class="{ ready: ranking?.canCompute }"
                  :disabled="!ranking?.canCompute || computing"
                  @click="computeRanking"
                >
                  {{ computing ? 'Calculando…' : 'Calcular el más hambriento' }}
                </button>
                <span v-if="!ranking?.canCompute && availableFrom" class="text-[12px] text-[#cfe3f1]">
                  Se habilita el {{ availableFrom }}
                </span>
              </div>
              <p v-if="computeError" class="mt-2 text-[13px] font-bold text-[#ff9c8f]" role="alert">{{ computeError }}</p>
            </template>
          </template>
        </section>

        <div
          class="segmented mt-3.5 grid w-full"
          :style="{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }"
          role="group"
          aria-label="Periodo del ranking"
        >
          <button
            v-for="t in visibleTabs"
            :key="t.value"
            type="button"
            class="segmented-option px-1!"
            :aria-pressed="tab === t.value"
            @click="tab = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <section class="glass-strong mt-3.5 rounded-[18px] px-3.5" aria-live="polite">
          <p v-if="live.error.value" class="py-4 text-danger-700">{{ live.error.value }}</p>
          <LoadingFridge v-else-if="!live.data.value" class="py-6" subtitle="Contando retiros" />
          <p v-else-if="!rows.length" class="py-8 text-center text-ink-500">Nadie ha sacado nada en este periodo.</p>
          <ol v-else class="divide-y divide-ink-900/8" aria-label="Unidades retiradas por persona">
            <li
              v-for="row in rows"
              :key="row.user.id"
              class="flex items-center gap-3 py-3"
              :aria-label="`${fullName(row.user)}: ${formatNumber(row.units)} und.${row.rank ? `, puesto ${row.rank}` : ', sin retiros'}`"
            >
              <span
                class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px] font-black"
                :class="row.rank === 1 ? 'bg-[#ffc93c] text-ink-900' : row.rank ? 'bg-brand-100 text-ink-900' : 'text-ink-500'"
                aria-hidden="true"
              >
                {{ row.rank ?? '–' }}
              </span>
              <Avatar :person="row.user" size="sm" />
              <div class="min-w-0 flex-1" aria-hidden="true">
                <p class="truncate font-display text-[14px] font-black text-ink-900">{{ fullName(row.user) }}</p>
                <span v-if="row.rank" class="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-900/8">
                  <span
                    class="block h-full rounded-full"
                    :class="row.rank === 1 ? 'bg-brand-600' : 'bg-brand-300'"
                    :style="{ width: `${(row.units / max) * 100}%` }"
                  />
                </span>
              </div>
              <span v-if="row.rank" class="num text-[16px] text-ink-900" aria-hidden="true">{{ row.units }}</span>
              <span v-else class="text-[12px] text-ink-500" aria-hidden="true">Sin retiros</span>
            </li>
          </ol>
        </section>
        <p class="mt-3 text-center text-[11px] text-ink-500">Solo cuentan los retiros · se actualiza cada minuto</p>

        <section
          v-if="lastWinner && lastWinnerRanking.data.value?.ranking?.hungriest.length"
          class="glass-strong mt-3.5 flex items-center gap-3 rounded-[18px] px-4 py-3"
        >
          <Icon name="trophy" :size="18" class="text-accent-700" />
          <p class="flex-1 text-[12.5px] text-ink-700">
            {{ lastWinner.name }}:
            <strong class="text-ink-900">{{
              joinList(lastWinnerRanking.data.value.ranking.hungriest.map((h) => fullName(h.user)))
            }}</strong>
            fue el más hambriento
          </p>
          <button type="button" class="text-[13px] font-extrabold text-brand-700" @click="periodId = lastWinner.id">
            Ver
          </button>
        </section>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.kiosk-sub {
  padding: calc(var(--ion-safe-area-top) + 1.75rem) calc(14px + var(--ion-safe-area-right))
    calc(var(--ion-safe-area-bottom) + 1.5rem) calc(14px + var(--ion-safe-area-left));
}
.hero {
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(160deg, #0a4a75 0%, #073b5e 70%);
  box-shadow: 0 12px 30px rgb(7 59 94 / 0.25);
}
.crown {
  display: grid;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #ffe2c4;
}
.compute {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: rgb(255 255 255 / 0.12);
  color: #cfe3f1;
  font-size: 13px;
  font-weight: 800;
}
.compute.ready {
  background: var(--color-accent-500);
  color: var(--color-ink-900);
  box-shadow: 0 6px 16px rgb(255 138 31 / 0.35);
}
</style>
