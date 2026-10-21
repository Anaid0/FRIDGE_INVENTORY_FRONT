<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Person } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useToastStore } from '@/stores/toasts';
import PinSetup from './PinSetup.vue';
import Avatar from './ui/Avatar.vue';
import Icon from './ui/Icon.vue';
import BaseDialog from './ui/BaseDialog.vue';
import FormField from './ui/FormField.vue';

/**
 * - `mode: 'create'`: alta con nombre, apellido y PIN.
 * - `mode: 'edit'`: cambiar el nombre.
 * - `mode: 'pin'`: asignar o restablecer el PIN (también desbloquea). Pide la contraseña del admin.
 * El PIN se muestra unos segundos y se confirma de memoria (ver PinSetup).
 */
const props = defineProps<{ open: boolean; mode: 'create' | 'edit' | 'pin'; person: Person | null }>();
const emit = defineEmits<{ close: []; saved: [person: Person] }>();

const { people } = useServices();
const toasts = useToastStore();

const form = reactive({ name: '', lastname: '', pin: '', adminPassword: '' });
const showPassword = ref(false);
const pinSetup = ref<InstanceType<typeof PinSetup> | null>(null);
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
    Object.assign(form, {
      name: props.person?.name ?? '',
      lastname: props.person?.lastname ?? '',
      pin: '',
      adminPassword: '',
    });
    showPassword.value = false;
    pinSetup.value?.restart();
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
      toasts.success(`${saved.fullName} agregado. Ya puede usar su PIN en la tablet.`);
    } else if (props.mode === 'edit' && props.person) {
      saved = await people.update(props.person.id, { name: form.name, lastname: form.lastname });
      toasts.success(`${saved.fullName} actualizado.`);
    } else {
      saved = await people.resetPin(props.person!.id, form.pin, form.adminPassword);
      toasts.success(`PIN de ${saved.fullName} actualizado. Ya puede usarlo en la tablet.`);
    }
    emit('saved', saved);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) {
      fieldErrors.value = e.fieldErrors;
      if (['WEAK_PIN', 'INVALID_PIN_FORMAT', 'PIN_TAKEN'].includes(e.code)) {
        fieldErrors.value = { pin: e.message };
        pinSetup.value?.restart();
      }
      if (e.code === 'INVALID_ADMIN_PASSWORD') fieldErrors.value = { adminPassword: e.message };
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
      <!-- Restablecer PIN: a quién se le cambia (y, si estaba bloqueado, que esto lo desbloquea). -->
      <div v-if="mode === 'pin' && person" class="flex items-center gap-3 rounded-2xl bg-ink-900/5 p-3">
        <Avatar :person="person" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-display text-[15px] font-black text-ink-900">{{ person.fullName }}</p>
          <p class="text-[12px]" :class="person.isPinLocked ? 'font-bold text-danger-700' : 'text-ink-500'">
            {{
              person.isPinLocked
                ? 'Bloqueado por PIN incorrectos: el PIN nuevo lo desbloquea.'
                : person.hasPin
                  ? 'El PIN anterior deja de funcionar.'
                  : 'Todavía no tiene PIN: sin él no puede retirar.'
            }}
          </p>
        </div>
      </div>
      <div v-if="showName" class="grid grid-cols-2 gap-3">
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
      <PinSetup v-if="showPin" ref="pinSetup" v-model="form.pin" id-prefix="pp" :error="fieldErrors.pin" />
      <FormField
        v-if="mode === 'pin'"
        id="pp-admin-password"
        label="Tu contraseña de administrador"
        hint="Para confirmar que eres tú quien cambia el PIN."
        :error="fieldErrors.adminPassword"
      >
        <div class="relative">
          <input
            id="pp-admin-password"
            v-model="form.adminPassword"
            :type="showPassword ? 'text' : 'password'"
            class="input pr-12"
            autocomplete="current-password"
            autocapitalize="off"
            spellcheck="false"
            :aria-invalid="Boolean(fieldErrors.adminPassword)"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-500 hover:text-ink-900"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <Icon :name="showPassword ? 'eyeOff' : 'eye'" :size="20" />
          </button>
        </div>
      </FormField>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary min-h-11" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button
          type="submit"
          class="btn-primary min-h-11"
          :disabled="
            saving ||
            (showName && (!form.name || !form.lastname)) ||
            (showPin && form.pin.length !== 4) ||
            (mode === 'pin' && !form.adminPassword)
          "
        >
          <span
            v-if="saving"
            class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
          {{
            saving ? 'Guardando…' : mode === 'create' ? 'Agregar' : mode === 'pin' ? 'Guardar PIN' : 'Guardar'
          }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>
