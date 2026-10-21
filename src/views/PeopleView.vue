<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import PersonFormDialog from '@/components/PersonFormDialog.vue';
import Avatar from '@/components/ui/Avatar.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import PinSetup from '@/components/PinSetup.vue';
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

const { people, movements } = useServices();
const lookups = useLookupsStore();
const toasts = useToastStore();

/**
 * Se traen activas y desactivadas juntas (son pocas) y se separan aquí: así el segmentado muestra
 * cuántas hay de cada una y el encabezado, cuántas activas.
 */
const filters = reactive({ search: '', status: 'active' as 'active' | 'inactive' });
const { data, error, loading, run } = useAsync(() =>
  people.list({ search: filters.search.trim() || undefined }),
);
const activePeople = computed(() => (data.value ?? []).filter((p) => p.isActive));
const inactivePeople = computed(() => (data.value ?? []).filter((p) => !p.isActive));
const shown = computed(() => (filters.status === 'active' ? activePeople.value : inactivePeople.value));
/** Total de activas sin la búsqueda (para el subtítulo); con búsqueda se usa la última cifra completa. */
const totalActive = ref<number | null>(null);
watch(data, (list) => {
  if (list && !filters.search.trim()) totalActive.value = list.filter((p) => p.isActive).length;
});
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filters.search,
  () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  },
);

// --- Búsqueda (botón con lupa en el encabezado) ---
const searchOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
async function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) {
    await nextTick();
    searchInput.value?.focus();
  } else filters.search = '';
}

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

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
/** Bloqueo por PIN incorrectos: solo si la API todavía lo informa (los bloqueos ahora son por tablet). */
const isLocked = (person: Person) => person.isActive && person.isPinLocked;

/**
 * Segunda línea de cada fila (el texto siempre dice el estado, no solo el color): bloqueo, falta de PIN,
 * o cuántas retiró en la quincena abierta ("7 retiradas esta quincena" / "Sin retiros").
 */
function statusLine(person: Person): { text: string; tone: string } {
  if (!person.isActive) return { text: 'Desactivada · su historial se conserva', tone: 'text-ink-500' };
  if (person.isPinLocked) {
    const minutes = person.pinLockedUntil
      ? Math.max(1, Math.ceil((new Date(person.pinLockedUntil).getTime() - Date.now()) / 60_000))
      : null;
    return {
      text: `Bloqueado · 5 PIN incorrectos${minutes ? ` (${minutes} min)` : ''}`,
      tone: 'font-bold text-danger-700',
    };
  }
  if (!person.hasPin)
    return { text: 'Sin PIN · todavía no puede retirar', tone: 'font-bold text-warning-700' };
  if (!activity.data.value) return { text: '', tone: '' };
  if (!activity.data.value.period) return { text: 'Sin quincena abierta', tone: 'text-ink-500' };
  const row = activityById.value.get(person.id);
  const withdrawn = row?.withdrawn ?? 0;
  const stored = row?.stored ?? 0;
  const parts = [
    withdrawn
      ? `${withdrawn} ${plural(withdrawn, 'retirada', 'retiradas')} esta quincena`
      : 'Sin retiros esta quincena',
  ];
  if (stored) parts.push(`${stored} ${plural(stored, 'ingresada', 'ingresadas')}`);
  return { text: parts.join(' · '), tone: 'text-ink-500' };
}
const isLeader = (person: Person) =>
  person.isActive && leader.data.value?.user.id === person.id && leader.data.value.totalWithdrawn > 0;

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

// --- Agregar persona (tarjeta de arriba; en pantallas anchas, columna derecha) ---
const form = reactive({ name: '', lastname: '', pin: '' });
const saving = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});
const nameInput = ref<HTMLInputElement | null>(null);
/** El PIN se muestra unos segundos y se confirma de memoria; `form.pin` solo trae el PIN confirmado. */
const pinSetup = ref<InstanceType<typeof PinSetup> | null>(null);

async function addPerson() {
  formError.value = null;
  fieldErrors.value = {};
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Escribe el nombre.';
  if (!form.lastname.trim()) errors.lastname = 'Escribe el apellido.';
  if (!form.pin) errors.pin = pinSetup.value?.pendingReason ?? 'Confirma el PIN.';
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
    // El PIN no se repite en el aviso: el empleado ya lo memorizó y lo confirmó.
    toasts.success(`${saved.fullName} agregado. Ya puede usar su PIN en la tablet.`);
    Object.assign(form, { name: '', lastname: '', pin: '' });
    pinSetup.value?.restart();
    nameInput.value?.focus();
    void lookups.ensureUsers(true).catch(() => undefined);
    await run();
  } catch (e) {
    formError.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (['WEAK_PIN', 'INVALID_PIN_FORMAT', 'PIN_TAKEN'].includes(e.code)) {
        fieldErrors.value = { pin: e.message };
        pinSetup.value?.restart(); // hay que elegir otro PIN y volver a confirmarlo
      }
      if (e.code === 'PERSON_NAME_TAKEN') fieldErrors.value = { lastname: e.message };
    }
    // Si el error es de un campo, se muestra junto a ese campo y no repetido arriba.
    if (Object.keys(fieldErrors.value).length) formError.value = null;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdminPage title="Personas">
    <section>
      <PageHeader
        title="Personas"
        back="/admin/mas"
        :subtitle="
          totalActive === null
            ? 'Cada una retira con su PIN único'
            : `${totalActive} ${plural(totalActive, 'activa', 'activas')} · cada una retira con su PIN único`
        "
      >
        <template #actions>
          <button
            type="button"
            class="glass grid size-11 place-items-center rounded-full text-ink-900"
            :aria-label="searchOpen ? 'Cerrar búsqueda' : 'Buscar persona'"
            :aria-pressed="searchOpen"
            @click="toggleSearch"
          >
            <Icon :name="searchOpen ? 'x' : 'search'" :size="18" :stroke="2.2" />
          </button>
        </template>
      </PageHeader>

      <div class="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
        <!-- Agregar persona: nombre + PIN (se muestra 5 s y se confirma de memoria) -->
        <section
          aria-labelledby="add-person-title"
          class="glass-strong flex flex-col gap-2.5 rounded-[18px] p-3 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:p-4"
        >
          <h2 id="add-person-title" class="sr-only">Agregar persona</h2>
          <form class="flex flex-col gap-2.5" novalidate @submit.prevent="addPerson">
            <p
              v-if="formError"
              class="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700"
              role="alert"
            >
              {{ formError }}
            </p>
            <fieldset class="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
              <legend class="mb-1 p-0 text-[12px] font-extrabold text-ink-700">
                Nombre <span class="font-semibold text-ink-500">· como aparecerá en el ranking</span>
              </legend>
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
                    class="input h-11 rounded-[10px] bg-white px-3 py-0 text-[14px]"
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
                    class="input h-11 rounded-[10px] bg-white px-3 py-0 text-[14px]"
                    placeholder="Apellido"
                    :aria-invalid="Boolean(fieldErrors.lastname)"
                    :aria-describedby="fieldErrors.lastname ? 'np-lastname-error' : undefined"
                  />
                </div>
              </div>
              <p v-if="fieldErrors.name" id="np-name-error" class="text-[12px] font-bold text-danger-700">
                {{ fieldErrors.name }}
              </p>
              <p
                v-if="fieldErrors.lastname"
                id="np-lastname-error"
                class="text-[12px] font-bold text-danger-700"
              >
                {{ fieldErrors.lastname }}
              </p>
            </fieldset>
            <PinSetup
              ref="pinSetup"
              v-model="form.pin"
              id-prefix="np"
              :error="fieldErrors.pin"
              :show-hint="false"
            />
            <div class="flex items-center gap-2.5">
              <p id="np-pin-hint" class="min-w-0 flex-1 text-[12px] text-ink-500">
                Sin PIN obvios (0000, 1234) ni repetidos. Entrégalo en persona.
              </p>
              <button
                type="submit"
                class="btn-primary min-h-11 shrink-0 rounded-[10px] px-4"
                :disabled="saving"
              >
                <span
                  v-if="saving"
                  class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                {{ saving ? 'Guardando…' : 'Agregar' }}
              </button>
            </div>
          </form>
        </section>

        <div class="flex min-w-0 flex-col gap-2.5 lg:col-start-1 lg:row-start-1">
          <label
            v-if="searchOpen"
            class="glass flex h-11 min-w-0 items-center gap-2 rounded-xl px-3 text-ink-500 focus-within:ring-2 focus-within:ring-brand-200"
          >
            <Icon name="search" :size="18" />
            <input
              ref="searchInput"
              v-model="filters.search"
              type="search"
              class="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 focus-visible:outline-none"
              placeholder="Buscar por nombre…"
              aria-label="Buscar por nombre"
            />
          </label>

          <div role="group" aria-label="Estado" class="segmented grid grid-cols-2">
            <button
              type="button"
              class="segmented-option min-h-10"
              :aria-pressed="filters.status === 'active'"
              @click="filters.status = 'active'"
            >
              Activas<template v-if="data"> · {{ activePeople.length }}</template>
            </button>
            <button
              type="button"
              class="segmented-option min-h-10"
              :aria-pressed="filters.status === 'inactive'"
              @click="filters.status = 'inactive'"
            >
              Desactivadas<template v-if="inactivePeople.length"> · {{ inactivePeople.length }}</template>
            </button>
          </div>

          <ErrorState v-if="error && !data" :message="error" @retry="run" />

          <!-- Cargando la primera vez: filas de esqueleto -->
          <div
            v-else-if="!data"
            class="glass-strong rounded-[18px] px-3"
            aria-busy="true"
            aria-label="Cargando"
          >
            <div
              v-for="n in 4"
              :key="n"
              class="flex min-h-14 items-center gap-3 border-b border-ink-900/8 last:border-0"
            >
              <span class="size-9 animate-pulse rounded-full bg-ink-900/8" />
              <span class="flex flex-1 flex-col gap-1.5">
                <span class="h-3.5 w-2/5 animate-pulse rounded bg-ink-900/8" />
                <span class="h-3 w-1/3 animate-pulse rounded bg-ink-900/6" />
              </span>
            </div>
          </div>

          <div v-else-if="!shown.length" class="card">
            <EmptyState
              icon="users"
              :title="
                filters.search.trim()
                  ? 'Nadie con ese nombre'
                  : filters.status === 'active'
                    ? 'No hay personas activas'
                    : 'No hay personas desactivadas'
              "
              :message="
                filters.search.trim()
                  ? 'Prueba con otro nombre o apellido.'
                  : filters.status === 'active'
                    ? 'Agrega a quienes usan la nevera para que puedan retirar con su PIN.'
                    : 'Las personas que desactives aparecen aquí y se pueden reactivar.'
              "
            />
          </div>

          <ul
            v-else
            class="glass-strong rounded-[18px] px-3 transition-opacity"
            :class="{ 'opacity-60': loading }"
            aria-label="Personas"
          >
            <li
              v-for="person in shown"
              :key="person.id"
              class="flex min-h-14 items-center gap-2.5 border-b border-ink-900/8 py-1.5 last:border-0"
            >
              <span
                v-if="isLocked(person)"
                class="grid size-9 shrink-0 place-items-center rounded-full bg-danger-50 text-danger-700"
                aria-hidden="true"
              >
                <Icon name="lock" :size="16" :stroke="2.2" />
              </span>
              <Avatar v-else :person="person" size="sm" :class="{ 'opacity-60': !person.isActive }" />
              <div class="min-w-0 flex-1">
                <p class="flex min-w-0 items-center gap-1.5">
                  <span
                    class="truncate font-display text-[15px] font-black"
                    :class="person.isActive ? 'text-ink-900' : 'text-ink-500'"
                    >{{ person.fullName }}</span
                  >
                  <span
                    v-if="isLeader(person)"
                    class="shrink-0 rounded-md bg-accent-100 px-1.5 py-0.5 text-[11px] font-extrabold text-accent-700"
                    title="Quien más retira esta quincena"
                    >#1</span
                  >
                </p>
                <p
                  v-if="statusLine(person).text"
                  class="truncate text-[12px]"
                  :class="statusLine(person).tone"
                >
                  {{ statusLine(person).text }}
                </p>
              </div>

              <button
                v-if="isLocked(person)"
                type="button"
                class="btn-accent min-h-11 shrink-0 rounded-[10px] px-3 text-[13px]"
                :aria-label="`Desbloquear a ${person.fullName} (restablecer su PIN)`"
                @click="dialog = { mode: 'pin', person }"
              >
                Desbloquear
              </button>
              <button
                v-else-if="person.isActive"
                type="button"
                class="min-h-11 shrink-0 rounded-[10px] px-2 text-[13px] font-extrabold hover:bg-brand-50"
                :class="person.hasPin ? 'text-brand-700' : 'text-warning-700'"
                :aria-label="`${person.hasPin ? 'Restablecer PIN de' : 'Asignar PIN a'} ${person.fullName}`"
                @click="dialog = { mode: 'pin', person }"
              >
                {{ person.hasPin ? 'Restablecer PIN' : 'Asignar PIN' }}
              </button>
              <button
                v-else
                type="button"
                class="min-h-11 shrink-0 rounded-[10px] px-2 text-[13px] font-extrabold text-brand-700 hover:bg-brand-50"
                :aria-label="`Reactivar a ${person.fullName}`"
                @click="toggling = person"
              >
                Reactivar
              </button>

              <div class="relative shrink-0" data-person-menu>
                <button
                  type="button"
                  class="grid h-11 w-9 place-items-center rounded-[10px] text-ink-500 hover:bg-ink-900/6 hover:text-ink-900"
                  :aria-label="`Más opciones de ${person.fullName}`"
                  aria-haspopup="menu"
                  :aria-expanded="menuFor === person.id"
                  @click="toggleMenu(person)"
                >
                  <Icon name="more" :size="20" :stroke="3" class="rotate-90" />
                </button>
                <div
                  v-if="menuFor === person.id"
                  role="menu"
                  class="glass-strong absolute top-full right-0 z-20 mt-1 flex min-w-48 flex-col rounded-2xl p-1.5"
                >
                  <button
                    type="button"
                    role="menuitem"
                    class="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-ink-900 hover:bg-brand-50"
                    @click="openFromMenu('edit', person)"
                  >
                    Editar nombre
                  </button>
                  <button
                    v-if="person.isActive"
                    type="button"
                    role="menuitem"
                    class="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-ink-900 hover:bg-brand-50"
                    @click="openFromMenu('pin', person)"
                  >
                    {{ person.hasPin ? 'Restablecer PIN' : 'Asignar PIN' }}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="min-h-11 rounded-xl px-3 text-left text-sm font-bold hover:bg-brand-50"
                    :class="person.isActive ? 'text-danger-700' : 'text-ink-900'"
                    @click="((menuFor = null), (toggling = person))"
                  >
                    {{ person.isActive ? 'Desactivar' : 'Reactivar' }}
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
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
        :title="toggling?.isActive ? 'Desactivar persona' : 'Reactivar persona'"
        :message="
          toggling?.isActive
            ? `${toggling.fullName} ya no podrá retirar con su PIN. Su historial se conserva.`
            : `${toggling?.fullName ?? ''} podrá volver a retirar con su PIN.`
        "
        :confirm-label="toggling?.isActive ? 'Desactivar' : 'Reactivar'"
        :danger="toggling?.isActive"
        :loading="toggleBusy"
        @confirm="toggleActive"
        @close="toggling = null"
      />
    </section>
  </AdminPage>
</template>
