<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { TopWithdrawer } from '@/domain/models';
import FridgeLogo from '../brand/FridgeLogo.vue';
import Icon from '../ui/Icon.vue';

/**
 * Cabecera de la máquina (mockup Main): logo, "Más retira" (lleva al ranking) y el reloj (historial).
 * `compact`: sin logo (en la tablet el logo va dentro del mueble).
 * `admin`: candado para que un administrador llegue al teclado y escriba su código (celular).
 */
const props = defineProps<{ top: TopWithdrawer | null; compact?: boolean; long?: boolean; admin?: boolean }>();
const emit = defineEmits<{ admin: [] }>();

/** "David O." en el celular; "David Ospino" en la tablet. */
const name = computed(() => {
  const user = props.top?.user;
  if (!user) return 'Nadie aún';
  return props.long ? `${user.name} ${user.lastname}` : `${user.name} ${user.lastname.charAt(0)}.`;
});
const label = computed(() =>
  props.top
    ? `Quien más retira: ${props.top.user.name} ${props.top.user.lastname}, ${props.top.totalWithdrawn} unidades. Ver ranking`
    : 'Ranking',
);
</script>

<template>
  <header class="flex items-center justify-between gap-2">
    <div v-if="!compact" class="flex items-center gap-2">
      <FridgeLogo variant="mini" class="size-[30px]" />
      <span class="font-display text-lg font-black tracking-[-0.4px] text-ink-900">
        Fridge<span class="text-brand-600">YA</span>
      </span>
    </div>
    <div class="flex min-w-0 items-center gap-1.5" :class="{ 'flex-1': compact }">
      <RouterLink to="/ranking" class="top-chip" :class="{ 'flex-1': compact }" :aria-label="label">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe2c4]">
          <svg width="24" height="24" viewBox="0 18 200 164" aria-hidden="true">
            <circle cx="28" cy="100" r="24" fill="#0b79c3" />
            <circle cx="172" cy="100" r="24" fill="#0b79c3" />
            <circle cx="100" cy="100" r="74" fill="#0b79c3" />
            <circle cx="78" cy="90" r="28" fill="#fff" />
            <circle cx="122" cy="90" r="28" fill="#fff" />
            <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
            <circle cx="80" cy="90" r="11" fill="#073b5e" />
            <circle cx="120" cy="90" r="11" fill="#073b5e" />
            <ellipse cx="100" cy="136" rx="18" ry="14" fill="#073b5e" />
          </svg>
        </span>
        <span class="flex min-w-0 flex-col leading-[1.05]">
          <span class="text-[10px] font-bold text-ink-500">{{ long ? 'Quien más retira' : 'Más retira' }}</span>
          <span class="truncate font-display text-[13px] font-black text-ink-900">
            {{ name }}<template v-if="top">
              · <span class="text-accent-700">{{ top.totalWithdrawn }}{{ long ? ' und.' : '' }}</span></template
            >
          </span>
        </span>
      </RouterLink>
      <RouterLink to="/historial" class="round-btn" aria-label="Historial">
        <Icon name="clock" :size="18" :stroke="2.2" />
      </RouterLink>
      <button v-if="admin" type="button" class="round-btn" aria-label="Administración" @click="emit('admin')">
        <Icon name="lock" :size="17" :stroke="2.2" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-chip,
.round-btn {
  height: 40px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.6);
  border: 1px solid rgb(255 255 255 / 0.85);
  box-shadow: 0 4px 14px rgb(7 59 94 / 0.08);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.top-chip {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 3px;
}
.round-btn {
  display: grid;
  width: 40px;
  flex-shrink: 0;
  place-items: center;
  color: var(--color-ink-700);
}
</style>
