<script setup lang="ts">
import type { PeriodStatus } from '@/domain/models';
import Badge from './ui/Badge.vue';
import Icon from './ui/Icon.vue';

defineProps<{ status: PeriodStatus }>();
</script>

<template>
  <Badge v-if="status === 'OPEN'" tone="brand"><Icon name="check" :size="12" /> Abierta</Badge>
  <Badge v-else tone="neutral"><Icon name="lock" :size="12" /> Cerrada</Badge>
</template>
