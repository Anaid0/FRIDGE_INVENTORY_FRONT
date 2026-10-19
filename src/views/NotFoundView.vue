<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { RouterLink } from 'vue-router';
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="grid min-h-full place-items-center px-4 text-center">
        <div>
          <p class="text-sm font-semibold text-brand-700">404</p>
          <h1 class="mt-2 text-2xl font-bold text-ink-900">Esta página no existe</h1>
          <RouterLink to="/" class="btn-primary mt-6">Volver al inicio</RouterLink>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
