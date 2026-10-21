<script setup lang="ts">
import { computed } from 'vue';

/** Íconos de trazo (24x24, stroke 1.75) — solo los que usa la app. */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  users:
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17 19 7',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  tablet: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7zM16 10h.01',
  // De los mockups (design-assets/): navegación de la tablet, productos y acciones.
  takeOut: 'M12 15V3M7 8l5-5 5 5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  putIn: 'M12 3v12M7 10l5 5 5-5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  bottle: 'M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3zM8 12h8',
  cup: 'M6 3h12l-1 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7zM7 7h10M14.5 14a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
  carton: 'M8 3h8v3l2 3v12H6V9l2-3zM6 9h12M10 14h4',
  apple:
    'M12 7c-1-2-3-3-5-2-3 1.5-3 6-1 10 1.3 2.6 3.3 4 6 3 2.7 1 4.7-.4 6-3 2-4 2-8.5-1-10-2-1-4 0-5 2zM12 7c0-2 1-3.5 3-4',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9l6 6M18 9l-6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  // Barra inferior de la administración y cabecera de la máquina (mockups móviles).
  navHome: 'M3 11l9-8 9 8M5 10v10h14V10',
  navBox: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  navSwap: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  navWallet: 'M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M16 15h2',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  bag: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  filter: 'M4 6h16M7 12h10M10 18h4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  enter: 'M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M12 20h.01M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5',
  sidebarClose: 'M4 4h16v16H4zM9 4v16M16 9l-3 3 3 3',
  sidebarOpen: 'M4 4h16v16H4zM9 4v16M13 9l3 3-3 3',
  eyeOff:
    'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
} as const;

export type IconName = keyof typeof PATHS;

const props = withDefaults(defineProps<{ name: IconName; size?: number; stroke?: number }>(), {
  size: 18,
  stroke: 1.75,
});
const d = computed(() => PATHS[props.name]);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path :d="d" />
  </svg>
</template>
