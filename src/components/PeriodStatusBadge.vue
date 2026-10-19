<script setup lang="ts">
import type { PeriodStatus } from '@/domain/models';
import Badge from './ui/Badge.vue';

defineProps<{ status: PeriodStatus }>();
</script>

<template>
  <Badge v-if="status === 'OPEN'" tone="success">Abierta</Badge>
  <Badge v-else tone="neutral">Cerrada</Badge>
</template>
