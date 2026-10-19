<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Person } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useToastStore } from '@/stores/toasts';
import PinInput from './PinInput.vue';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

/**
 * - `mode: 'create'`: alta con nombre, apellido y PIN.
 * - `mode: 'edit'`: cambiar el nombre.
 * - `mode: 'pin'`: asignar o restablecer el PIN (también desbloquea).
 */
const props = defineProps<{ open: boolean; mode: 'create' | 'edit' | 'pin'; person: Person | null }>();
const emit = defineEmits<{ close: []; saved: [person: Person] }>();

const { people } = useServices();
const toasts = useToastStore();

const form = reactive({ name: '', lastname: '', pin: '' });
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

const title = computed(() =>
  props.mode === 'create'
    ? 'Agregar persona'
    : props.mode === 'edit'
      ? 'Editar persona'
      : props.person?.hasPin
        ? `Restablecer PIN de ${props.person.fullName}`
        : `Asignar PIN a ${props.person?.fullName ?? ''}`,
);
const showName = computed(() => props.mode !== 'pin');
const showPin = computed(() => props.mode !== 'edit');

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.assign(form, { name: props.person?.name ?? '', lastname: props.person?.lastname ?? '', pin: '' });
    error.value = null;
    fieldErrors.value = {};
  },
  { immediate: true },
);

async function submit() {
  error.value = null;
  fieldErrors.value = {};
  saving.value = true;
  try {
    let saved: Person;
    if (props.mode === 'create') {
      saved = await people.create({ name: form.name, lastname: form.lastname, pin: form.pin });
      toasts.success(`${saved.fullName} agregado. Comunícale su PIN: ${form.pin}`);
    } else if (props.mode === 'edit' && props.person) {
      saved = await people.update(props.person.id, { name: form.name, lastname: form.lastname });
      toasts.success(`${saved.fullName} actualizado.`);
    } else {
      saved = await people.resetPin(props.person!.id, form.pin);
      toasts.success(`PIN de ${saved.fullName} actualizado. Comunícaselo: ${form.pin}`);
    }
    emit('saved', saved);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (['WEAK_PIN', 'INVALID_PIN_FORMAT'].includes(e.code)) fieldErrors.value = { pin: e.message };
      if (e.code === 'PERSON_NAME_TAKEN') fieldErrors.value = { lastname: e.message };
    }
    // Si el error es de un campo, se muestra junto a ese campo y no repetido arriba.
    if (Object.keys(fieldErrors.value).length) error.value = null;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseDialog :open="open" :title="title" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
        {{ error }}
      </p>
      <div v-if="showName" class="grid gap-4 sm:grid-cols-2">
        <FormField id="pp-name" label="Nombre" :error="fieldErrors.name">
          <input
            id="pp-name"
            v-model="form.name"
            type="text"
            maxlength="100"
            class="input"
            autocomplete="off"
          />
        </FormField>
        <FormField id="pp-lastname" label="Apellido" :error="fieldErrors.lastname">
          <input
            id="pp-lastname"
            v-model="form.lastname"
            type="text"
            maxlength="100"
            class="input"
            autocomplete="off"
          />
        </FormField>
      </div>
      <FormField
        v-if="showPin"
        id="pp-pin"
        label="PIN de 4 dígitos"
        hint="Con este PIN se identificará en la tablet. No se permiten PIN como 0000 o 1234."
        :error="fieldErrors.pin"
      >
        <PinInput id="pp-pin" v-model="form.pin" :invalid="Boolean(fieldErrors.pin)" />
      </FormField>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="
            saving || (showName && (!form.name || !form.lastname)) || (showPin && form.pin.length !== 4)
          "
        >
          {{ saving ? 'Guardando…' : mode === 'create' ? 'Agregar' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
