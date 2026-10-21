<script setup lang="ts">
import Icon from '../ui/Icon.vue';

/**
 * Buscador de la máquina: filtra los productos de la vitrina desde la tercera letra (sin importar tildes
 * ni mayúsculas). `dark`: versión para el mueble azul de la tablet.
 */
defineProps<{ dark?: boolean }>();
const model = defineModel<string>({ default: '' });
</script>

<template>
  <div class="search" :class="{ dark }" role="search">
    <Icon name="search" :size="15" :stroke="2.2" class="shrink-0 opacity-70" />
    <input
      v-model="model"
      type="search"
      enterkeyhint="search"
      autocomplete="off"
      placeholder="Buscar producto"
      aria-label="Buscar producto (desde 3 letras)"
      class="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
      data-no-swipe
    />
    <button v-if="model" type="button" class="clear" aria-label="Borrar búsqueda" @click="model = ''">
      <Icon name="x" :size="14" :stroke="2.6" />
    </button>
  </div>
</template>

<style scoped>
.search {
  height: 36px;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.7);
  border: 1px solid rgb(255 255 255 / 0.95);
  box-shadow: 0 4px 14px rgb(7 59 94 / 0.08);
  color: var(--color-ink-700);
  font-size: 13px;
  font-weight: 700;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.search:focus-within {
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgb(11 121 195 / 0.18);
}
/* El foco se marca en todo el buscador (borde azul), no con el recuadro del campo. */
.search input:focus-visible {
  outline: none;
}
.search input::placeholder {
  color: var(--color-ink-400);
  font-weight: 600;
}
/* Sin la "x" propia del navegador: ya hay un botón para borrar. */
.search input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  display: grid;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  color: var(--color-ink-500);
}
.search.dark {
  height: 40px;
  background: rgb(255 255 255 / 0.12);
  border-color: rgb(255 255 255 / 0.2);
  box-shadow: none;
  color: #fff;
}
.dark input::placeholder {
  color: #9fd3f5;
}
.dark .clear {
  color: #cfe3f1;
}
</style>
