<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { MovementView } from '@/domain/models';
import { formatMoney, fullName } from '@/utils/format';
import Icon from './ui/Icon.vue';

/**
 * Movimientos agrupados por día (mockups Historial y Movimientos): flecha roja ↑ (retiro, sale) o verde ↓
 * (ingreso, entra), producto, quién y a qué hora, la cantidad (−1 / +2) y debajo el precio unitario
 * ("$ 2.400 c/u"; "sin precio" si el movimiento no lo tiene).
 * `detailed` (administración): también el stock antes→después, "registrado por" cuando lo anotó otro, la
 * nota y el enlace a la compra de la que vino.
 */
const props = withDefaults(defineProps<{ movements: MovementView[]; detailed?: boolean; now?: Date }>(), {
  detailed: false,
  now: () => new Date(),
});

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

/** "HOY · LUNES 19 DE OCTUBRE", "AYER · …", "VIERNES 16 DE OCTUBRE". */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const text = date
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');
  const today = dayKey(props.now.toISOString());
  const yesterday = dayKey(new Date(props.now.getTime() - 86_400_000).toISOString());
  const key = dayKey(iso);
  const prefix = key === today ? 'Hoy · ' : key === yesterday ? 'Ayer · ' : '';
  return `${prefix}${text}`;
}

const groups = computed(() => {
  const out: { key: string; label: string; items: MovementView[] }[] = [];
  for (const m of props.movements) {
    const key = dayKey(m.createdAt);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(m);
    else out.push({ key, label: dayLabel(m.createdAt), items: [m] });
  }
  return out;
});

/** Quién: la persona, o "Ingresó el administrador" para entradas de compra o manuales del admin. */
function who(m: MovementView): string {
  if (m.source === 'PURCHASE_VOID') return 'Compra anulada';
  if (!props.detailed && m.type === 'IN') return 'Ingresó el administrador';
  if (m.source === 'PURCHASE') return `Compra · ${fullName(m.performedBy)}`;
  return fullName(m.performedBy);
}
const registeredByOther = (m: MovementView) => props.detailed && m.registeredBy.id !== m.performedBy.id;
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <section v-for="group in groups" :key="group.key" :aria-label="group.label">
      <h2 class="mb-2 px-1 text-[11px] font-black tracking-[0.08em] text-ink-500 uppercase">
        {{ group.label }}
      </h2>
      <ul class="glass-strong divide-y divide-ink-900/8 rounded-[18px] px-3">
        <li v-for="m in group.items" :key="m.id" class="flex items-center gap-3 py-2.5">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-[10px]"
            :class="m.type === 'OUT' ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700'"
            aria-hidden="true"
          >
            <Icon :name="m.type === 'OUT' ? 'arrowUp' : 'arrowDown'" :size="16" :stroke="2.4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-[14px] font-black text-ink-900">{{ m.product.name }}</p>
            <p class="truncate text-[12px] text-ink-500">{{ who(m) }} · {{ time(m.createdAt) }}</p>
            <span
              v-if="registeredByOther(m)"
              class="mt-1 inline-block rounded-md bg-ink-900/7 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-600"
            >
              registrado por {{ fullName(m.registeredBy) }}
            </span>
            <template v-if="detailed">
              <RouterLink
                v-if="m.purchaseId"
                :to="`/admin/compras/${m.purchaseId}`"
                class="mt-0.5 block text-[12px] font-extrabold text-brand-700"
              >
                Ver compra
              </RouterLink>
              <p v-if="m.note" class="mt-0.5 truncate text-[11.5px] text-ink-500 italic">{{ m.note }}</p>
            </template>
          </div>
          <div class="shrink-0 text-right">
            <p class="num text-[15px]" :class="m.type === 'OUT' ? 'text-danger-700' : 'text-success-700'">
              {{ m.type === 'OUT' ? '−' : '+' }}{{ m.quantity }}
            </p>
            <p v-if="m.unitPrice !== null" class="num text-[10.5px] whitespace-nowrap text-ink-700">
              {{ formatMoney(m.unitPrice) }} c/u
            </p>
            <p v-else class="text-[10.5px] whitespace-nowrap text-ink-500">sin precio</p>
            <p v-if="detailed" class="num text-[10.5px] text-ink-500">
              {{ m.stockBefore }}→{{ m.stockAfter }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
