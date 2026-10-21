<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminFormDialog from '@/components/AdminFormDialog.vue';
import Avatar from '@/components/ui/Avatar.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SkeletonRows from '@/components/ui/SkeletonRows.vue';
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
        back="/admin/mas"
        subtitle="Entran con email y contraseña o con su código en la máquina"
      >
        <template #actions>
          <button
            type="button"
            class="btn-primary min-h-11 px-3.5"
            aria-label="Agregar administrador"
            @click="openForm(null)"
          >
            <Icon name="plus" :size="16" :stroke="2.4" />
            <span class="hidden sm:inline">Agregar administrador</span>
          </button>
        </template>
      </PageHeader>

      <div
        class="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-5"
      >
        <div>
          <ErrorState v-if="error && !data" :message="error" @retry="run" />
          <SkeletonRows v-else-if="!data" :rows="3" round label="Cargando administradores" />
          <ul
            v-else
            class="card flex flex-col divide-y divide-ink-900/8 px-3.5 py-1 transition-opacity"
            :class="{ 'opacity-60': loading }"
            aria-label="Administradores"
          >
            <li v-for="user in data" :key="user.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <Avatar :person="user" :solid="user.isActive" :locked="!user.isActive" />
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="truncate font-display text-[15px] font-black"
                    :class="user.isActive ? 'text-ink-900' : 'text-ink-400'"
                    >{{ user.fullName }}</span
                  >
                  <span v-if="user.id === auth.user?.id" class="text-xs font-bold text-ink-500">(tú)</span>
                </p>
                <p class="truncate text-xs text-ink-500">{{ user.email }}</p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <Badge v-if="!user.isActive" size="sm" tone="neutral">Inactivo</Badge>
                  <Badge v-if="user.hasAdminCode" size="sm" tone="success"
                    ><Icon name="check" :size="11" :stroke="2.6" /> Código listo</Badge
                  >
                  <Badge v-else size="sm" tone="neutral"
                    ><Icon name="key" :size="11" :stroke="2.2" /> Sin código</Badge
                  >
                </div>
              </div>
              <div class="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  class="btn-secondary min-h-10 px-3 text-xs"
                  :aria-label="`Editar a ${user.fullName}`"
                  @click="openForm(user)"
                >
                  Editar
                </button>
                <button
                  v-if="user.id !== auth.user?.id"
                  type="button"
                  class="min-h-10 rounded-xl border bg-white/80 px-3 text-xs font-extrabold"
                  :class="
                    user.isActive
                      ? 'border-danger-200 text-danger-700 hover:bg-danger-50'
                      : 'border-ink-300 text-ink-900 hover:bg-white'
                  "
                  @click="toggling = user"
                >
                  {{ user.isActive ? 'Desactivar' : 'Activar' }}
                </button>
              </div>
            </li>
          </ul>
        </div>

        <!-- Código de la máquina: cada admin pone el suyo en Más → Cambiar código -->
        <aside class="card flex flex-col gap-2 p-3.5">
          <div class="flex items-center gap-2.5">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-700"
              aria-hidden="true"
            >
              <Icon name="key" :size="20" :stroke="2" />
            </span>
            <h2 class="section-title">Código para la máquina</h2>
          </div>
          <p class="text-[13px] text-ink-700">
            Cada administrador entra desde la máquina escribiendo su código numérico. Lo pone cada uno, con su
            contraseña, en <strong class="text-ink-900">Más → Cambiar código</strong>; aquí solo se ve si ya
            lo tiene.
          </p>
          <RouterLink to="/admin/mas" class="btn-secondary min-h-11 self-start">
            <Icon name="key" :size="16" :stroke="2" />
            {{ auth.user?.hasAdminCode ? 'Cambiar mi código' : 'Poner mi código' }}
          </RouterLink>
        </aside>
      </div>

      <AdminFormDialog :open="formOpen" :user="editing" @close="formOpen = false" @saved="onSaved" />
      <ConfirmDialog
        :open="toggling !== null"
        :title="
          toggling?.isActive
            ? `¿Desactivar a ${toggling.fullName}?`
            : `¿Activar a ${toggling?.fullName ?? ''}?`
        "
        :message="
          toggling?.isActive
            ? `No podrá entrar a la administración y su sesión se cerrará.`
            : `Podrá volver a entrar a la administración.`
        "
        :confirm-label="toggling?.isActive ? 'Desactivar' : 'Activar'"
        :loading-label="toggling?.isActive ? 'Desactivando…' : 'Activando…'"
        :danger="toggling?.isActive"
        :loading="toggleBusy"
        @confirm="toggleActive"
        @close="toggling = null"
      />
    </section>
  </AdminPage>
</template>
