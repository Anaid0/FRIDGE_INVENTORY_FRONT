<script setup lang="ts">
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import type { MovementView } from '@/domain/models';
import { formatRelative, fullName, withUnit } from '@/utils/format';

defineProps<{ movements: MovementView[] }>();
</script>

<template>
  <div class="mx-auto max-w-3xl rounded-2xl bg-white shadow-sm">
    <p v-if="!movements.length" class="py-10 text-center text-ink-500">Todavía no hay movimientos.</p>
    <ul class="divide-y divide-ink-100">
      <li v-for="m in movements" :key="m.id" class="flex items-center gap-4 px-5 py-4">
        <MovementTypeBadge :type="m.type" :source="m.source" />
        <p class="min-w-0 flex-1 text-base text-ink-800">
          <template v-if="m.source === 'PURCHASE_VOID'">
            Se anuló una compra: salieron {{ withUnit(m.quantity, m.product.unit) }} de
            <strong>{{ m.product.name }}</strong>
          </template>
          <template v-else>
            <strong>{{ fullName(m.performedBy) }}</strong>
            {{ m.source === 'PURCHASE' ? 'compró' : m.type === 'OUT' ? 'sacó' : 'metió' }}
            {{ withUnit(m.quantity, m.product.unit) }} de <strong>{{ m.product.name }}</strong>
          </template>
        </p>
        <time class="shrink-0 text-sm text-ink-500" :datetime="m.createdAt">{{
          formatRelative(m.createdAt)
        }}</time>
      </li>
    </ul>
  </div>
</template>
