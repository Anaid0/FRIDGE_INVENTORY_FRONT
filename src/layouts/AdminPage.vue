<script setup lang="ts">
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import TopWithdrawerBadge from '@/components/TopWithdrawerBadge.vue';

/**
 * Página de la administración: cabecera con menú, título y acciones, y debajo, siempre visible,
 * quién es el que más retira. El contenido se centra con un ancho máximo cómodo en tablet y escritorio.
 */
withDefaults(defineProps<{ title: string; narrow?: boolean }>(), { narrow: false });
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonMenuButton aria-label="Abrir menú" />
        </IonButtons>
        <IonTitle>{{ title }}</IonTitle>
        <IonButtons v-if="$slots.toolbar" slot="end">
          <slot name="toolbar" />
        </IonButtons>
      </IonToolbar>
      <IonToolbar class="highlight-toolbar">
        <div class="px-3 py-1"><TopWithdrawerBadge /></div>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div class="mx-auto w-full px-4 py-6 md:px-8" :class="narrow ? 'max-w-3xl' : 'max-w-6xl'">
        <slot />
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.highlight-toolbar {
  --min-height: 48px;
}
</style>
