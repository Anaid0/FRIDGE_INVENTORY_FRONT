<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { User } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useToastStore } from '@/stores/toasts';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

/** Registrar o editar un administrador (cuenta con email + contraseña). */
const props = defineProps<{ open: boolean; user: User | null }>();
const emit = defineEmits<{ close: []; saved: [user: User] }>();

const { users } = useServices();
const toasts = useToastStore();
const isEdit = computed(() => props.user !== null);

const form = reactive({ name: '', lastname: '', email: '', password: '' });
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.assign(form, {
      name: props.user?.name ?? '',
      lastname: props.user?.lastname ?? '',
      email: props.user?.email ?? '',
      password: '',
    });
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
    const base = { name: form.name, lastname: form.lastname, email: form.email };
    const saved = props.user
      ? await users.update(props.user.id, { ...base, ...(form.password && { password: form.password }) })
      : await users.createAdmin({ ...base, password: form.password });
    toasts.success(
      isEdit.value
        ? `${saved.fullName} actualizado.`
        : `${saved.fullName} ya puede entrar a la administración.`,
    );
    emit('saved', saved);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (e.code === 'EMAIL_TAKEN') fieldErrors.value = { email: e.message };
      if (e.code === 'WEAK_PASSWORD' || e.code === 'PASSWORD_TOO_LONG')
        fieldErrors.value = { password: e.message };
    }
    // Si el error es de un campo, se muestra junto a ese campo y no repetido arriba.
    if (Object.keys(fieldErrors.value).length) error.value = null;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="isEdit ? 'Editar administrador' : 'Agregar administrador'"
    @close="emit('close')"
  >
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
        {{ error }}
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField id="ad-name" label="Nombre" :error="fieldErrors.name">
          <input
            id="ad-name"
            v-model="form.name"
            type="text"
            maxlength="100"
            class="input"
            autocomplete="off"
          />
        </FormField>
        <FormField id="ad-lastname" label="Apellido" :error="fieldErrors.lastname">
          <input
            id="ad-lastname"
            v-model="form.lastname"
            type="text"
            maxlength="100"
            class="input"
            autocomplete="off"
          />
        </FormField>
      </div>
      <FormField id="ad-email" label="Email" :error="fieldErrors.email">
        <input
          id="ad-email"
          v-model="form.email"
          type="email"
          maxlength="150"
          class="input"
          autocomplete="off"
        />
      </FormField>
      <FormField
        id="ad-password"
        :label="isEdit ? 'Nueva contraseña' : 'Contraseña'"
        :optional="isEdit"
        hint="Mínimo 8 caracteres, con al menos una letra y un número."
        :error="fieldErrors.password"
      >
        <input
          id="ad-password"
          v-model="form.password"
          type="password"
          class="input"
          autocomplete="new-password"
        />
      </FormField>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="saving || !form.name || !form.lastname || !form.email || (!isEdit && !form.password)"
        >
          {{ saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
