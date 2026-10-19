<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export interface LinePoint {
  date: string; // ISO
  value: number;
  detail?: string | null;
}

/**
 * Línea de una sola serie en el tiempo (p. ej. precio unitario).
 * Línea 2px, lavado de área al 10%, puntos de 8px con anillo de 2px del color de la superficie,
 * cuadrícula hairline, cruz que se ajusta al punto más cercano (también con flechas del teclado)
 * y una tabla oculta con todos los valores.
 */
const props = defineProps<{
  points: LinePoint[];
  caption: string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  formatDate: (iso: string) => string;
}>();

const HEIGHT = 240;
const PAD = { top: 16, right: 28, bottom: 30, left: 64 };

const container = ref<HTMLDivElement | null>(null);
const width = ref(640);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!container.value || typeof ResizeObserver === 'undefined') return;
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(280, entry.contentRect.width);
  });
  observer.observe(container.value);
});
onBeforeUnmount(() => observer?.disconnect());

const sorted = computed(() =>
  [...props.points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
);

/** Escala "linda": pasos de 1, 2 o 5 × 10^k, con margen arriba y abajo. */
const yScale = computed(() => {
  const values = sorted.value.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => rough <= s) ?? magnitude * 10;
  // Holgura: si un valor queda pegado al borde, se agrega un paso para que el punto y su etiqueta respiren.
  let lo = Math.max(0, Math.floor(min / step) * step);
  let hi = Math.ceil(max / step) * step;
  if (hi - max < step * 0.25) hi += step;
  if (min - lo < step * 0.25 && lo > 0) lo = Math.max(0, lo - step);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
  return { lo, hi, ticks };
});

const plotW = computed(() => width.value - PAD.left - PAD.right);
const plotH = HEIGHT - PAD.top - PAD.bottom;

/**
 * Cada compra ocupa un paso del eje X (escala ordinal, en orden de fecha): así dos compras del mismo día
 * no se superponen. Las fechas se leen en el tooltip, en los extremos del eje y en la tabla.
 */
const coords = computed(() => {
  const { lo, hi } = yScale.value;
  const n = sorted.value.length;
  return sorted.value.map((p, i) => ({
    point: p,
    x: PAD.left + (n === 1 ? plotW.value / 2 : (i / (n - 1)) * plotW.value),
    y: PAD.top + plotH - ((p.value - lo) / (hi - lo || 1)) * plotH,
  }));
});

const yOf = (value: number) =>
  PAD.top + plotH - ((value - yScale.value.lo) / (yScale.value.hi - yScale.value.lo || 1)) * plotH;

const linePath = computed(() => coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' '));
const areaPath = computed(() => {
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  if (!first || !last) return '';
  const base = PAD.top + plotH;
  return `${linePath.value} L${last.x},${base} L${first.x},${base} Z`;
});

const activeIndex = ref<number | null>(null);
const active = computed(() =>
  activeIndex.value === null ? null : (coords.value[activeIndex.value] ?? null),
);
const last = computed(() => coords.value[coords.value.length - 1] ?? null);

function onPointerMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGElement;
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * width.value;
  let best = 0;
  coords.value.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs((coords.value[best]?.x ?? 0) - x)) best = i;
  });
  activeIndex.value = best;
}

function onKey(event: KeyboardEvent) {
  const n = coords.value.length;
  if (!n) return;
  if (event.key === 'ArrowRight') activeIndex.value = Math.min(n - 1, (activeIndex.value ?? -1) + 1);
  else if (event.key === 'ArrowLeft') activeIndex.value = Math.max(0, (activeIndex.value ?? n) - 1);
  else return;
  event.preventDefault();
}

const tooltipLeft = computed(() => {
  if (!active.value) return '0px';
  return `${Math.min(Math.max(active.value.x, 90), width.value - 90)}px`;
});
</script>

<template>
  <figure ref="container" class="relative m-0">
    <svg
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      :width="width"
      :height="HEIGHT"
      class="block max-w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      role="img"
      :aria-label="caption"
      tabindex="0"
      @pointermove="onPointerMove"
      @pointerleave="activeIndex = null"
      @keydown="onKey"
      @blur="activeIndex = null"
    >
      <!-- Cuadrícula y eje Y (recesivos) -->
      <g>
        <template v-for="tick in yScale.ticks" :key="tick">
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="yOf(tick)"
            :y2="yOf(tick)"
            stroke="var(--color-ink-100)"
            stroke-width="1"
          />
          <text
            :x="PAD.left - 10"
            :y="yOf(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-ink-500 text-[11px] tabular-nums"
          >
            {{ formatTick(tick) }}
          </text>
        </template>
      </g>

      <!-- Fechas extremas en el eje X -->
      <g v-if="coords.length">
        <text :x="coords[0]!.x" :y="HEIGHT - 8" text-anchor="start" class="fill-ink-500 text-[11px]">
          {{ formatDate(coords[0]!.point.date) }}
        </text>
        <text
          v-if="coords.length > 1"
          :x="last!.x"
          :y="HEIGHT - 8"
          text-anchor="end"
          class="fill-ink-500 text-[11px]"
        >
          {{ formatDate(last!.point.date) }}
        </text>
      </g>

      <path :d="areaPath" fill="var(--color-brand-600)" fill-opacity="0.1" />
      <path
        :d="linePath"
        fill="none"
        stroke="var(--color-brand-600)"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Cruz de seguimiento -->
      <line
        v-if="active"
        :x1="active.x"
        :x2="active.x"
        :y1="PAD.top"
        :y2="PAD.top + plotH"
        stroke="var(--color-ink-300)"
        stroke-width="1"
      />

      <circle
        v-for="(c, i) in coords"
        :key="c.point.date + i"
        :cx="c.x"
        :cy="c.y"
        :r="activeIndex === i ? 5.5 : 4"
        fill="var(--color-brand-600)"
        stroke="white"
        stroke-width="2"
      />

      <!-- Etiqueta directa solo en el último punto -->
      <text
        v-if="last && !active"
        :x="Math.min(last.x, width - PAD.right)"
        :y="last.y - 12"
        text-anchor="end"
        class="fill-ink-800 text-xs font-semibold tabular-nums"
      >
        {{ formatValue(last.point.value) }}
      </text>
    </svg>

    <div
      v-if="active"
      class="pointer-events-none absolute top-1 z-10 -translate-x-1/2 glass-strong rounded-lg px-3 py-2 text-xs"
      :style="{ left: tooltipLeft }"
      role="tooltip"
    >
      <p class="text-sm font-semibold text-ink-900 tabular-nums">{{ formatValue(active.point.value) }}</p>
      <p class="text-ink-500">
        {{ formatDate(active.point.date)
        }}<span v-if="active.point.detail"> · {{ active.point.detail }}</span>
      </p>
    </div>

    <!-- Tabla para lectores de pantalla. Va dentro de un div: un <table> ignora el ancho de 1px de sr-only
         y, al estirarse con su contenido, generaba scroll horizontal en pantallas angostas. -->
    <div class="sr-only">
      <table class="chart-data-table">
        <caption>
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in sorted" :key="p.date + i">
            <th scope="row">{{ formatDate(p.date) }}</th>
            <td>{{ formatValue(p.value) }}{{ p.detail ? ` (${p.detail})` : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>
