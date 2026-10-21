<script setup lang="ts">
import { IonContent, IonHeader, IonModal } from '@ionic/vue';
import { useId } from 'vue';
import Icon from './Icon.vue';

/**
 * Diálogo modal de Ionic (foco, Esc, fondo y gesto de cierre los da Ionic) con el aspecto de los mockups:
 * tarjeta de vidrio blanco, título en Nunito 900 y un botón redondo para cerrar.
 * Mantiene la misma API que antes: `open`, `title`, `description`, `wide` y el evento `close`.
 * `compact`: tarjeta centrada y angosta también en el celular (confirmaciones); `hideClose` quita la "×"
 * cuando el diálogo ya trae su propio "Cancelar".
 */
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    wide?: boolean;
    compact?: boolean;
    hideClose?: boolean;
  }>(),
  {
    description: undefined,
    wide: false,
    compact: false,
    hideClose: false,
  },
);
const emit = defineEmits<{ close: [] }>();
const titleId = useId();
</script>

<template>
  <IonModal
    :is-open="open"
    :class="compact ? 'dialog-compact' : wide ? 'dialog-wide' : 'dialog'"
    :aria-labelledby="titleId"
    @did-dismiss="emit('close')"
  >
    <IonHeader class="ion-no-border">
      <div class="dialog-head flex items-start gap-3 px-5 pb-1">
        <h2
          :id="titleId"
          class="min-w-0 flex-1 pt-1.5 font-display text-lg leading-snug font-black text-ink-900"
        >
          {{ title }}
        </h2>
        <button
          v-if="!hideClose"
          type="button"
          class="-mr-1.5 grid size-10 shrink-0 place-items-center rounded-full border border-white/90 bg-white/70 text-ink-900 hover:bg-white"
          aria-label="Cerrar"
          @click="emit('close')"
        >
          <Icon name="x" :size="18" :stroke="2.2" />
        </button>
      </div>
    </IonHeader>
    <IonContent>
      <div class="px-5 pt-2 pb-5">
        <p v-if="description" class="mb-4 text-[13px] text-ink-700">{{ description }}</p>
        <slot />
      </div>
    </IonContent>
  </IonModal>
</template>

<style>
/* Cabecera propia (sin ion-toolbar): en el celular el modal ocupa la pantalla y se aparta de la barra de estado. */
ion-modal .dialog-head {
  padding-top: calc(var(--ion-safe-area-top, 0px) + 1rem);
}
ion-modal.dialog-compact .dialog-head {
  padding-top: 1rem;
}

/* Confirmaciones: tarjeta centrada de 20px de radio en cualquier pantalla (mockup AdminEstados). */
ion-modal.dialog-compact {
  --width: calc(100% - 2rem);
  --max-width: 26rem;
  --height: auto;
  --max-height: 90vh;
  --border-radius: 20px;
  --background: rgb(255 255 255 / 0.92);
}
ion-modal.dialog-compact::part(content) {
  border: 1px solid rgb(255 255 255 / 0.95);
  box-shadow: 0 18px 40px rgb(7 59 94 / 0.22);
}

/* En tablet/escritorio el modal es una tarjeta centrada que se ajusta a su contenido. */
@media (min-width: 640px) {
  ion-modal .dialog-head {
    padding-top: 1.25rem;
  }
  ion-modal.dialog {
    --width: 30rem;
    --height: auto;
    --max-height: 90vh;
    --border-radius: 22px;
  }
  ion-modal.dialog-wide {
    --width: 44rem;
    --height: auto;
    --max-height: 90vh;
    --border-radius: 22px;
  }
}

ion-modal.dialog-compact .ion-page {
  position: relative;
  contain: content;
}
ion-modal.dialog-compact ion-content {
  --overflow: auto;
  --padding-top: 0px;
  --padding-bottom: 0px;
  --padding-start: 0px;
  --padding-end: 0px;
  max-height: calc(90vh - 64px);
  height: auto;
}
ion-modal.dialog-compact ion-content::part(scroll) {
  position: relative;
}
@media (min-width: 640px) {
  ion-modal.dialog .ion-page,
  ion-modal.dialog-wide .ion-page {
    position: relative;
    contain: content;
  }
  ion-modal.dialog ion-content,
  ion-modal.dialog-wide ion-content {
    --overflow: auto;
    max-height: calc(90vh - 64px);
    height: auto;
  }
  ion-modal.dialog ion-content::part(scroll),
  ion-modal.dialog-wide ion-content::part(scroll) {
    position: relative;
  }
}
</style>
