<script setup lang="ts">
import type { PeriodStatus } from '@/domain/models';

/**
 * Estado de una quincena (mockup Quincena): píldora verde "Abierta" o gris "Cerrada".
 * `small`: etiqueta cuadrada y pequeña, para listas (quincenas anteriores).
 */
withDefaults(defineProps<{ status: PeriodStatus; small?: boolean }>(), { small: false });
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center leading-none font-extrabold whitespace-nowrap"
    :class="[
      small ? 'h-[18px] rounded-md px-1.5 text-[10px]' : 'h-[26px] rounded-full px-2.5 text-[11px]',
      status === 'OPEN' ? 'bg-success-50 text-success-700' : 'bg-ink-900/8 text-ink-700',
    ]"
  >
    {{ status === 'OPEN' ? 'Abierta' : 'Cerrada' }}
  </span>
</template>
