<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import Icon from './Icon.vue';

/**
 * Diálogo modal de Ionic (foco, Esc, fondo y gesto de cierre los da Ionic).
 * Mantiene la misma API que antes: `open`, `title`, `description`, `wide` y el evento `close`.
 */
withDefaults(defineProps<{ open: boolean; title: string; description?: string; wide?: boolean }>(), {
  description: undefined,
  wide: false,
});
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <IonModal :is-open="open" :class="wide ? 'dialog-wide' : 'dialog'" @did-dismiss="emit('close')">
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <IonTitle>{{ title }}</IonTitle>
        <IonButtons slot="end">
          <IonButton aria-label="Cerrar" @click="emit('close')"><Icon name="x" /></IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div class="p-5">
        <p v-if="description" class="mb-4 text-sm text-ink-500">{{ description }}</p>
        <slot />
      </div>
    </IonContent>
  </IonModal>
</template>

<style>
/* En tablet/escritorio el modal es una tarjeta centrada que se ajusta a su contenido. */
@media (min-width: 640px) {
  ion-modal.dialog {
    --width: 30rem;
    --height: auto;
    --max-height: 90vh;
    --border-radius: var(--radius-card);
  }
  ion-modal.dialog-wide {
    --width: 44rem;
    --height: auto;
    --max-height: 90vh;
    --border-radius: var(--radius-card);
  }
  ion-modal.dialog .ion-page,
  ion-modal.dialog-wide .ion-page {
    position: relative;
    contain: content;
  }
  ion-modal.dialog ion-content,
  ion-modal.dialog-wide ion-content {
    --overflow: auto;
    max-height: calc(90vh - 56px);
    height: auto;
  }
  ion-modal.dialog ion-content::part(scroll),
  ion-modal.dialog-wide ion-content::part(scroll) {
    position: relative;
  }
}
</style>
