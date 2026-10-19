<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { RouterLink } from 'vue-router';
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="grid min-h-full place-items-center px-4 text-center">
        <div>
          <p class="eyebrow text-brand-600">404</p>
          <h1 class="mt-2 page-title">Esta página no existe</h1>
          <RouterLink to="/" class="btn-primary mt-6">Volver al inicio</RouterLink>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
