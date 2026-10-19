<script setup lang="ts">
import { computed } from 'vue';
import Icon, { type IconName } from './Icon.vue';

/**
 * Ícono del producto según su categoría, como en los mockups: bebidas (botella, azul), snacks (paquete,
 * naranja), lácteos (caja de leche, verde), frutas (manzana, verde) y el resto (caja, gris azulado).
 */
const props = withDefaults(defineProps<{ category?: string | null; size?: 'md' | 'lg' }>(), {
  category: null,
  size: 'md',
});

const style = computed((): { icon: IconName; tone: string } => {
  const name = (props.category ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (/bebida|gaseosa|jugo|agua|licor|cafe/.test(name))
    return { icon: 'bottle', tone: 'bg-brand-100 text-brand-600' };
  if (/lacteo|leche|yogur/.test(name)) return { icon: 'carton', tone: 'bg-success-50 text-success-700' };
  if (/fruta|verdura/.test(name)) return { icon: 'apple', tone: 'bg-success-50 text-success-700' };
  if (/snack|paquete|dulce|galleta|mecato/.test(name))
    return { icon: 'cup', tone: 'bg-accent-100 text-accent-700' };
  return { icon: 'box', tone: 'bg-ink-100 text-ink-600' };
});
</script>

<template>
  <span
    class="grid shrink-0 place-items-center"
    :class="[style.tone, size === 'lg' ? 'size-[50px] rounded-[14px]' : 'size-[42px] rounded-xl']"
    aria-hidden="true"
  >
    <Icon :name="style.icon" :size="size === 'lg' ? 26 : 22" :stroke="2" />
  </span>
</template>
