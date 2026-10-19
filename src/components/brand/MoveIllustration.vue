<script setup lang="ts">
import type { MovementType } from '@/domain/models';

/**
 * Ilustraciones "Sacar" (el mono saca un banano, −1) y "Meter" (guarda su coca de almuerzo, +1),
 * de design-assets/. Animaciones (se detienen si el sistema pide reducir el movimiento):
 * - `animated` (por defecto): el brazo del mono saca el banano / mete la coca, una y otra vez.
 * - `celebrate`: además la flecha empuja y la insignia −1/+1 aparece de un salto (pantalla de "¡Listo!").
 * `count` (opcional) cambia el número de la insignia (p. ej. −3 si se sacaron 3 unidades).
 */
const props = withDefaults(
  defineProps<{
    type: MovementType;
    animated?: boolean;
    celebrate?: boolean;
    decorative?: boolean;
    count?: number;
  }>(),
  { animated: true, celebrate: false, decorative: false, count: 1 },
);

const label =
  props.type === 'OUT'
    ? 'El mono de FridgeYA saca un banano de la nevera'
    : 'El mono de FridgeYA guarda su coca de almuerzo en la nevera';
</script>

<template>
  <svg
    viewBox="0 0 520 440"
    :class="{ 'fy-animated': animated, 'fy-celebrate': celebrate, 'fy-in': type === 'IN' }"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <ellipse cx="270" cy="400" rx="230" ry="14" fill="#cfe8f7" />
    <rect x="60" y="40" width="210" height="350" rx="24" fill="#cfe8f7" stroke="#0b79c3" stroke-width="8" />
    <line x1="60" y1="150" x2="270" y2="150" stroke="#0b79c3" stroke-width="8" />
    <rect x="90" y="88" width="30" height="30" rx="6" fill="#ffffff" stroke="#7fbde6" stroke-width="4" />
    <rect x="128" y="96" width="24" height="24" rx="5" fill="#ffffff" stroke="#7fbde6" stroke-width="4" />
    <line x1="72" y1="240" x2="258" y2="240" stroke="#7fbde6" stroke-width="6" stroke-linecap="round" />
    <line x1="72" y1="330" x2="258" y2="330" stroke="#7fbde6" stroke-width="6" stroke-linecap="round" />
    <rect x="92" y="180" width="26" height="58" rx="8" fill="#ff8a1f" />
    <rect x="98" y="170" width="14" height="14" rx="3" fill="#073b5e" />
    <template v-if="type === 'OUT'">
      <rect x="140" y="206" width="70" height="32" rx="6" fill="#ffffff" stroke="#0b79c3" stroke-width="4" />
      <rect x="134" y="198" width="82" height="12" rx="5" fill="#0b79c3" />
    </template>
    <rect
      v-else
      x="142"
      y="206"
      width="66"
      height="30"
      rx="8"
      fill="none"
      stroke="#7fbde6"
      stroke-width="4"
      stroke-dasharray="8 7"
    />
    <rect x="98" y="270" width="40" height="58" rx="4" fill="#ffffff" stroke="#0b79c3" stroke-width="4" />
    <path
      d="M98 284 L118 270 L138 284"
      fill="none"
      stroke="#0b79c3"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <circle cx="190" cy="308" r="20" fill="#e84a5f" />
    <path
      d="M190 290 Q196 280 204 282"
      stroke="#2f8a4f"
      stroke-width="4"
      fill="none"
      stroke-linecap="round"
    />
    <path
      d="M270 40 L340 70 L340 370 L270 390 Z"
      fill="#ffffff"
      stroke="#0b79c3"
      stroke-width="8"
      stroke-linejoin="round"
    />
    <line x1="326" y1="160" x2="326" y2="230" stroke="#073b5e" stroke-width="8" stroke-linecap="round" />

    <g transform="translate(330,150) scale(0.8)">
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
      <circle cx="74" cy="92" r="9" fill="#073b5e" />
      <circle cx="114" cy="92" r="9" fill="#073b5e" />
      <circle cx="76" cy="89" r="3" fill="#ffffff" />
      <circle cx="116" cy="89" r="3" fill="#ffffff" />
      <circle cx="94" cy="114" r="3" fill="#0b79c3" />
      <circle cx="106" cy="114" r="3" fill="#0b79c3" />
      <path
        v-if="type === 'OUT'"
        d="M82 128 Q102 146 120 126"
        stroke="#0b79c3"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
      <path
        v-else
        d="M84 128 Q100 150 116 128 Z"
        fill="#073b5e"
        stroke="#073b5e"
        stroke-width="4"
        stroke-linejoin="round"
      />
    </g>

    <!-- Brazo (gira sobre el hombro, que queda dentro del cuerpo) y lo que lleva en la mano -->
    <g class="fy-arm">
      <template v-if="type === 'OUT'">
        <path
          d="M372 340 Q310 336 254 294"
          stroke="#0b79c3"
          stroke-width="20"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M212 256 Q236 304 296 276 Q246 290 212 256 Z"
          fill="#ffc93c"
          stroke="#d9a21b"
          stroke-width="3"
          stroke-linejoin="round"
        />
        <circle cx="252" cy="290" r="15" fill="#0b79c3" />
      </template>
      <template v-else>
        <path
          d="M372 336 Q310 330 262 290"
          stroke="#0b79c3"
          stroke-width="20"
          fill="none"
          stroke-linecap="round"
        />
        <rect
          x="198"
          y="262"
          width="74"
          height="34"
          rx="8"
          fill="#ffffff"
          stroke="#0b79c3"
          stroke-width="4"
        />
        <rect x="192" y="252" width="86" height="14" rx="6" fill="#0b79c3" />
        <circle cx="262" cy="292" r="15" fill="#0b79c3" />
      </template>
    </g>

    <g class="fy-arrow">
      <template v-if="type === 'OUT'">
        <path d="M360 78 L456 78" stroke="#ff8a1f" stroke-width="14" stroke-linecap="round" />
        <path
          d="M444 54 L484 78 L444 102 Z"
          fill="#ff8a1f"
          stroke="#ff8a1f"
          stroke-width="6"
          stroke-linejoin="round"
        />
      </template>
      <template v-else>
        <path d="M484 78 L392 78" stroke="#1f9d63" stroke-width="14" stroke-linecap="round" />
        <path
          d="M402 54 L362 78 L402 102 Z"
          fill="#1f9d63"
          stroke="#1f9d63"
          stroke-width="6"
          stroke-linejoin="round"
        />
      </template>
    </g>

    <g class="fy-badge">
      <circle cx="64" cy="44" r="32" fill="#073b5e" stroke="#e6f3fb" stroke-width="6" />
      <text
        x="64"
        :y="count > 9 ? 52 : 55"
        text-anchor="middle"
        font-family="'Nunito Variable', Nunito, sans-serif"
        :font-size="count > 99 ? 18 : count > 9 ? 23 : 30"
        font-weight="900"
        fill="#ffffff"
        v-text="`${type === 'OUT' ? '−' : '+'}${count}`"
      />
    </g>
  </svg>
</template>

<style scoped>
@keyframes fy-push {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(12px);
  }
}
@keyframes fy-pull {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-12px);
  }
}
/* Sacar: mete la mano un poco más, saca el banano hacia arriba y vuelve. */
@keyframes fy-take {
  0%,
  100% {
    transform: rotate(0) scale(1);
  }
  30% {
    transform: rotate(-3deg) scale(1.06);
  }
  65% {
    transform: rotate(9deg) scale(0.88);
  }
}
/* Meter: empuja la coca hacia adentro de la nevera y retrocede. */
@keyframes fy-store {
  0%,
  100% {
    transform: rotate(2deg) scale(0.94);
  }
  45% {
    transform: rotate(-4deg) scale(1.08);
  }
  60% {
    transform: rotate(-4deg) scale(1.08);
  }
}
@keyframes fy-pop {
  0% {
    transform: scale(0);
  }
  70% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .fy-animated .fy-arm {
    transform-box: view-box;
    transform-origin: 372px 340px;
    animation: fy-take 2.2s ease-in-out infinite;
  }
  .fy-animated.fy-in .fy-arm {
    transform-origin: 372px 336px;
    animation-name: fy-store;
  }
  .fy-celebrate .fy-arrow {
    animation: fy-push 1.2s ease-in-out 0.3s 3;
  }
  .fy-celebrate.fy-in .fy-arrow {
    animation-name: fy-pull;
  }
  .fy-celebrate .fy-badge {
    transform-box: view-box;
    transform-origin: 64px 44px;
    animation: fy-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
}
</style>
