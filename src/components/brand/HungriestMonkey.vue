<script setup lang="ts">
/**
 * "Más hambriento de la quincena" de design-assets/: el mono con babero, tenedor y cuchillo, la
 * medalla #1 y el calendario de la quincena. Con `animated` (por defecto) golpea la mesa con los cubiertos,
 * una mano y luego la otra; se detiene si el sistema pide reducir el movimiento.
 */
withDefaults(defineProps<{ decorative?: boolean; animated?: boolean }>(), {
  decorative: false,
  animated: true,
});
</script>

<template>
  <svg
    viewBox="0 0 520 440"
    :class="{ 'fy-animated': animated }"
    :role="decorative ? undefined : 'img'"
    :aria-label="
      decorative
        ? undefined
        : 'El mono de FridgeYA con babero, tenedor y cuchillo, con medalla de más hambriento de la quincena'
    "
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <circle cx="260" cy="210" r="172" fill="#ffe2c4" />
    <ellipse cx="260" cy="404" rx="200" ry="14" fill="#cfe8f7" />
    <path
      d="M60 392 Q80 360 100 392 Q90 378 80 384 Q70 378 60 392 Z"
      fill="#ffc93c"
      stroke="#d9a21b"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path
      d="M410 398 Q432 366 456 396 Q444 382 433 388 Q422 382 410 398 Z"
      fill="#ffc93c"
      stroke="#d9a21b"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <rect x="352" y="356" width="56" height="32" rx="8" fill="#ffffff" stroke="#0b79c3" stroke-width="4" />
    <rect x="346" y="346" width="68" height="12" rx="5" fill="#0b79c3" transform="rotate(-18 380 352)" />

    <!-- Tenedor y cuchillo: detrás del cuerpo, pero se mueven junto con su mano (mismo giro y hombro). -->
    <g class="fy-left">
      <line x1="140" y1="252" x2="140" y2="150" stroke="#8a99a6" stroke-width="9" stroke-linecap="round" />
      <line x1="128" y1="150" x2="128" y2="122" stroke="#8a99a6" stroke-width="6" stroke-linecap="round" />
      <line x1="140" y1="150" x2="140" y2="118" stroke="#8a99a6" stroke-width="6" stroke-linecap="round" />
      <line x1="152" y1="150" x2="152" y2="122" stroke="#8a99a6" stroke-width="6" stroke-linecap="round" />
      <path
        d="M126 148 Q140 160 154 148"
        stroke="#8a99a6"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"
      />
    </g>
    <g class="fy-right">
      <line x1="380" y1="252" x2="380" y2="200" stroke="#8a99a6" stroke-width="9" stroke-linecap="round" />
      <path
        d="M372 204 L372 130 Q372 112 390 116 L390 204 Z"
        fill="#c4ced6"
        stroke="#8a99a6"
        stroke-width="4"
        stroke-linejoin="round"
      />
    </g>

    <g transform="translate(160,30)">
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
      <circle cx="80" cy="88" r="12" fill="#073b5e" />
      <circle cx="120" cy="88" r="12" fill="#073b5e" />
      <circle cx="84" cy="84" r="4" fill="#ffffff" />
      <circle cx="124" cy="84" r="4" fill="#ffffff" />
      <circle cx="77" cy="93" r="2" fill="#ffffff" />
      <circle cx="117" cy="93" r="2" fill="#ffffff" />
      <circle cx="94" cy="112" r="3" fill="#0b79c3" />
      <circle cx="106" cy="112" r="3" fill="#0b79c3" />
      <ellipse cx="100" cy="136" rx="20" ry="16" fill="#073b5e" />
      <ellipse cx="100" cy="144" rx="11" ry="7" fill="#ff7a8a" />
      <path d="M118 142 Q124 156 120 166 Q114 160 118 142 Z" fill="#8fd0f5" />
      <path
        d="M66 162 L134 162 L100 206 Z"
        fill="#ffffff"
        stroke="#7fbde6"
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="88" cy="172" r="4" fill="#ff8a1f" />
      <circle cx="108" cy="176" r="4" fill="#ff8a1f" />
      <circle cx="99" cy="190" r="4" fill="#ff8a1f" />
    </g>
    <g class="fy-left">
      <path
        d="M214 276 Q170 282 142 254"
        stroke="#0b79c3"
        stroke-width="20"
        fill="none"
        stroke-linecap="round"
      />
      <circle cx="140" cy="252" r="16" fill="#0b79c3" />
    </g>
    <g class="fy-right">
      <path
        d="M306 276 Q350 282 378 254"
        stroke="#0b79c3"
        stroke-width="20"
        fill="none"
        stroke-linecap="round"
      />
      <circle cx="380" cy="252" r="16" fill="#0b79c3" />
    </g>

    <!-- Medalla #1 -->
    <path d="M246 272 L240 300 M274 272 L280 300" stroke="#ff8a1f" stroke-width="8" stroke-linecap="round" />
    <circle cx="260" cy="306" r="26" fill="#ff8a1f" stroke="#ffffff" stroke-width="4" />
    <g font-family="'Nunito Variable', Nunito, sans-serif" font-weight="900" text-anchor="middle">
      <text x="260" y="315" font-size="24" fill="#073b5e">#1</text>

      <!-- Calendario de la quincena -->
      <rect x="408" y="22" width="92" height="92" rx="14" fill="#ffffff" stroke="#0b79c3" stroke-width="6" />
      <path d="M411 50 L411 36 Q411 25 422 25 L486 25 Q497 25 497 36 L497 50 Z" fill="#0b79c3" />
      <text x="454" y="43" font-size="12" fill="#ffffff" letter-spacing="1">QUINCENA</text>
      <text x="454" y="96" font-size="42" fill="#073b5e">15</text>
    </g>
  </svg>
</template>

<style scoped>
/* Cada brazo gira sobre su hombro (dentro del cuerpo): sube el cubierto y lo baja con fuerza. */
@keyframes fy-bang-left {
  0%,
  100% {
    transform: rotate(0);
  }
  40% {
    transform: rotate(14deg);
  }
  55% {
    transform: rotate(-3deg);
  }
}
@keyframes fy-bang-right {
  0%,
  100% {
    transform: rotate(0);
  }
  40% {
    transform: rotate(-14deg);
  }
  55% {
    transform: rotate(3deg);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .fy-animated .fy-left,
  .fy-animated .fy-right {
    transform-box: view-box;
    animation: 1s ease-in-out infinite;
  }
  .fy-animated .fy-left {
    transform-origin: 214px 276px;
    animation-name: fy-bang-left;
  }
  .fy-animated .fy-right {
    transform-origin: 306px 276px;
    animation-name: fy-bang-right;
    animation-delay: -0.5s; /* una mano y luego la otra */
  }
}
</style>
