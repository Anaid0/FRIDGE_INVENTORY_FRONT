<script setup lang="ts">
import { computed, ref } from 'vue';
import type { KioskPerson } from '@/domain/models';

/** "¿Quién eres?": grilla de personas con iniciales (con buscador si son muchas). */
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
    <p v-if="loading && !people.length" class="py-10 text-center text-ink-500">Cargando…</p>
    <p v-else-if="!people.length" class="py-10 text-center text-ink-500">
      Todavía no hay personas con PIN. Pídele al administrador que te agregue.
    </p>
    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="person in filtered" :key="person.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm active:bg-brand-50"
          @click="emit('select', person)"
        >
          <span
            class="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-800"
          >
            {{ person.initials }}
          </span>
          <span class="min-w-0 text-lg leading-tight font-semibold text-ink-900">
            {{ person.name }}
            <span class="block truncate text-base font-normal text-ink-500">{{ person.lastname }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
