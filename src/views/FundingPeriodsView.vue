<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PeriodBalanceCard from '@/components/PeriodBalanceCard.vue';
import PeriodStatusBadge from '@/components/PeriodStatusBadge.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import FormField from '@/components/ui/FormField.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { formatPeriodRange, toLocalDateInput } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

const { funding } = useServices();
const auth = useAuthStore();
const toasts = useToastStore();
const route = useRoute();
const router = useRouter();

const { data, error, loading, run } = useAsync(() => funding.list());

/**
 * Con ?abrir=1 (botón "Abrir quincena" de la pestaña Quincena cuando no hay ninguna abierta) se abre el
 * diálogo apenas carga la lista, si de verdad no hay otra abierta.
 */
useOnEnter(async () => {
  await run();
  if (!route.query.abrir) return;
  void router.replace({ query: {} }); // al volver a la lista no se reabre
  if (auth.isAdmin && data.value && !current.value) openDialog.value = true;
});

const current = computed(() => data.value?.find((p) => p.status === 'OPEN') ?? null);
const history = computed(() => data.value?.filter((p) => p.status !== 'OPEN') ?? []);

// --- Abrir quincena ---
const openDialog = ref(false);
const form = reactive({ name: '', startDate: '', endDate: '', notes: '' });
const saving = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

/** Propone la quincena actual: del 1 al 15 o del 16 a fin de mes. */
function suggestPeriod() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const firstHalf = today.getDate() <= 15;
  const start = new Date(y, m, firstHalf ? 1 : 16);
  const end = firstHalf ? new Date(y, m, 15) : new Date(y, m + 1, 0);
  const monthName = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(start);
  Object.assign(form, {
    name: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y} · ${firstHalf ? '1ª' : '2ª'} quincena`,
    startDate: toLocalDateInput(start),
    endDate: toLocalDateInput(end),
    notes: '',
  });
}

watch(openDialog, (open) => {
  if (!open) return;
  suggestPeriod();
  formError.value = null;
  fieldErrors.value = {};
});

async function submit() {
  formError.value = null;
  fieldErrors.value = {};
  saving.value = true;
  try {
    const period = await funding.open({
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes.trim() || null,
    });
    toasts.success(`Quincena "${period.name}" abierta.`);
    openDialog.value = false;
    await router.push(`/admin/quincenas/${period.id}`);
  } catch (e) {
    formError.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdminPage title="Quincenas">
    <section>
      <PageHeader
        title="Quincenas"
        subtitle="El dinero que reúne el equipo cada quincena y en qué se gasta."
        back="/admin/quincenas/actual"
      >
        <template #actions>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="btn-primary min-h-11 rounded-[14px] px-3.5 text-xs lg:text-sm"
            :disabled="Boolean(current)"
            @click="openDialog = true"
          >
            <Icon name="plus" :size="16" :stroke="2.6" /> Abrir quincena
          </button>
        </template>
      </PageHeader>
      <p v-if="auth.isAdmin && current" class="-mt-2 mb-3 text-[11px] text-ink-500">
        Para abrir otra quincena primero cierra la actual.
      </p>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else
        class="grid gap-2.5 transition-opacity lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-4"
        :class="{ 'opacity-60': loading && data }"
      >
        <div class="flex min-w-0 flex-col gap-2">
          <h2 class="eyebrow px-1 text-ink-500">Quincena actual</h2>
          <RouterLink
            v-if="current"
            :to="`/admin/quincenas/${current.periodId}`"
            class="block rounded-[20px] transition-transform hover:ring-2 hover:ring-brand-300 active:scale-[0.99]"
          >
            <PeriodBalanceCard :summary="current" with-title />
          </RouterLink>
          <div v-else-if="data" class="card">
            <EmptyState
              icon="wallet"
              title="No hay una quincena abierta"
              :message="
                auth.isAdmin
                  ? 'Abre una para registrar aportes y compras.'
                  : 'El administrador debe abrir la próxima quincena.'
              "
            />
          </div>
          <div v-else class="h-[170px] animate-pulse rounded-[20px] bg-ink-900/15" aria-busy="true" />
        </div>

        <section
          v-if="history.length"
          class="card min-w-0 px-3 pt-1 pb-1 lg:px-4"
          aria-labelledby="history-title"
        >
          <h2 id="history-title" class="section-title flex min-h-10 items-center">Quincenas anteriores</h2>
          <ul>
            <li v-for="p in history" :key="p.periodId" class="border-t border-ink-900/8">
              <RouterLink
                :to="`/admin/quincenas/${p.periodId}`"
                class="flex min-h-[60px] items-center gap-2.5 py-2 hover:bg-white/40"
              >
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[13px] font-extrabold text-ink-900">{{ p.name }}</span>
                    <PeriodStatusBadge :status="p.status" small />
                  </span>
                  <span class="text-[11px] text-ink-500">{{
                    formatPeriodRange(p.startDate, p.endDate, true)
                  }}</span>
                  <span class="flex flex-wrap gap-x-3 text-[11px] text-ink-500">
                    <span
                      >Recaudado <span class="num text-ink-800">{{ formatMoney(p.collected) }}</span></span
                    >
                    <span
                      >Gastado <span class="num text-ink-800">{{ formatMoney(p.spent) }}</span></span
                    >
                  </span>
                </span>
                <span class="flex shrink-0 flex-col items-end">
                  <span class="text-[10px] text-ink-500">Saldo</span>
                  <span
                    class="num text-[13px]"
                    :class="p.isOverspent ? 'text-danger-700' : 'text-success-700'"
                    >{{ formatMoney(p.balance) }}</span
                  >
                </span>
                <Icon name="chevronRight" :size="16" :stroke="2.2" class="shrink-0 text-ink-400" />
              </RouterLink>
            </li>
          </ul>
        </section>
        <div v-else-if="data" class="card px-4 py-6 text-center text-xs text-ink-500">
          Aún no hay quincenas anteriores.
        </div>
      </div>

      <BaseDialog :open="openDialog" title="Abrir quincena" @close="openDialog = false">
        <form class="space-y-4" novalidate @submit.prevent="submit">
          <p v-if="formError" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
            {{ formError }}
          </p>
          <FormField id="pd-name" label="Nombre" :error="fieldErrors.name">
            <input id="pd-name" v-model="form.name" type="text" maxlength="60" class="input" />
          </FormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField id="pd-start" label="Desde" :error="fieldErrors.startDate">
              <input id="pd-start" v-model="form.startDate" type="date" class="input" />
            </FormField>
            <FormField id="pd-end" label="Hasta" :error="fieldErrors.endDate">
              <input id="pd-end" v-model="form.endDate" type="date" class="input" :min="form.startDate" />
            </FormField>
          </div>
          <FormField id="pd-notes" label="Notas" optional>
            <input id="pd-notes" v-model="form.notes" type="text" maxlength="255" class="input" />
          </FormField>
          <div class="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              class="btn-secondary min-h-11"
              :disabled="saving"
              @click="openDialog = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="btn-primary min-h-11"
              :disabled="saving || !form.name || !form.startDate || !form.endDate"
            >
              {{ saving ? 'Abriendo…' : 'Abrir quincena' }}
            </button>
          </div>
        </form>
      </BaseDialog>
    </section>
  </AdminPage>
</template>
