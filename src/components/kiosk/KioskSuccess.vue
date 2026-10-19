<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { KioskMovementResult, Product } from '@/domain/models';
import { withUnit } from '@/utils/format';
import Icon from '../ui/Icon.vue';

/** Confirmación con resumen ("Ana sacó 2 botellas de Gaseosa y 1 unidad de Yogur") y vuelta automática. */
const props = withDefaults(defineProps<{ result: KioskMovementResult; seconds?: number }>(), { seconds: 6 });
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

const productById = computed(() => new Map(props.result.products.map((p: Product) => [p.id, p])));
const parts = computed(() =>
  props.result.movements.map((m) => {
    const product = productById.value.get(m.productId);
    return `${withUnit(m.quantity, product?.unit ?? '')} de ${product?.name ?? 'producto'}`;
  }),
);
const summary = computed(() => {
  const list = parts.value;
  const joined =
    list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}` : (list[0] ?? '');
  return `${props.result.person.name} ${props.result.type === 'OUT' ? 'sacó' : 'metió'} ${joined}.`;
});
</script>

<template>
  <div class="flex flex-col items-center px-4 py-10 text-center" role="status" aria-live="polite">
    <span class="mb-6 grid size-24 place-items-center rounded-full bg-brand-600 text-white shadow-lg">
      <Icon name="check" :size="56" />
    </span>
    <h2 class="text-3xl font-bold text-ink-900">¡Listo, {{ result.person.name }}!</h2>
    <p class="mt-3 max-w-xl text-xl text-ink-700">{{ summary }}</p>
    <p class="mt-8 text-sm text-ink-500">Volviendo al inicio en {{ remaining }}…</p>
    <button type="button" class="btn-primary mt-4 px-10 py-4 text-lg" @click="emit('done')">Listo</button>
  </div>
</template>
