<script setup lang="ts">
import { computed } from 'vue';

/**
 * Dibujo a color del producto para la máquina (mockup Main): botella de agua, lata de gaseosa, ponqué,
 * galletas, leche, licor, fruta. Se elige por palabras del nombre; si no reconoce ninguna, una caja.
 */
const props = withDefaults(defineProps<{ name: string; size?: number; dim?: boolean }>(), {
  size: 34,
  dim: false,
});

type Kind = 'water' | 'cola' | 'zero' | 'snack' | 'cookies' | 'chocomilk' | 'milk' | 'liquor' | 'fruit' | 'box';

const RULES: [RegExp, Kind][] = [
  [/zero|light|dieta/, 'zero'],
  [/coca|cola|gaseosa|soda|pepsi|sprite|postob|colombiana|manzana postob/, 'cola'],
  [/guaro|aguardiente|ron\b|cerveza|vino|licor|whisky|tequila/, 'liquor'],
  [/agua|botella/, 'water'],
  [/chocorramo|ponqu|torta|brownie|gala|chocolatina|barra/, 'snack'],
  [/galleta|club social|cracker|ducales|saltin|festival|oreo/, 'cookies'],
  [/leche.*chocolate|chocolate|milo|kumis/, 'chocomilk'],
  [/leche|yogur|avena/, 'milk'],
  [/manzana|banano|fruta|pera|naranja|mandarina|uva/, 'fruit'],
];

const kind = computed<Kind>(() => {
  const name = props.name.toLowerCase();
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'box';
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 40 40"
    aria-hidden="true"
    :style="dim ? { opacity: 0.45 } : undefined"
  >
    <template v-if="kind === 'water'">
      <rect x="15" y="3" width="10" height="5" rx="1.5" fill="#0B79C3" />
      <path
        d="M13 13 Q13 9 17 9 H23 Q27 9 27 13 V34 Q27 37 24 37 H16 Q13 37 13 34 Z"
        fill="#DDF0FB"
        stroke="#0B79C3"
        stroke-width="2"
      />
      <rect x="13" y="19" width="14" height="7" fill="#7FBDE6" />
    </template>
    <template v-else-if="kind === 'cola'">
      <rect x="13" y="4" width="14" height="3" rx="1.5" fill="#9AA7B1" />
      <rect x="12" y="6" width="16" height="31" rx="4" fill="#E23D4F" />
      <path d="M12 19 q8 -4 16 0 v4 q-8 -4 -16 0 z" fill="#FFFFFF" />
    </template>
    <template v-else-if="kind === 'zero'">
      <rect x="13" y="4" width="14" height="3" rx="1.5" fill="#9AA7B1" />
      <rect x="12" y="6" width="16" height="31" rx="4" fill="#26323B" />
      <path d="M12 19 q8 -4 16 0 v5 q-8 -4 -16 0 z" fill="#E84A5F" />
    </template>
    <template v-else-if="kind === 'snack'">
      <rect x="4" y="12" width="32" height="17" rx="4" fill="#FF8A1F" stroke="#B35400" stroke-width="2" />
      <rect x="10" y="16" width="20" height="9" rx="2" fill="#6B3A12" />
      <path d="M14 20.5h12" stroke="#FFC93C" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'cookies'">
      <rect x="3" y="12" width="34" height="16" rx="3" fill="#0B79C3" />
      <rect x="7" y="15" width="11" height="10" rx="2" fill="#FFC93C" />
      <circle cx="10" cy="18" r="1" fill="#B35400" />
      <circle cx="15" cy="18" r="1" fill="#B35400" />
      <circle cx="12.5" cy="22" r="1" fill="#B35400" />
      <path d="M22 18h11M22 22h8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'chocomilk'">
      <path d="M12 13 L15 6 H25 L28 13 V36 H12 Z" fill="#8B5A2B" />
      <path d="M12 13 H28" stroke="#6B3A12" stroke-width="2" />
      <rect x="15" y="18" width="10" height="10" rx="2" fill="#FFFFFF" />
      <circle cx="20" cy="23" r="2.5" fill="#8B5A2B" />
    </template>
    <template v-else-if="kind === 'milk'">
      <path
        d="M12 13 L15 6 H25 L28 13 V36 H12 Z"
        fill="#FFFFFF"
        stroke="#0B79C3"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path d="M12 13 H28" stroke="#0B79C3" stroke-width="2" />
      <path d="M12 24 q8 -4 16 0 V36 H12Z" fill="#7FBDE6" />
    </template>
    <template v-else-if="kind === 'liquor'">
      <rect x="17" y="2" width="6" height="5" rx="1" fill="#E23D4F" />
      <path
        d="M17.5 7 h5 v6 l4 4 v18 q0 3 -3 3 h-7 q-3 0 -3 -3 v-18 l4 -4z"
        fill="#EAF6FC"
        stroke="#7FBDE6"
        stroke-width="2"
      />
      <rect x="14" y="22" width="12" height="8" rx="1" fill="#E23D4F" />
    </template>
    <template v-else-if="kind === 'fruit'">
      <circle cx="20" cy="24" r="11" fill="#E84A5F" />
      <path d="M20 13 Q23 6 28 7" stroke="#2F8A4F" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <ellipse cx="16" cy="20" rx="2.5" ry="3.5" fill="#FFFFFF" opacity="0.45" />
    </template>
    <template v-else>
      <rect x="7" y="12" width="26" height="22" rx="3" fill="#FFFFFF" stroke="#0B79C3" stroke-width="2" />
      <path d="M7 18 H33 M20 12 V18" stroke="#0B79C3" stroke-width="2" />
      <rect x="15" y="23" width="10" height="5" rx="1.5" fill="#7FBDE6" />
    </template>
  </svg>
</template>
