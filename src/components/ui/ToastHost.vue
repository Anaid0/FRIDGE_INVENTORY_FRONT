<script setup lang="ts">
import { IonToast } from '@ionic/vue';
import { useToastStore } from '@/stores/toasts';

/** Avisos con ion-toast (el estado vive en el store, así cualquier vista o store puede avisar). */
const toasts = useToastStore();
</script>

<template>
  <IonToast
    v-for="toast in toasts.toasts"
    :key="toast.id"
    :is-open="true"
    :message="toast.message"
    :duration="4500"
    :color="toast.kind === 'error' ? 'danger' : 'dark'"
    position="bottom"
    :buttons="[{ text: 'Cerrar', role: 'cancel' }]"
    @did-dismiss="toasts.dismiss(toast.id)"
  />
</template>
