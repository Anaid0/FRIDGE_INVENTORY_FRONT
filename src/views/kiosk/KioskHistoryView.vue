<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { ref } from 'vue';
import MovementDayList from '@/components/MovementDayList.vue';
import MovementLegend from '@/components/MovementLegend.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import SkeletonRows from '@/components/ui/SkeletonRows.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import type { MovementType } from '@/domain/models';
import { useServices } from '@/services/container';

/**
 * Historial de la máquina (mockup Historial): lo que entra y sale, por día, de a 20 por página.
 * El filtro Todo/Retiros/Ingresos se aplica en el servidor y vuelve a la página 1.
 * Si la tablet fue revocada (401), el interceptor global ya la manda a emparejar.
 */
const PAGE_SIZE = 20;
const { kiosk } = useServices();

type Filter = 'all' | MovementType;
const filter = ref<Filter>('all');
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'OUT', label: 'Retiros' },
  { value: 'IN', label: 'Ingresos' },
];
const page = ref(1);

const { data, error, loading, run } = useAsync(() =>
  kiosk.movements({
    page: page.value,
    pageSize: PAGE_SIZE,
    type: filter.value === 'all' ? undefined : filter.value,
  }),
);

function setFilter(value: Filter) {
  if (filter.value === value) return;
  filter.value = value;
  page.value = 1;
  void run();
}
/** Cambia de página y sube al inicio de la lista (el botón queda abajo, fuera de la vista). */
const content = ref<{ $el?: { scrollToTop?: (ms?: number) => Promise<void> } } | null>(null);
function goTo(next: number) {
  page.value = next;
  void run();
  void content.value?.$el?.scrollToTop?.(250)?.catch(() => undefined);
}

const EMPTY: Record<Filter, string> = {
  all: 'Todavía no hay movimientos.',
  OUT: 'Todavía nadie ha sacado nada de la nevera.',
  IN: 'Todavía no ha entrado nada a la nevera.',
};

useOnEnter(() => run());
</script>

<template>
  <IonPage>
    <IonContent ref="content" :fullscreen="true">
      <div class="kiosk-sub mx-auto w-full max-w-2xl">
        <PageHeader title="Historial" back="/">
          <template #actions>
            <span class="text-[11px] font-bold text-ink-500">Lo que entra y sale</span>
            <MovementLegend align="right" />
          </template>
        </PageHeader>
        <div class="segmented mb-3.5 grid w-full grid-cols-3" role="group" aria-label="Filtrar">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            class="segmented-option"
            :aria-pressed="filter === f.value"
            @click="setFilter(f.value)"
          >
            {{ f.label }}
          </button>
        </div>

        <ErrorState v-if="error" :message="error" @retry="run" />
        <SkeletonRows v-else-if="!data" :rows="6" label="Buscando movimientos" />
        <EmptyState v-else-if="!data.items.length" card :message="EMPTY[filter]" />
        <div v-else class="transition-opacity" :class="{ 'opacity-60': loading }" :aria-busy="loading">
          <MovementDayList :movements="data.items" />
          <Pagination
            v-if="data.total > PAGE_SIZE"
            class="mt-1"
            :page="data.page"
            :page-size="PAGE_SIZE"
            :total="data.total"
            @change="goTo"
          />
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.kiosk-sub {
  padding: calc(var(--ion-safe-area-top) + 1.75rem) calc(14px + var(--ion-safe-area-right))
    calc(var(--ion-safe-area-bottom) + 1.5rem) calc(14px + var(--ion-safe-area-left));
}
</style>
