<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import PersonFormDialog from '@/components/PersonFormDialog.vue';
import Avatar from '@/components/ui/Avatar.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { Person, PersonActivity } from '@/domain/models';
import AdminPage from '@/layouts/AdminPage.vue';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useLookupsStore } from '@/stores/lookups';
import { useToastStore } from '@/stores/toasts';
import { isTrivialPin, randomPin } from '@/utils/format';

const { people, movements } = useServices();
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

// Cuánto sacó y metió cada persona en la quincena abierta, y quién va primero (#1 hambriento).
const activity = useAsync(() => people.activity());
const leader = useAsync(async () => (await movements.topWithdrawers('period', 1).catch(() => []))[0] ?? null);
const activityById = computed(
  () => new Map<string, PersonActivity>((activity.data.value?.people ?? []).map((row) => [row.userId, row])),
);

function refresh() {
  void run();
  void activity.run();
  void leader.run();
}
useOnEnter(refresh);

/** Estado del PIN tal como lo muestra la tarjeta (el texto siempre dice el estado, no solo el color). */
function pinStatus(person: Person): { text: string; tone: string } {
  if (!person.isActive) return { text: 'Inactiva', tone: 'text-ink-500' };
  if (!person.hasPin) return { text: 'Sin PIN · no aparece en la tablet', tone: 'text-warning-700' };
  if (person.isPinLocked) {
    const minutes = person.pinLockedUntil
      ? Math.max(1, Math.ceil((new Date(person.pinLockedUntil).getTime() - Date.now()) / 60_000))
      : null;
    return {
      text: `Bloqueado · 5 PIN incorrectos${minutes ? ` (${minutes} min)` : ''}`,
      tone: 'text-accent-700',
    };
  }
  return { text: 'PIN asignado', tone: 'text-success-700' };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// --- Restablecer PIN / editar (diálogo) ---
const dialog = ref<{ mode: 'edit' | 'pin'; person: Person } | null>(null);
async function onSaved() {
  dialog.value = null;
  void lookups.ensureUsers(true).catch(() => undefined);
  await run();
}

// --- Menú "…" de cada tarjeta ---
const menuFor = ref<string | null>(null);
function toggleMenu(person: Person) {
  menuFor.value = menuFor.value === person.id ? null : person.id;
}
function closeMenu(event: Event) {
  if (!(event.target as HTMLElement | null)?.closest?.('[data-person-menu]')) menuFor.value = null;
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') menuFor.value = null;
}
onMounted(() => {
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu);
  document.removeEventListener('keydown', onKey);
});
function openFromMenu(mode: 'edit' | 'pin', person: Person) {
  menuFor.value = null;
  dialog.value = { mode, person };
}

// --- Activar / desactivar ---
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

// --- Agregar persona (panel lateral) ---
const form = reactive({ name: '', lastname: '', pin: randomPin() });
const saving = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});
const nameInput = ref<HTMLInputElement | null>(null);

function onPinInput(event: Event) {
  form.pin = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
}

async function addPerson() {
  formError.value = null;
  fieldErrors.value = {};
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Escribe el nombre.';
  if (!form.lastname.trim()) errors.lastname = 'Escribe el apellido.';
  if (form.pin.length !== 4) errors.pin = 'El PIN debe tener 4 dígitos.';
  else if (isTrivialPin(form.pin)) errors.pin = 'Ese PIN es muy fácil de adivinar; usa Generar o elige otro.';
  if (Object.keys(errors).length) {
    fieldErrors.value = errors;
    return;
  }
  saving.value = true;
  try {
    const saved = await people.create({
      name: form.name.trim(),
      lastname: form.lastname.trim(),
      pin: form.pin,
    });
    toasts.success(`${saved.fullName} agregado. Comunícale su PIN: ${form.pin}`);
    Object.assign(form, { name: '', lastname: '', pin: randomPin() });
    void lookups.ensureUsers(true).catch(() => undefined);
    await run();
  } catch (e) {
    formError.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (['WEAK_PIN', 'INVALID_PIN_FORMAT'].includes(e.code)) fieldErrors.value = { pin: e.message };
      if (e.code === 'PERSON_NAME_TAKEN') fieldErrors.value = { lastname: e.message };
    }
    // Si el error es de un campo, se muestra junto a ese campo y no repetido arriba.
    if (Object.keys(fieldErrors.value).length) formError.value = null;
  } finally {
    saving.value = false;
  }
}

/** En pantallas angostas el formulario queda debajo de la lista: este botón lleva a él. */
function goToForm() {
  nameInput.value?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  nameInput.value?.focus({ preventScroll: true });
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
          <label
            class="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-ink-300 bg-white/80 px-3 text-ink-500 backdrop-blur-md focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 sm:w-auto"
          >
            <Icon name="search" :size="18" />
            <input
              v-model="filters.search"
              type="search"
              class="w-40 min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 focus-visible:outline-none"
              placeholder="Buscar por nombre…"
              aria-label="Buscar por nombre"
            />
          </label>
          <select v-model="filters.status" class="input h-11 w-auto py-2" aria-label="Estado">
            <option value="active">Solo activas</option>
            <option value="inactive">Solo inactivas</option>
            <option value="">Todas</option>
          </select>
          <button type="button" class="btn-primary h-11 xl:hidden" @click="goToForm">
            <Icon name="plus" :size="18" :stroke="2" /> Nueva persona
          </button>
        </template>
      </PageHeader>

      <div class="flex flex-wrap items-start gap-5">
        <div class="min-w-0 flex-[999_1_560px]">
          <ErrorState v-if="error && !data" :message="error" @retry="run" />
          <div v-else-if="data && !data.length" class="card">
            <EmptyState
              icon="users"
              title="No hay personas"
              message="Agrega a quienes usan la nevera para que puedan registrar lo que sacan en la tablet."
            />
          </div>
          <ul
            v-else
            class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 transition-opacity"
            :class="{ 'opacity-60': loading && data }"
            aria-label="Personas"
          >
            <template v-if="!data">
              <li v-for="n in 4" :key="n" class="card h-[176px] animate-pulse" />
            </template>
            <li
              v-for="person in data ?? []"
              :key="person.id"
              class="flex flex-col gap-3.5 rounded-[20px] p-[18px]"
              :class="
                person.isActive && person.isPinLocked
                  ? 'bg-accent-50/80 ring-1 ring-accent-200/70 backdrop-blur-md'
                  : 'glass'
              "
            >
              <div class="flex items-center gap-3">
                <Avatar :person="person" size="md" class="size-12!" />
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-[17px] font-extrabold"
                    :class="person.isActive ? 'text-ink-900' : 'text-ink-500'"
                  >
                    {{ person.fullName }}
                  </p>
                  <p class="text-[13px] font-extrabold" :class="pinStatus(person).tone">
                    {{ pinStatus(person).text }}
                  </p>
                </div>
                <span
                  v-if="leader.data.value?.user.id === person.id"
                  class="shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-extrabold text-accent-700"
                >
                  #1 hambriento
                </span>
              </div>
              <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                <template v-if="activity.data.value?.period">
                  <span
                    ><strong class="font-extrabold text-ink-900">{{
                      activityById.get(person.id)?.withdrawn ?? 0
                    }}</strong>
                    {{ plural(activityById.get(person.id)?.withdrawn ?? 0, 'sacada', 'sacadas') }}</span
                  >
                  <span
                    ><strong class="font-extrabold text-ink-900">{{
                      activityById.get(person.id)?.stored ?? 0
                    }}</strong>
                    {{ plural(activityById.get(person.id)?.stored ?? 0, 'metida', 'metidas') }}</span
                  >
                  <span>esta quincena</span>
                </template>
                <span v-else-if="activity.data.value">Sin quincena abierta</span>
              </p>
              <div class="flex gap-2">
                <button
                  v-if="person.isActive && person.isPinLocked"
                  type="button"
                  class="btn-primary min-h-11 flex-1"
                  @click="dialog = { mode: 'pin', person }"
                >
                  Restablecer y desbloquear
                </button>
                <template v-else>
                  <button
                    type="button"
                    class="btn-secondary min-h-11 flex-1"
                    :class="{ 'border-warning-600/50 text-warning-700': person.isActive && !person.hasPin }"
                    @click="dialog = { mode: 'pin', person }"
                  >
                    {{ person.hasPin ? 'Restablecer PIN' : 'Asignar PIN' }}
                  </button>
                  <button
                    type="button"
                    class="btn-secondary min-h-11"
                    @click="dialog = { mode: 'edit', person }"
                  >
                    Editar
                  </button>
                </template>
                <div class="relative" data-person-menu>
                  <button
                    type="button"
                    class="btn-secondary min-h-11 w-11 px-0"
                    :aria-label="`Más opciones para ${person.fullName}`"
                    aria-haspopup="menu"
                    :aria-expanded="menuFor === person.id"
                    @click="toggleMenu(person)"
                  >
                    <Icon name="more" :size="20" :stroke="3" />
                  </button>
                  <div
                    v-if="menuFor === person.id"
                    role="menu"
                    class="absolute right-0 bottom-full z-10 mb-1.5 flex min-w-44 flex-col rounded-2xl glass-strong p-1.5"
                  >
                    <button
                      v-if="person.isActive && person.isPinLocked"
                      type="button"
                      role="menuitem"
                      class="rounded-xl px-3 py-2.5 text-left text-sm font-bold text-ink-900 hover:bg-brand-50"
                      @click="openFromMenu('edit', person)"
                    >
                      Editar nombre
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      class="rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-brand-50"
                      :class="person.isActive ? 'text-danger-700' : 'text-ink-900'"
                      @click="((menuFor = null), (toggling = person))"
                    >
                      {{ person.isActive ? 'Desactivar' : 'Activar' }}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Panel lateral: agregar persona (nombre + PIN) -->
        <aside
          aria-labelledby="add-person-title"
          class="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-[var(--radius-card)] glass-strong p-[22px]"
        >
          <h2 id="add-person-title" class="text-[21px] font-black text-ink-900">Agregar persona</h2>
          <form class="flex flex-col gap-4" novalidate @submit.prevent="addPerson">
            <p
              v-if="formError"
              class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700"
              role="alert"
            >
              {{ formError }}
            </p>
            <fieldset class="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
              <legend class="label p-0">Nombre como aparece en la tablet</legend>
              <div class="grid grid-cols-2 gap-2">
                <div class="min-w-0">
                  <label for="np-name" class="sr-only">Nombre</label>
                  <input
                    id="np-name"
                    ref="nameInput"
                    v-model="form.name"
                    type="text"
                    maxlength="100"
                    autocomplete="off"
                    class="input h-[46px]"
                    placeholder="Nombre"
                    :aria-invalid="Boolean(fieldErrors.name)"
                    :aria-describedby="fieldErrors.name ? 'np-name-error' : undefined"
                  />
                </div>
                <div class="min-w-0">
                  <label for="np-lastname" class="sr-only">Apellido</label>
                  <input
                    id="np-lastname"
                    v-model="form.lastname"
                    type="text"
                    maxlength="100"
                    autocomplete="off"
                    class="input h-[46px]"
                    placeholder="Apellido"
                    :aria-invalid="Boolean(fieldErrors.lastname)"
                    :aria-describedby="fieldErrors.lastname ? 'np-lastname-error' : undefined"
                  />
                </div>
              </div>
              <p v-if="fieldErrors.name" id="np-name-error" class="text-xs text-danger-700">
                {{ fieldErrors.name }}
              </p>
              <p v-if="fieldErrors.lastname" id="np-lastname-error" class="text-xs text-danger-700">
                {{ fieldErrors.lastname }}
              </p>
            </fieldset>
            <div class="flex flex-col gap-1.5">
              <label for="np-pin" class="label mb-0">PIN de 4 dígitos</label>
              <div class="flex gap-2">
                <input
                  id="np-pin"
                  :value="form.pin"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  maxlength="4"
                  class="input h-[46px] min-w-0 flex-1 text-[22px] font-black tracking-[0.4em] tabular-nums"
                  :aria-invalid="Boolean(fieldErrors.pin)"
                  aria-describedby="np-pin-hint"
                  @input="onPinInput"
                />
                <button
                  type="button"
                  class="btn-secondary h-[46px] bg-ink-50/90 px-3.5"
                  @click="((form.pin = randomPin()), (fieldErrors.pin = ''))"
                >
                  Generar
                </button>
              </div>
              <p v-if="fieldErrors.pin" class="text-[13px] font-bold text-danger-700" role="alert">
                {{ fieldErrors.pin }}
              </p>
              <p id="np-pin-hint" class="text-[13px] text-ink-500">
                No se aceptan PIN obvios como 0000 o 1234. Entrégaselo en persona.
              </p>
            </div>
            <button type="submit" class="btn-primary min-h-12" :disabled="saving">
              {{ saving ? 'Guardando…' : 'Agregar persona' }}
            </button>
          </form>
        </aside>
      </div>

      <PersonFormDialog
        :open="dialog !== null"
        :mode="dialog?.mode ?? 'edit'"
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
