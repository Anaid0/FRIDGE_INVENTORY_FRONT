<script setup lang="ts">
import { computed, ref } from 'vue';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Texto del valor (ya formateado) que se muestra en la punta y en el tooltip. */
  valueLabel: string;
  /** Detalle secundario del tooltip (p. ej. "4 retiros"). */
  detail?: string;
}

/**
 * Barras horizontales de una sola serie (magnitud por entidad).
 * - Marcas: barra de 10px con puntas redondas sobre un riel suave (como las barras del ranking de los mockups).
 * - `emphasizeKey`: énfasis (esa barra en el acento, el resto en gris de contexto).
 * - Valor en la punta (texto en tokens de texto, nunca del color de la serie).
 * - Hover y foco muestran el mismo tooltip; una tabla oculta da acceso sin color ni hover.
 */
const props = withDefaults(
  defineProps<{
    rows: BarRow[];
    caption: string;
    labelHeader?: string;
    valueHeader?: string;
    emphasizeKey?: string | null;
  }>(),
  { labelHeader: 'Nombre', valueHeader: 'Valor', emphasizeKey: null },
);

const max = computed(() => Math.max(0, ...props.rows.map((row) => row.value)));
const active = ref<string | null>(null);

function width(value: number): string {
  if (max.value <= 0 || value <= 0) return '0%';
  return `${Math.max((value / max.value) * 100, 1.5)}%`;
}

function fill(row: BarRow): string {
  const muted = props.emphasizeKey !== null && row.key !== props.emphasizeKey;
  if (muted) return active.value === row.key ? 'var(--color-ink-400)' : 'var(--color-ink-300)';
  return active.value === row.key ? 'var(--color-brand-500)' : 'var(--color-brand-600)';
}
</script>

<template>
  <figure class="m-0">
    <ul class="space-y-2.5" role="list" :aria-label="caption">
      <li
        v-for="row in rows"
        :key="row.key"
        class="group relative grid grid-cols-1 items-center gap-x-3 gap-y-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:grid-cols-[minmax(0,11rem)_1fr]"
        tabindex="0"
        :aria-label="`${row.label}: ${row.valueLabel}${row.detail ? `, ${row.detail}` : ''}`"
        @pointerenter="active = row.key"
        @pointerleave="active = null"
        @focus="active = row.key"
        @blur="active = null"
      >
        <span class="truncate text-[13px] font-bold text-ink-900" :title="row.label">{{ row.label }}</span>
        <span class="flex min-w-0 items-center gap-2 py-1">
          <span class="flex h-2.5 min-w-0 flex-1 items-center rounded-full bg-ink-900/6">
            <span
              data-bar
              class="h-2.5 rounded-full transition-[width,background-color] duration-300"
              :style="{ width: width(row.value), backgroundColor: fill(row) }"
            />
          </span>
          <span class="num shrink-0 text-right text-[13px] whitespace-nowrap text-ink-900">{{
            row.valueLabel
          }}</span>
        </span>

        <span
          v-if="active === row.key && row.detail"
          class="pointer-events-none absolute -top-9 left-[min(60%,14rem)] z-10 glass-strong rounded-lg px-3 py-1.5 text-xs"
          role="tooltip"
        >
          <strong class="text-ink-900">{{ row.valueLabel }}</strong>
          <span class="text-ink-500"> · {{ row.label }} · {{ row.detail }}</span>
        </span>
      </li>
    </ul>

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
            <th scope="col">{{ labelHeader }}</th>
            <th scope="col">{{ valueHeader }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row">{{ row.label }}</th>
            <td>{{ row.valueLabel }}{{ row.detail ? ` (${row.detail})` : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>
