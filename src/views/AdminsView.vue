<script setup lang="ts">
import { ref } from 'vue';
import AdminFormDialog from '@/components/AdminFormDialog.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { User } from '@/domain/models';
import AdminPage from '@/layouts/AdminPage.vue';
import { useServices } from '@/services/container';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';

const { users } = useServices();
const auth = useAuthStore();
const toasts = useToastStore();

const { data, error, loading, run } = useAsync(() => users.list({ role: 'ADMIN' }));
useOnEnter(run);

const editing = ref<User | null>(null);
const formOpen = ref(false);
function openForm(user: User | null) {
  editing.value = user;
  formOpen.value = true;
}
async function onSaved() {
  formOpen.value = false;
  await run();
}

const toggling = ref<User | null>(null);
const toggleBusy = ref(false);
async function toggleActive() {
  if (!toggling.value) return;
  toggleBusy.value = true;
  try {
    const updated = await users.update(toggling.value.id, { isActive: !toggling.value.isActive });
    toasts.success(`${updated.fullName} ${updated.isActive ? 'activado' : 'desactivado'}.`);
    toggling.value = null;
    await run();
  } catch (e) {
    toasts.error(errorMessage(e));
  } finally {
    toggleBusy.value = false;
  }
}
</script>

<template>
  <AdminPage title="Administradores">
    <section>
      <PageHeader
        title="Administradores"
        subtitle="Cuentas con email y contraseña para entrar a esta administración."
      >
        <template #actions>
          <button type="button" class="btn-primary min-h-11 px-[18px]" @click="openForm(null)">
            <Icon name="plus" :size="16" /> Agregar administrador
          </button>
        </template>
      </PageHeader>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="card overflow-hidden transition-opacity" :class="{ 'opacity-60': loading && data }">
        <ul class="divide-y divide-ink-200/60">
          <li
            v-for="user in data ?? []"
            :key="user.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="font-extrabold" :class="user.isActive ? 'text-ink-900' : 'text-ink-400'">
                {{ user.fullName }}
                <span v-if="user.id === auth.user?.id" class="text-xs font-normal text-ink-500">(tú)</span>
              </p>
              <p class="text-sm text-ink-500">{{ user.email }}</p>
            </div>
            <Badge :tone="user.isActive ? 'brand' : 'neutral'">{{
              user.isActive ? 'Activo' : 'Inactivo'
            }}</Badge>
            <div class="flex gap-2">
              <button type="button" class="btn-secondary px-3 py-1.5" @click="openForm(user)">Editar</button>
              <button
                v-if="user.id !== auth.user?.id"
                type="button"
                class="btn-secondary px-3 py-1.5"
                @click="toggling = user"
              >
                {{ user.isActive ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <AdminFormDialog :open="formOpen" :user="editing" @close="formOpen = false" @saved="onSaved" />
      <ConfirmDialog
        :open="toggling !== null"
        :title="toggling?.isActive ? 'Desactivar administrador' : 'Activar administrador'"
        :message="
          toggling?.isActive
            ? `${toggling.fullName} no podrá entrar a la administración y su sesión se cerrará.`
            : `${toggling?.fullName ?? ''} podrá volver a entrar.`
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
