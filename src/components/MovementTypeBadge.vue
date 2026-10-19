<script setup lang="ts">
import type { MovementSource, MovementType } from '@/domain/models';
import Badge from './ui/Badge.vue';
import Icon from './ui/Icon.vue';

/** Salida (naranja), Entrada (verde), Compra (azul) o Anulación. Con `plain`, sin flecha (resumen del inicio). */
withDefaults(defineProps<{ type: MovementType; source: MovementSource; plain?: boolean }>(), {
  plain: false,
});
</script>

<template>
  <Badge v-if="source === 'PURCHASE'" tone="info"
    ><Icon v-if="!plain" name="cart" :size="12" :stroke="2.25" /> Compra</Badge
  >
  <Badge v-else-if="source === 'PURCHASE_VOID'" tone="neutral"
    ><Icon v-if="!plain" name="x" :size="12" :stroke="2.25" /> Anulación</Badge
  >
  <Badge v-else-if="type === 'IN'" tone="success"
    ><Icon v-if="!plain" name="arrowDown" :size="12" :stroke="2.25" /> Entrada</Badge
  >
  <Badge v-else tone="accent"><Icon v-if="!plain" name="arrowUp" :size="12" :stroke="2.25" /> Salida</Badge>
</template>
