<script setup lang="ts">
import { computed } from 'vue';
import type { MachineDisplay, OkAction } from '@/composables/useVendingMachine';
import Icon from '../ui/Icon.vue';

/**
 * Teclado de la máquina (mockup Main): pantalla oscura con lo marcado (PIN o código de administrador),
 * dígitos, borrar, C y OK (Retirar / Entrar).
 */
const props = defineProps<{
  display: MachineDisplay;
  okAction: OkAction;
  okEnabled: boolean;
  busy?: boolean;
  large?: boolean;
}>();
const emit = defineEmits<{
  digit: [d: string];
  back: [];
  clear: [];
  ok: [];
}>();

const okHint = computed(() =>
  props.busy ? '…' : props.okAction === 'withdraw' ? 'Retirar' : 'Entrar',
);
const typed = computed(() => props.display.big.replace(/[^●]/g, '').length);
</script>

<template>
  <section class="keypad" :class="{ 'is-large': large }" aria-label="Teclado">
    <div class="screen">
      <div class="min-w-0 flex-1">
        <span class="screen-label">
          {{ display.label }}
          <svg
            v-if="display.showLock"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6E93AE"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            role="img"
            aria-label="Los administradores también entran escribiendo su código"
          >
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          </svg>
        </span>
        <span class="screen-big" :aria-label="`${display.label}: ${typed} dígitos`">{{ display.big }}</span>
        <span class="screen-sub" :class="{ error: display.isError }" aria-live="polite">{{ display.sub }}</span>
      </div>
    </div>

    <div class="keys">
      <template v-for="d in ['1', '2', '3']" :key="d">
        <button type="button" class="key press" @click="emit('digit', d)">{{ d }}</button>
      </template>
      <button type="button" class="key key-soft press" aria-label="Borrar el último dígito" @click="emit('back')">
        <Icon name="backspace" :size="22" :stroke="2" />
      </button>
      <template v-for="d in ['4', '5', '6']" :key="d">
        <button type="button" class="key press" @click="emit('digit', d)">{{ d }}</button>
      </template>
      <button type="button" class="key key-soft key-c press" aria-label="Limpiar" @click="emit('clear')">C</button>
      <template v-for="d in ['7', '8', '9']" :key="d">
        <button type="button" class="key press" @click="emit('digit', d)">{{ d }}</button>
      </template>
      <button
        type="button"
        class="key-ok press"
        :class="{ admin: okAction === 'admin', ready: okEnabled }"
        :disabled="!okEnabled || busy"
        :aria-label="`OK, ${okHint}`"
        @click="emit('ok')"
      >
        OK<span>{{ okHint }}</span>
      </button>
      <button type="button" class="key key-zero press" @click="emit('digit', '0')">0</button>
    </div>
  </section>
</template>

<style scoped>
.keypad {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border-radius: 22px;
  background: rgb(255 255 255 / 0.58);
  border: 1px solid rgb(255 255 255 / 0.85);
  box-shadow:
    0 10px 28px rgb(7 59 94 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  backdrop-filter: blur(20px) saturate(160%);
}
.screen {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-radius: 14px;
  background: #06304d;
  box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.35);
}
.screen > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.screen-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #9fd3f5;
}
.screen-big {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 3px;
  line-height: 1.15;
  color: #ffb46b;
  white-space: pre;
}
.screen-sub {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  color: #e2eef7;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.screen-sub.error {
  font-weight: 800;
  color: #ff9c8f;
  white-space: normal;
}
.keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 46px;
  gap: 6px;
}
.key {
  border-radius: 12px;
  border: 1px solid rgb(255 255 255 / 0.95);
  background: rgb(255 255 255 / 0.78);
  box-shadow: 0 1px 2px rgb(7 59 94 / 0.1);
  color: var(--color-ink-900);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
}
.key-soft {
  display: grid;
  place-items: center;
  border-color: rgb(255 255 255 / 0.7);
  background: rgb(7 59 94 / 0.07);
  box-shadow: none;
  color: var(--color-ink-700);
}
.key-c {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 900;
}
.key-zero {
  grid-column: span 3;
}
.key-ok {
  grid-row: span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 12px;
  background: var(--color-accent-500);
  color: var(--color-ink-900);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 900;
}
.key-ok span {
  font-size: 10px;
  font-weight: 800;
}
.key-ok.ready {
  box-shadow: 0 6px 16px rgb(255 138 31 / 0.35);
}
.key-ok.admin {
  background: var(--color-ink-900);
  color: #fff;
  box-shadow: none;
}

/* Tablet: teclas grandes (mockup MaquinaTablet). */
.keypad.is-large {
  flex: 1;
  gap: 14px;
  padding: 14px;
  border-radius: 26px;
}
.is-large .screen {
  min-height: 100px;
  padding: 12px 14px 12px 18px;
  border-radius: 18px;
}
.is-large .screen-label {
  font-size: 12px;
}
.is-large .screen-big {
  font-size: 32px;
}
.is-large .screen-sub {
  font-size: 14px;
}
.is-large .keys {
  flex: 1;
  grid-auto-rows: minmax(54px, 1fr);
  gap: 10px;
}
.is-large .key,
.is-large .key-ok {
  border-radius: 16px;
  font-size: 26px;
}
.is-large .key-ok span {
  font-size: 13px;
}
</style>
