<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import SadMonkey from '@/components/ui/SadMonkey.vue';
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="grid min-h-full place-items-center px-4 py-10 text-center">
        <div class="card flex w-full max-w-sm flex-col items-center gap-2 px-6 py-7">
          <SadMonkey class="h-20 w-24" />
          <p class="num mt-1 text-xs tracking-[0.2em] text-brand-600">404</p>
          <h1 class="page-title">Esta página no existe</h1>
          <p class="text-[13px] text-ink-500">
            Puede que el enlace esté mal escrito o que la página ya no exista.
          </p>
          <RouterLink to="/" class="btn-primary mt-3 min-h-11 w-full">Volver al inicio</RouterLink>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
