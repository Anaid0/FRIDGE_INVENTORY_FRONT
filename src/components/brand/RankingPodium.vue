<script setup lang="ts">
/** "Ranking" de design-assets/: podio con tres monos; el primero lleva corona. Ilustración estática. */
withDefaults(defineProps<{ decorative?: boolean }>(), { decorative: false });
</script>

<template>
  <svg
    viewBox="0 0 520 440"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : 'Podio con tres monos de FridgeYA; el primero lleva corona'"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <rect x="70" y="40" width="14" height="8" rx="2" fill="#ff8a1f" transform="rotate(25 77 44)" />
    <rect x="440" y="60" width="14" height="8" rx="2" fill="#ffc93c" transform="rotate(-30 447 64)" />
    <rect x="150" y="70" width="12" height="7" rx="2" fill="#0b79c3" transform="rotate(50 156 73)" />
    <rect x="380" y="120" width="12" height="7" rx="2" fill="#ff8a1f" transform="rotate(15 386 123)" />
    <rect x="40" y="170" width="12" height="7" rx="2" fill="#ffc93c" transform="rotate(-40 46 173)" />
    <rect x="470" y="200" width="12" height="7" rx="2" fill="#0b79c3" transform="rotate(35 476 203)" />
    <circle cx="190" cy="36" r="5" fill="#ffc93c" />
    <circle cx="345" cy="40" r="5" fill="#0b79c3" />

    <!-- 2.º: sonrisa -->
    <g transform="translate(80,130) scale(0.55)">
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
      <circle cx="80" cy="92" r="9" fill="#073b5e" />
      <circle cx="120" cy="92" r="9" fill="#073b5e" />
      <path
        d="M86 132 Q100 140 114 132"
        stroke="#0b79c3"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
    </g>

    <!-- 3.º: boca recta -->
    <g transform="translate(340,170) scale(0.55)">
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
      <circle cx="80" cy="92" r="9" fill="#073b5e" />
      <circle cx="120" cy="92" r="9" fill="#073b5e" />
      <path d="M88 134 L112 134" stroke="#0b79c3" stroke-width="5" fill="none" stroke-linecap="round" />
    </g>

    <!-- 1.º: feliz, con corona -->
    <g transform="translate(210,70) scale(0.55)">
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
      <path d="M68 92 Q80 80 92 92" stroke="#073b5e" stroke-width="7" fill="none" stroke-linecap="round" />
      <path d="M108 92 Q120 80 132 92" stroke="#073b5e" stroke-width="7" fill="none" stroke-linecap="round" />
      <circle cx="94" cy="114" r="3" fill="#0b79c3" />
      <circle cx="106" cy="114" r="3" fill="#0b79c3" />
      <path
        d="M80 126 Q100 152 120 126 Z"
        fill="#073b5e"
        stroke="#073b5e"
        stroke-width="4"
        stroke-linejoin="round"
      />
    </g>
    <path
      d="M238 88 L238 58 L251 74 L265 50 L279 74 L292 58 L292 88 Z"
      fill="#ffc93c"
      stroke="#d9a21b"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <circle cx="265" cy="76" r="4" fill="#ff8a1f" />

    <rect x="70" y="290" width="130" height="110" rx="10" fill="#7fbde6" />
    <rect x="200" y="230" width="130" height="170" rx="10" fill="#0b79c3" />
    <rect x="330" y="320" width="130" height="80" rx="10" fill="#cfe8f7" stroke="#7fbde6" stroke-width="4" />
    <g font-family="'Nunito Variable', Nunito, sans-serif" font-weight="900" text-anchor="middle">
      <text x="135" y="366" font-size="56" fill="#073b5e">2</text>
      <text x="265" y="330" font-size="72" fill="#ffffff">1</text>
      <text x="395" y="378" font-size="48" fill="#073b5e">3</text>
    </g>
    <line x1="40" y1="402" x2="490" y2="402" stroke="#7fbde6" stroke-width="6" stroke-linecap="round" />
  </svg>
</template>
