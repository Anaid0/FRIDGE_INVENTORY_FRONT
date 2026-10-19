<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
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
import { toLocalDateInput } from '@/utils/dates';
import { formatDateOnly, formatMoney } from '@/utils/format';

const { funding } = useServices();
const auth = useAuthStore();
const toasts = useToastStore();
const router = useRouter();

const { data, error, loading, run } = useAsync(() => funding.list());
useOnEnter(run);

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
      <PageHeader title="Quincenas" subtitle="El dinero que reúne el equipo cada quincena y en qué se gasta.">
        <template #actions>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="btn-primary"
            :disabled="Boolean(current)"
            @click="openDialog = true"
          >
            <Icon name="plus" :size="16" /> Abrir quincena
          </button>
        </template>
      </PageHeader>
      <p v-if="auth.isAdmin && current" class="-mt-3 mb-5 text-xs text-ink-500">
        Para abrir otra quincena primero cierra la actual.
      </p>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="space-y-6 transition-opacity" :class="{ 'opacity-60': loading && data }">
        <div v-if="current">
          <h2 class="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Quincena actual</h2>
          <RouterLink
            :to="`/admin/quincenas/${current.periodId}`"
            class="block rounded-[var(--radius-card)] hover:ring-2 hover:ring-brand-200"
          >
            <PeriodBalanceCard :summary="current" />
          </RouterLink>
        </div>
        <EmptyState
          v-else-if="data"
          icon="wallet"
          title="No hay una quincena abierta"
          :message="
            auth.isAdmin
              ? 'Abre una para registrar aportes y compras.'
              : 'El administrador debe abrir la próxima quincena.'
          "
        />

        <div v-if="history.length" class="card overflow-hidden">
          <h2 class="border-b border-ink-100 px-5 py-4 font-semibold text-ink-900">Quincenas anteriores</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-ink-50 text-xs text-ink-500">
                <tr>
                  <th scope="col" class="px-5 py-3 text-left font-medium">Quincena</th>
                  <th scope="col" class="px-5 py-3 text-left font-medium">Estado</th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">Recaudado</th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">Gastado</th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-100">
                <tr v-for="p in history" :key="p.periodId" class="hover:bg-ink-50">
                  <td class="px-5 py-3">
                    <RouterLink
                      :to="`/admin/quincenas/${p.periodId}`"
                      class="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {{ p.name }}
                    </RouterLink>
                    <p class="text-xs text-ink-500">
                      {{ formatDateOnly(p.startDate) }} – {{ formatDateOnly(p.endDate) }}
                    </p>
                  </td>
                  <td class="px-5 py-3"><PeriodStatusBadge :status="p.status" /></td>
                  <td class="px-5 py-3 text-right tabular-nums">{{ formatMoney(p.collected) }}</td>
                  <td class="px-5 py-3 text-right tabular-nums">{{ formatMoney(p.spent) }}</td>
                  <td
                    class="px-5 py-3 text-right font-semibold tabular-nums"
                    :class="p.isOverspent ? 'text-danger-700' : 'text-ink-900'"
                  >
                    {{ formatMoney(p.balance) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn-secondary" :disabled="saving" @click="openDialog = false">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn-primary"
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
