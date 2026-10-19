<script setup lang="ts">
import type { Product } from '@/domain/models';
import Badge from './ui/Badge.vue';
import Icon from './ui/Icon.vue';

defineProps<{ product: Pick<Product, 'quantity' | 'isLowStock' | 'unit'> }>();
</script>

<template>
  <Badge v-if="product.quantity === 0" tone="danger"><Icon name="alert" :size="12" /> Agotado</Badge>
  <Badge v-else-if="product.isLowStock" tone="warning"><Icon name="alert" :size="12" /> Stock bajo</Badge>
  <Badge v-else tone="brand"><Icon name="check" :size="12" /> Disponible</Badge>
</template>
