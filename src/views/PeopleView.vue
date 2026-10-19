<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import PersonFormDialog from '@/components/PersonFormDialog.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { Person } from '@/domain/models';
import AdminPage from '@/layouts/AdminPage.vue';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { formatDateTime } from '@/utils/format';

const { people } = useServices();
const lookups = useLookupsStore();
const toasts = useToastStore();

const filters = reactive({ search: '', status: 'active' as '' | 'active' | 'inactive' });
const { data, error, loading, run } = useAsync(() =>
  people.list({
    search: filters.search.trim() || undefined,
    isActive: filters.status === '' ? undefined : filters.status === 'active',
  }),
);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => ({ ...filters }),
  () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  },
);
useOnEnter(run);

const dialog = ref<{ mode: 'create' | 'edit' | 'pin'; person: Person | null } | null>(null);
async function onSaved() {
  dialog.value = null;
  void lookups.ensureUsers(true).catch(() => undefined);
  await run();
}

const toggling = ref<Person | null>(null);
const toggleBusy = ref(false);
async function toggleActive() {
  if (!toggling.value) return;
  toggleBusy.value = true;
  try {
    const updated = await people.update(toggling.value.id, { isActive: !toggling.value.isActive });
    toasts.success(`${updated.fullName} ${updated.isActive ? 'activado' : 'desactivado'}.`);
    toggling.value = null;
    void lookups.ensureUsers(true).catch(() => undefined);
    await run();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    toggleBusy.value = false;
  }
}
</script>

<template>
  <AdminPage title="Personas">
    <section>
      <PageHeader
        title="Personas"
        subtitle="Quienes usan la nevera. No tienen cuenta: en la tablet eligen su nombre y escriben su PIN."
      >
        <template #actions>
          <button type="button" class="btn-primary" @click="dialog = { mode: 'create', person: null }">
            <Icon name="plus" :size="16" /> Agregar persona
          </button>
        </template>
      </PageHeader>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <input
          v-model="filters.search"
          type="search"
          class="input max-w-xs"
          placeholder="Buscar por nombre…"
          aria-label="Buscar persona"
        />
        <select v-model="filters.status" class="input w-auto" aria-label="Estado">
          <option value="active">Solo activas</option>
          <option value="inactive">Solo inactivas</option>
          <option value="">Todas</option>
        </select>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="card overflow-hidden transition-opacity" :class="{ 'opacity-60': loading && data }">
        <EmptyState
          v-if="data && !data.length"
          icon="users"
          title="No hay personas"
          message="Agrega a quienes usan la nevera para que puedan registrar lo que sacan en la tablet."
        />
        <ul v-else class="divide-y divide-ink-100">
          <li
            v-for="person in data ?? []"
            :key="person.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            :class="{ 'bg-ink-50/60': !person.isActive }"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold" :class="person.isActive ? 'text-ink-900' : 'text-ink-400'">
                  {{ person.fullName }}
                </p>
                <Badge v-if="!person.isActive" tone="neutral">Inactiva</Badge>
                <Badge v-else-if="!person.hasPin" tone="warning"
                  ><Icon name="alert" :size="12" /> Sin PIN</Badge
                >
                <Badge v-else-if="person.isPinLocked" tone="danger">
                  <Icon name="lock" :size="12" /> Bloqueada hasta
                  {{ formatDateTime(person.pinLockedUntil!).split(', ')[1] }}
                </Badge>
                <Badge v-else tone="brand"><Icon name="check" :size="12" /> PIN asignado</Badge>
              </div>
              <p v-if="person.isActive && !person.hasPin" class="mt-0.5 text-xs text-ink-500">
                No aparece en la tablet hasta que le asignes un PIN.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn-secondary px-3 py-1.5"
                :class="{ 'border-warning-600 text-warning-700': person.isActive && !person.hasPin }"
                @click="dialog = { mode: 'pin', person }"
              >
                <Icon name="key" :size="16" /> {{ person.hasPin ? 'Restablecer PIN' : 'Asignar PIN' }}
              </button>
              <button
                type="button"
                class="btn-secondary px-3 py-1.5"
                @click="dialog = { mode: 'edit', person }"
              >
                Editar
              </button>
              <button type="button" class="btn-secondary px-3 py-1.5" @click="toggling = person">
                {{ person.isActive ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <PersonFormDialog
        :open="dialog !== null"
        :mode="dialog?.mode ?? 'create'"
        :person="dialog?.person ?? null"
        @close="dialog = null"
        @saved="onSaved"
      />
      <ConfirmDialog
        :open="toggling !== null"
        :title="toggling?.isActive ? 'Desactivar persona' : 'Activar persona'"
        :message="
          toggling?.isActive
            ? `${toggling.fullName} dejará de aparecer en la tablet. Su historial se conserva.`
            : `${toggling?.fullName ?? ''} volverá a aparecer en la tablet.`
        "
        :confirm-label="toggling?.isActive ? 'Desactivar' : 'Activar'"
        :danger="toggling?.isActive"
        :loading="toggleBusy"
        @confirm="toggleActive"
        @close="toggling = null"
      />
    </section>
  </AdminPage>
</template>
