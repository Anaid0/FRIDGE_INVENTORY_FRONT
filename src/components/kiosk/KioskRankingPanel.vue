<script setup lang="ts">
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { computed, ref, watch } from 'vue';
import BarChart from '@/components/charts/BarChart.vue';
import { useAsync } from '@/composables/useAsync';
import type { RankingPeriod } from '@/domain/models';
import { useServices } from '@/services/container';
import { formatNumber, fullName } from '@/utils/format';

const { kiosk } = useServices();
const period = ref<RankingPeriod>('all');
const { data, error, run } = useAsync(() => kiosk.topWithdrawers(period.value, 10));
void run();
watch(period, run);

const rows = computed(() =>
  (data.value ?? []).map((row) => ({
    key: row.user.id,
    label: fullName(row.user),
    value: row.totalWithdrawn,
    valueLabel: `${formatNumber(row.totalWithdrawn)} und.`,
    detail: `${row.withdrawals} ${row.withdrawals === 1 ? 'retiro' : 'retiros'}`,
  })),
);
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <IonSegment :value="period" class="mb-6" @ion-change="period = $event.detail.value as RankingPeriod">
      <IonSegmentButton value="all"><IonLabel>Desde siempre</IonLabel></IonSegmentButton>
      <IonSegmentButton value="month"><IonLabel>Últimos 30 días</IonLabel></IonSegmentButton>
      <IonSegmentButton value="week"><IonLabel>Últimos 7 días</IonLabel></IonSegmentButton>
    </IonSegment>
    <div class="rounded-2xl bg-white p-6 shadow-sm">
      <p v-if="error" class="text-danger-700">{{ error }}</p>
      <p v-else-if="data && !rows.length" class="py-8 text-center text-ink-500">
        Nadie ha sacado nada en este periodo.
      </p>
      <BarChart
        v-else
        :rows="rows"
        caption="Unidades retiradas por persona"
        label-header="Persona"
        value-header="Unidades"
        :emphasize-key="rows[0]?.key ?? null"
      />
    </div>
  </div>
</template>
