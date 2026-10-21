<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';

/**
 * Página de la administración (mockups móviles): sin barra superior; cada vista pone su encabezado
 * (PageHeader) dentro del contenido. Abajo queda espacio para la barra de pestañas flotante (AdminTabBar).
 * `narrow`: formularios y detalles, en una columna angosta también en pantallas anchas.
 * `title` solo se usa como nombre accesible de la página.
 */
withDefaults(defineProps<{ title: string; narrow?: boolean; withTabs?: boolean }>(), {
  narrow: false,
  withTabs: true,
});
</script>

<template>
  <IonPage :aria-label="title">
    <IonContent :fullscreen="true">
      <div
        class="admin-page mx-auto w-full px-3.5 sm:px-6"
        :class="[narrow ? 'max-w-2xl' : 'max-w-[1180px]', { 'with-tabs': withTabs }]"
      >
        <slot />
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.admin-page {
  padding-top: calc(var(--ion-safe-area-top) + 1.75rem);
  padding-bottom: calc(var(--ion-safe-area-bottom) + 1.5rem);
}
/* Aire para que la barra de pestañas (62px + 22px de margen) no tape lo último. */
.admin-page.with-tabs {
  padding-bottom: calc(var(--ion-safe-area-bottom) + 6.75rem);
}
</style>
