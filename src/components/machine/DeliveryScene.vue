<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { joinList } from '../kiosk/kioskText';
import Icon from '../ui/Icon.vue';
import ProductArt from './ProductArt.vue';

/** Cómo va la persona en la quincena abierta (se calcula tras registrar). */
export interface DeliveryStanding {
  units: number;
  position: number;
}

export interface DeliveryLine {
  name: string;
  quantity: number;
}

/**
 * Entrega del producto (mockups Entrega, Listo y EntregaError):
 * - `processing`: el mono espera dentro de la máquina mientras el servidor registra el retiro.
 * - `delivered`: el mono deja caer los productos en la bandeja, que se ilumina, y aparece "¡Listo!"
 *   con cuánto lleva en la quincena; vuelve sola a la máquina tras `seconds`.
 * - `error`: el mono se rasca la cabeza junto a la bandeja vacía; no se descontó nada.
 */
const props = withDefaults(
  defineProps<{
    phase: 'processing' | 'delivered' | 'error';
    lines: DeliveryLine[];
    personName?: string | null;
    standing?: DeliveryStanding | null;
    errorTitle?: string;
    errorText?: string;
    seconds?: number;
  }>(),
  { personName: null, standing: null, errorTitle: '', errorText: '', seconds: 5 },
);
const emit = defineEmits<{ done: []; retry: []; back: [] }>();

/** Hasta 3 productos caen a la bandeja (uno por línea). */
const falling = computed(() => props.lines.slice(0, 3));
const summary = computed(() => joinList(props.lines.map((l) => `${l.quantity} ${l.name}`)));
const total = computed(() => props.lines.reduce((sum, l) => sum + l.quantity, 0));

/** La tarjeta "¡Listo!" sale cuando los productos ya cayeron. */
const showCard = ref(false);
const remaining = ref(props.seconds);
let cardTimer: ReturnType<typeof setTimeout> | undefined;
let countdown: ReturnType<typeof setInterval> | undefined;

function stopTimers() {
  clearTimeout(cardTimer);
  clearInterval(countdown);
}

watch(
  () => props.phase,
  (phase) => {
    stopTimers();
    showCard.value = false;
    if (phase !== 'delivered') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    cardTimer = setTimeout(
      () => {
        showCard.value = true;
        remaining.value = props.seconds;
        countdown = setInterval(() => {
          remaining.value -= 1;
          if (remaining.value <= 0) {
            stopTimers();
            emit('done');
          }
        }, 1000);
      },
      reduced ? 0 : 1500,
    );
  },
  { immediate: true },
);
onBeforeUnmount(stopTimers);

/** Dónde arranca cada producto (en la mano del mono) y dónde cae en la bandeja. */
const DROPS = [
  { x: 198, y: 214, dx: -25, dy: 232, delay: 0.15 },
  { x: 220, y: 192, dx: -40, dy: 240, delay: 0.35 },
  { x: 176, y: 204, dx: 10, dy: 236, delay: 0.55 },
];
</script>

<template>
  <div class="scene" :class="phase">
    <div class="status glass-strong" role="status">
      <template v-if="phase === 'processing'">
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B79C3" stroke-width="3" stroke-linecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
        Procesando tu retiro…
      </template>
      <span v-else-if="phase === 'delivered'" class="flex items-center gap-2 text-success-700">
        <Icon name="check" :size="16" :stroke="3" /> Producto entregado
      </span>
      <span v-else class="flex items-center gap-2 text-danger-700">
        <Icon name="alert" :size="16" :stroke="2.6" /> No se pudo registrar el retiro
      </span>
    </div>

    <!-- La máquina con el mono -->
    <svg
      v-if="phase !== 'error'"
      class="machine"
      viewBox="0 0 310 520"
      role="img"
      :aria-label="
        phase === 'delivered'
          ? 'El mono de FridgeYA deja caer tus productos en la bandeja de la máquina'
          : 'El mono de FridgeYA busca tus productos dentro de la máquina'
      "
    >
      <defs>
        <linearGradient id="dv-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0A4A75" />
          <stop offset="1" stop-color="#06304D" />
        </linearGradient>
      </defs>
      <rect x="0" y="24" width="310" height="496" rx="30" fill="url(#dv-body)" />
      <rect x="20" y="40" width="270" height="28" rx="9" fill="rgba(255,255,255,0.10)" />
      <text x="155" y="59" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="900" letter-spacing="3" fill="#9FD3F5">FRIDGEYA</text>
      <rect x="20" y="82" width="270" height="318" rx="20" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
      <rect x="32" y="164" width="38" height="44" rx="8" fill="rgba(255,255,255,0.16)" />
      <rect x="240" y="164" width="38" height="44" rx="8" fill="rgba(255,255,255,0.16)" />
      <line x1="28" y1="214" x2="282" y2="214" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round" />
      <rect x="32" y="256" width="38" height="44" rx="8" fill="rgba(255,255,255,0.16)" />
      <rect x="250" y="256" width="30" height="44" rx="8" fill="rgba(255,255,255,0.16)" />
      <line x1="28" y1="304" x2="282" y2="304" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round" />
      <line x1="28" y1="384" x2="282" y2="384" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round" />

      <g class="bob">
        <g transform="translate(100,144) scale(0.55)">
          <ellipse cx="100" cy="232" rx="62" ry="60" fill="#0b79c3" />
          <ellipse cx="100" cy="244" rx="38" ry="40" fill="#ffffff" />
          <circle cx="28" cy="100" r="24" fill="#0b79c3" />
          <circle cx="172" cy="100" r="24" fill="#0b79c3" />
          <circle cx="28" cy="100" r="11" fill="#ffffff" />
          <circle cx="172" cy="100" r="11" fill="#ffffff" />
          <circle cx="100" cy="100" r="74" fill="#0b79c3" />
          <circle cx="78" cy="90" r="28" fill="#ffffff" />
          <circle cx="122" cy="90" r="28" fill="#ffffff" />
          <ellipse cx="100" cy="128" rx="40" ry="32" fill="#ffffff" />
          <circle cx="84" cy="96" r="9" fill="#073b5e" />
          <circle cx="124" cy="96" r="9" fill="#073b5e" />
          <circle cx="86" cy="93" r="3" fill="#ffffff" />
          <circle cx="126" cy="93" r="3" fill="#ffffff" />
          <circle cx="94" cy="114" r="3" fill="#0b79c3" />
          <circle cx="106" cy="114" r="3" fill="#0b79c3" />
          <path d="M82 128 Q102 148 120 126" stroke="#0b79c3" stroke-width="6" fill="none" stroke-linecap="round" />
        </g>
        <path d="M128 252 Q112 270 120 290" stroke="#0b79c3" stroke-width="15" fill="none" stroke-linecap="round" />
        <circle cx="120" cy="290" r="8" fill="#0b79c3" />
        <g class="arm">
          <path d="M182 252 Q206 262 214 244" stroke="#0b79c3" stroke-width="15" fill="none" stroke-linecap="round" />
          <circle cx="214" cy="244" r="8.5" fill="#0b79c3" />
        </g>
      </g>

      <!-- Tus productos: en la mano del mono y, al entregar, caen a la bandeja -->
      <g
        v-for="(drop, i) in falling"
        :key="i"
        class="drop"
        :style="{ '--dx': `${DROPS[i]!.dx}px`, '--dy': `${DROPS[i]!.dy}px`, '--delay': `${DROPS[i]!.delay}s` }"
      >
        <g :transform="`translate(${DROPS[i]!.x - 20},${DROPS[i]!.y - 20})`">
          <ProductArt :name="drop.name" :size="40" />
        </g>
      </g>

      <rect x="40" y="420" width="230" height="72" rx="16" fill="rgba(0,0,0,0.32)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" />
      <rect class="flash" x="40" y="420" width="230" height="72" rx="16" fill="#FFB46B" />
      <text x="155" y="510" text-anchor="middle" font-family="Nunito, sans-serif" font-size="10" font-weight="800" letter-spacing="2.5" fill="#9FD3F5">RETIRA AQUÍ</text>
    </svg>

    <!-- Error: el mono se rasca la cabeza junto a la bandeja vacía -->
    <svg v-else class="machine machine-error" viewBox="0 0 310 400" role="img" aria-label="El mono de FridgeYA se rasca la cabeza junto a la bandeja vacía">
      <defs>
        <linearGradient id="dv-body2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0A4A75" />
          <stop offset="1" stop-color="#06304D" />
        </linearGradient>
      </defs>
      <rect x="0" y="24" width="310" height="376" rx="30" fill="url(#dv-body2)" />
      <rect x="20" y="40" width="270" height="250" rx="20" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
      <line x1="28" y1="284" x2="282" y2="284" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round" />
      <g class="scratch">
        <g transform="translate(100,124) scale(0.55)">
          <ellipse cx="100" cy="232" rx="62" ry="60" fill="#0b79c3" />
          <ellipse cx="100" cy="244" rx="38" ry="40" fill="#ffffff" />
          <circle cx="28" cy="100" r="24" fill="#0b79c3" />
          <circle cx="172" cy="100" r="24" fill="#0b79c3" />
          <circle cx="28" cy="100" r="11" fill="#ffffff" />
          <circle cx="172" cy="100" r="11" fill="#ffffff" />
          <circle cx="100" cy="100" r="74" fill="#0b79c3" />
          <circle cx="78" cy="90" r="28" fill="#ffffff" />
          <circle cx="122" cy="90" r="28" fill="#ffffff" />
          <ellipse cx="100" cy="128" rx="40" ry="32" fill="#ffffff" />
          <circle cx="80" cy="94" r="9" fill="#073b5e" />
          <circle cx="120" cy="94" r="9" fill="#073b5e" />
          <path d="M62 70 L92 78 M138 70 L108 78" stroke="#073b5e" stroke-width="6" stroke-linecap="round" />
          <path d="M84 138 Q100 126 116 138" stroke="#0b79c3" stroke-width="6" fill="none" stroke-linecap="round" />
        </g>
        <g class="scratch-arm">
          <path d="M182 232 Q206 200 196 168" stroke="#0b79c3" stroke-width="15" fill="none" stroke-linecap="round" />
          <circle cx="194" cy="166" r="8.5" fill="#0b79c3" />
        </g>
        <path d="M128 232 Q112 250 120 270" stroke="#0b79c3" stroke-width="15" fill="none" stroke-linecap="round" />
        <text x="214" y="142" font-family="Nunito, sans-serif" font-size="30" font-weight="900" fill="#FFB46B">?</text>
      </g>
      <rect x="40" y="306" width="230" height="64" rx="16" fill="rgba(0,0,0,0.32)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" />
      <text x="155" y="343" text-anchor="middle" font-family="Nunito, sans-serif" font-size="10" font-weight="800" letter-spacing="2.5" fill="#6E93AE">BANDEJA VACÍA</text>
    </svg>

    <!-- ¡Listo! -->
    <Transition name="card">
      <section v-if="phase === 'delivered' && showCard" class="card-done glass-strong" aria-label="Confirmación">
        <div class="flex items-center gap-2.5">
          <span class="grid size-[34px] shrink-0 place-items-center rounded-full bg-success-700 text-white">
            <Icon name="check" :size="18" :stroke="3" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-display text-[17px] font-black text-ink-900">
              ¡Listo{{ personName ? `, ${personName}` : '' }}!
            </p>
            <p class="text-[13px] text-ink-700">
              Retiraste {{ summary }}<template v-if="standing"> · llevas {{ standing.units }} esta quincena</template>
            </p>
          </div>
        </div>
        <div v-if="standing" class="stats">
          <div>
            <span>Esta quincena</span>
            <strong>{{ standing.units }} {{ standing.units === 1 ? 'unidad' : 'unidades' }}</strong>
          </div>
          <div>
            <span>Ranking</span>
            <strong class="text-accent-700">{{ standing.position === 1 ? 'Vas #1' : `Vas #${standing.position}` }}</strong>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="h-1 flex-1 overflow-hidden rounded-full bg-ink-900/10" aria-hidden="true">
            <span class="bar block h-full bg-brand-600" :style="{ animationDuration: `${seconds}s` }" />
          </span>
          <button type="button" class="min-h-9 px-1 text-[13px] font-extrabold text-brand-700" @click="emit('done')">
            Volver ahora
          </button>
        </div>
        <p class="sr-only" aria-live="polite">Volviendo a la máquina en {{ remaining }} segundos</p>
      </section>
    </Transition>

    <template v-if="phase === 'error'">
      <section class="card-done glass-strong" aria-label="Qué pasó">
        <h1 class="font-display text-[18px] font-black text-ink-900">{{ errorTitle }}</h1>
        <p class="text-[13px] text-ink-700">
          {{ errorText }} Tu retiro sigue guardado ({{ summary }}).
        </p>
      </section>
      <div class="error-actions">
        <button type="button" class="btn-secondary min-h-12 flex-1 rounded-[14px]! text-[15px]!" @click="emit('back')">
          Volver a la máquina
        </button>
        <button type="button" class="btn-accent min-h-12 flex-1 rounded-[14px]! font-display text-[15px]! font-black!" @click="emit('retry')">
          <Icon name="refresh" :size="16" :stroke="2.6" /> Reintentar
        </button>
      </div>
    </template>
    <p class="sr-only">{{ total }} productos</p>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  width: 100%;
  max-width: 420px;
  min-height: 100%;
  margin: 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: calc(var(--ion-safe-area-top) + 2.5rem) 16px calc(var(--ion-safe-area-bottom) + 1.5rem);
}
.status {
  height: 40px;
  min-width: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 999px;
  color: var(--color-ink-900);
  font-size: 13px;
  font-weight: 800;
}
.spin {
  animation: spin 0.9s linear infinite;
}
.machine {
  width: 100%;
  max-width: 310px;
  height: auto;
  max-height: 58dvh;
}
.machine-error {
  max-height: 46dvh;
}
.card-done {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 18px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #cfe3f1;
}
.stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stats div + div {
  padding-left: 12px;
  border-left: 1px solid #e1ecf4;
}
.stats span {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-ink-500);
}
.stats strong {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 900;
  color: var(--color-ink-900);
}
.stats strong.text-accent-700 {
  color: var(--color-accent-700);
}
.bar {
  transform-origin: left;
  animation: countdown linear forwards;
}
.error-actions {
  width: 100%;
  margin-top: auto;
  display: flex;
  gap: 10px;
}

/* --- Animaciones (mockup Entrega) --- */
.bob {
  animation: bob 1.6s ease-in-out infinite;
}
.arm {
  transform-box: view-box;
  transform-origin: 182px 252px;
}
.delivered .arm {
  animation: arm 1s ease-in-out both;
}
.drop {
  transform-box: fill-box;
  transform-origin: center;
}
.delivered .drop {
  animation: fall 1.1s cubic-bezier(0.55, 0, 0.9, 0.45) var(--delay) both;
}
.flash {
  opacity: 0;
}
.delivered .flash {
  animation: flash 1.2s ease-out 0.7s both;
}
.scratch-arm {
  transform-box: view-box;
  transform-origin: 182px 232px;
  animation: scratch 1.2s ease-in-out infinite;
}
.card-enter-active {
  transition:
    opacity 0.35s ease-out,
    transform 0.35s ease-out;
}
.card-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
@keyframes arm {
  0% {
    transform: rotate(0);
  }
  35% {
    transform: rotate(-22deg);
  }
  55% {
    transform: rotate(28deg);
  }
  100% {
    transform: rotate(0);
  }
}
@keyframes fall {
  0% {
    transform: translate(0, 0) rotate(-8deg);
  }
  70% {
    transform: translate(var(--dx), var(--dy)) rotate(190deg);
    animation-timing-function: ease-out;
  }
  82% {
    transform: translate(var(--dx), calc(var(--dy) - 12px)) rotate(184deg);
    animation-timing-function: ease-in;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) rotate(180deg);
  }
}
@keyframes flash {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 0.75;
  }
  100% {
    opacity: 0;
  }
}
@keyframes scratch {
  0%,
  100% {
    transform: rotate(0);
  }
  50% {
    transform: rotate(-10deg);
  }
}
@keyframes countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bob,
  .spin,
  .scratch-arm,
  .delivered .arm,
  .delivered .flash {
    animation: none;
  }
  .delivered .drop {
    animation: none;
    transform: translate(var(--dx), var(--dy)) rotate(180deg);
  }
  .bar {
    animation: none;
  }
}
</style>
