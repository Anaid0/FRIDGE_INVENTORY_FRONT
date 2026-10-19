<script setup lang="ts">
import type { MovementSource, MovementType } from '@/domain/models';
import Badge from './ui/Badge.vue';
import Icon from './ui/Icon.vue';

defineProps<{ type: MovementType; source: MovementSource }>();
</script>

<template>
  <Badge v-if="source === 'PURCHASE'" tone="info"><Icon name="cart" :size="12" /> Compra</Badge>
  <Badge v-else-if="source === 'PURCHASE_VOID'" tone="neutral"><Icon name="x" :size="12" /> Anulación</Badge>
  <Badge v-else-if="type === 'IN'" tone="brand"><Icon name="arrowDown" :size="12" /> Entrada</Badge>
  <Badge v-else tone="warning"><Icon name="arrowUp" :size="12" /> Salida</Badge>
</template>
