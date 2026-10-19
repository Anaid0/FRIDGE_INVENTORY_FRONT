<script setup lang="ts">
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import type { MovementView } from '@/domain/models';
import { formatRelative, fullName, withUnit } from '@/utils/format';
import Avatar from '../ui/Avatar.vue';

/** Historial: los últimos movimientos de la nevera (quién sacó o metió qué). */
defineProps<{ movements: MovementView[] }>();
</script>

<template>
  <section class="mx-auto w-full max-w-4xl" aria-labelledby="kiosk-log-title">
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h1 id="kiosk-log-title" class="text-[30px] font-black tracking-tight text-ink-900">Historial</h1>
      <p class="text-[15px] text-ink-500">Lo último que entró y salió de la nevera</p>
    </div>
    <p v-if="!movements.length" class="card py-10 text-center text-ink-500">Todavía no hay movimientos.</p>
    <ul class="space-y-2.5">
      <li
        v-for="m in movements"
        :key="m.id"
        class="glass flex items-center gap-3 rounded-[20px] px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5"
      >
        <Avatar :person="m.performedBy" size="md" />
        <div class="min-w-0 flex-1">
          <p class="text-base text-ink-700">
            <template v-if="m.source === 'PURCHASE_VOID'">
              Se anuló una compra: salieron {{ withUnit(m.quantity, m.product.unit) }} de
              <strong class="font-extrabold text-ink-900">{{ m.product.name }}</strong>
            </template>
            <template v-else>
              <strong class="font-extrabold text-ink-900">{{ fullName(m.performedBy) }}</strong>
              {{ m.source === 'PURCHASE' ? 'compró' : m.type === 'OUT' ? 'sacó' : 'metió' }}
              {{ withUnit(m.quantity, m.product.unit) }} de
              <strong class="font-extrabold text-ink-900">{{ m.product.name }}</strong>
            </template>
          </p>
          <time class="text-sm text-ink-500" :datetime="m.createdAt">{{ formatRelative(m.createdAt) }}</time>
        </div>
        <MovementTypeBadge :type="m.type" :source="m.source" class="shrink-0" />
      </li>
    </ul>
  </section>
</template>
