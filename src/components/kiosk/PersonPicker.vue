<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { KioskPerson } from '@/domain/models';
import LoadingFridge from '../brand/LoadingFridge.vue';
import Avatar from '../ui/Avatar.vue';

/**
 * "¿Quién eres?": tarjetas grandes con las iniciales (con buscador si son muchas).
 * Quien quedó bloqueado por PIN incorrectos aparece atenuado y no se puede elegir hasta que pase el bloqueo.
 */
const props = defineProps<{ people: KioskPerson[]; loading: boolean }>();
const emit = defineEmits<{ select: [person: KioskPerson] }>();

const search = ref('');
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const filtered = computed(() => {
  const term = normalize(search.value.trim());
  return term
    ? props.people.filter((p) => normalize(`${p.name} ${p.lastname}`).includes(term))
    : props.people;
});

// La hora avanza para que el bloqueo se levante solo en pantalla.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 15_000)));
onBeforeUnmount(() => clearInterval(timer));

/** Minutos que faltan para el desbloqueo (null si no está bloqueada). */
function lockedMinutes(person: KioskPerson): number | null {
  if (!person.pinLockedUntil) return null;
  const ms = new Date(person.pinLockedUntil).getTime() - now.value;
  return ms > 0 ? Math.ceil(ms / 60_000) : null;
}
</script>

<template>
  <div>
    <input
      v-if="people.length > 12"
      v-model="search"
      type="search"
      class="input mb-4 py-3 text-lg"
      placeholder="Busca tu nombre…"
      aria-label="Buscar persona"
    />
    <LoadingFridge v-if="loading && !people.length" class="py-6" subtitle="Buscando a tu equipo" />
    <p v-else-if="!people.length" class="py-10 text-center text-ink-500">
      Todavía no hay personas con PIN. Pídele al administrador que te agregue.
    </p>
    <ul class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      <li v-for="person in filtered" :key="person.id">
        <button
          v-if="lockedMinutes(person) === null"
          type="button"
          class="person glass flex w-full items-center gap-4 rounded-[20px] p-4 text-left sm:min-h-[148px] sm:px-6"
          @click="emit('select', person)"
        >
          <Avatar :person="person" size="lg" class="avatar" />
          <span class="min-w-0 text-[22px] leading-tight font-black break-words text-ink-900">
            {{ person.name }} {{ person.lastname }}
          </span>
        </button>
        <button
          v-else
          type="button"
          class="flex w-full cursor-not-allowed items-center gap-4 rounded-[20px] border-2 border-dashed border-ink-300 bg-white/30 p-4 text-left sm:min-h-[148px] sm:px-6"
          disabled
        >
          <Avatar :person="person" size="lg" locked class="avatar" />
          <span class="min-w-0">
            <span class="block text-[22px] leading-tight font-black break-words text-ink-700">
              {{ person.name }} {{ person.lastname }}
            </span>
            <span class="mt-1 block text-sm font-extrabold text-ink-500">
              Bloqueado · vuelve en {{ lockedMinutes(person) }} min
            </span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.person {
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    transform 0.1s;
}
.person:hover,
.person:focus-visible {
  border-color: var(--color-brand-600);
}
.person:active {
  transform: scale(0.98);
  border-color: var(--color-brand-600);
  box-shadow:
    0 0 0 4px rgb(11 121 195 / 0.15),
    var(--glass-shadow);
}
@media (max-width: 639px) {
  .avatar {
    width: 3.5rem;
    height: 3.5rem;
    font-size: 1.375rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .person {
    transition: none;
  }
}
</style>
