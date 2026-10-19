<script setup lang="ts">
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import TopWithdrawerBadge from '@/components/TopWithdrawerBadge.vue';

/**
 * Página de la administración.
 * - Escritorio (menú anclado, ≥ 992px): sin barra superior; el título vive en el contenido y arriba, discreto,
 *   quién es el que más retira (requisito: siempre visible).
 * - Celular y tablet en vertical (menú plegado): cabecera de vidrio compacta con el botón del menú, el título
 *   y, debajo, quién más retira.
 */
withDefaults(defineProps<{ title: string; narrow?: boolean }>(), { narrow: false });
</script>

<template>
  <IonPage>
    <IonHeader class="glass-header admin-mobile-header">
      <IonToolbar>
        <IonButtons slot="start">
          <IonMenuButton aria-label="Abrir menú" />
        </IonButtons>
        <IonTitle class="font-black text-ink-900">{{ title }}</IonTitle>
        <IonButtons v-if="$slots.toolbar" slot="end">
          <slot name="toolbar" />
        </IonButtons>
      </IonToolbar>
      <div class="px-3 pb-2 font-sans"><TopWithdrawerBadge /></div>
    </IonHeader>
    <IonContent :fullscreen="true">
      <div
        class="relative mx-auto w-full px-4 pt-5 pb-12 md:px-8 lg:pt-11"
        :class="narrow ? 'max-w-3xl' : 'max-w-[1180px]'"
      >
        <div class="admin-desktop-only absolute top-2.5 right-8 max-w-[45%]">
          <TopWithdrawerBadge compact />
        </div>
        <slot />
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* Mismo corte que el IonSplitPane (when="lg" = 992px): con el menú anclado no hay barra superior. */
.admin-desktop-only {
  display: none;
}
@media (min-width: 992px) {
  .admin-mobile-header {
    display: none;
  }
  .admin-desktop-only {
    display: flex;
  }
}
</style>
