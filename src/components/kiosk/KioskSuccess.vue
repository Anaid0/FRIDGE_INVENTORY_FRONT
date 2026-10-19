<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { KioskMovementResult, Product } from '@/domain/models';
import { formatMoney, formatNumber, toCents } from '@/utils/format';
import MoveIllustration from '../brand/MoveIllustration.vue';
import Icon from '../ui/Icon.vue';

/** Cómo va la persona en el ranking de la quincena abierta (se calcula tras registrar). */
export interface KioskStanding {
  units: number;
  position: number;
}

/**
 * Confirmación ("Sacaste 2 Gaseosa y 1 Yogur."), cómo va en el ranking de la quincena y vuelta automática
 * al inicio con cuenta regresiva.
 */
const props = withDefaults(
  defineProps<{ result: KioskMovementResult; seconds?: number; standing?: KioskStanding | null }>(),
  { seconds: 6, standing: null },
);
const emit = defineEmits<{ done: [] }>();

const remaining = ref(props.seconds);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    remaining.value -= 1;
    if (remaining.value <= 0) {
      clearInterval(timer);
      emit('done');
    }
  }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const out = computed(() => props.result.type === 'OUT');
const productById = computed(() => new Map(props.result.products.map((p: Product) => [p.id, p])));
const parts = computed(() =>
  props.result.movements.map((m) => ({
    key: m.productId,
    quantity: m.quantity,
    name: productById.value.get(m.productId)?.name ?? 'producto',
  })),
);
const totalUnits = computed(() => props.result.movements.reduce((sum, m) => sum + m.quantity, 0));
/** Quien más consume, más aporta: lo que vale lo que sacó (precio de compra guardado en cada retiro). */
const value = computed(
  () =>
    props.result.movements.reduce(
      (cents, m) => cents + (m.unitPrice ? toCents(m.unitPrice) * m.quantity : 0),
      0,
    ) / 100,
);
const progress = computed(() => Math.max(0, Math.min(1, remaining.value / props.seconds)));
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12"
    role="status"
    aria-live="polite"
  >
    <div class="card grid place-items-center p-6 md:aspect-[13/15] md:p-10">
      <MoveIllustration
        :type="result.type"
        :count="totalUnits"
        celebrate
        decorative
        class="w-full max-w-[16rem] md:max-w-none"
      />
    </div>

    <div class="min-w-0">
      <p
        class="inline-flex items-center gap-2 rounded-full bg-success-50/85 px-4 py-2 font-extrabold text-success-700"
      >
        <Icon name="check" :size="18" :stroke="2.5" /> Registrado
      </p>
      <h2 class="mt-4 text-4xl font-black tracking-tight text-ink-900 sm:text-[56px] sm:leading-tight">
        ¡Listo, {{ result.person.name }}!
      </h2>
      <p class="mt-3 text-xl text-ink-700 sm:text-2xl">
        {{ out ? 'Sacaste' : 'Metiste' }}
        <template v-for="(part, index) in parts" :key="part.key"
          ><template v-if="index > 0">{{ index === parts.length - 1 ? ' y ' : ', ' }}</template
          ><strong class="font-black text-ink-900">{{ part.quantity }} {{ part.name }}</strong></template
        >.
      </p>
      <p v-if="out && value > 0" class="mt-2 text-lg text-ink-600">
        Esto suma <strong class="font-black text-ink-900 tabular-nums">{{ formatMoney(value) }}</strong> a tu
        aporte para el siguiente mercado.
      </p>

      <p
        v-if="out && standing"
        class="mt-6 flex items-start gap-3 rounded-2xl border border-accent-200/70 bg-accent-50/85 px-5 py-4 text-ink-700"
      >
        <Icon name="trophy" :size="24" class="mt-0.5 shrink-0 text-accent-700" />
        <span>
          Llevas
          <strong class="text-ink-900"
            >{{ formatNumber(standing.units) }} {{ standing.units === 1 ? 'unidad' : 'unidades' }}</strong
          >
          esta quincena.
          <template v-if="standing.position === 1">
            Vas de <strong class="text-accent-700">#1 en el ranking</strong>.
          </template>
          <template v-else>
            Vas <strong class="text-accent-700">#{{ standing.position }} en el ranking</strong>.
          </template>
        </span>
      </p>
      <p
        v-else-if="!out"
        class="mt-6 flex items-start gap-3 rounded-2xl border border-success-100 bg-success-50/85 px-5 py-4 text-ink-700"
      >
        <Icon name="putIn" :size="24" class="mt-0.5 shrink-0 text-success-700" />
        <span>¡Gracias por llenar la nevera! El equipo ya puede verlo en el stock.</span>
      </p>

      <div class="mt-8" aria-hidden="true">
        <div class="flex items-baseline justify-between text-sm">
          <span class="text-ink-500">Volviendo al inicio…</span>
          <span class="font-black text-ink-900 tabular-nums">{{ remaining }} s</span>
        </div>
        <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-200/80">
          <div class="countdown h-full rounded-full bg-brand-600" :style="{ width: `${progress * 100}%` }" />
        </div>
      </div>
      <button
        type="button"
        class="btn-primary mt-6 min-h-16 w-full rounded-[18px]! text-xl! font-black!"
        @click="emit('done')"
      >
        Terminar
      </button>
    </div>
  </div>
</template>

<style scoped>
.countdown {
  transition: width 1s linear;
}
@media (prefers-reduced-motion: reduce) {
  .countdown {
    transition: none;
  }
}
</style>
