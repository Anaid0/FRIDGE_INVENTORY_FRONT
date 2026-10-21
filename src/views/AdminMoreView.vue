<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AdminPage from '@/layouts/AdminPage.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import FormField from '@/components/ui/FormField.vue';
import Icon, { type IconName } from '@/components/ui/Icon.vue';
import { useAsync } from '@/composables/useAsync';
import { useOnEnter } from '@/composables/useOnEnter';
import { useServices } from '@/services/container';
import { errorMessage, isApiError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { fullName, initials } from '@/utils/format';

const services = useServices();
const auth = useAuthStore();
const toasts = useToastStore();
const router = useRouter();

/** Personas con el PIN bloqueado (para la marca "N bloq." de Personas). Si falla, no se muestra. */
const locked = useAsync(async () => (await services.people.list()).filter((p) => p.isPinLocked).length);
useOnEnter(() => void locked.run());

interface Module {
  to: string;
  label: string;
  icon: IconName;
  /** Tono del cuadrito del ícono (mockup AdminMas). */
  tone: string;
}

const MODULES: Module[] = [
  { to: '/admin/ranking', label: 'Ranking', icon: 'trophy', tone: 'bg-accent-100 text-accent-700' },
  { to: '/admin/compras', label: 'Compras', icon: 'bag', tone: 'bg-brand-100 text-brand-700' },
  { to: '/admin/reportes', label: 'Reportes', icon: 'chart', tone: 'bg-success-50 text-success-700' },
  { to: '/admin/personas', label: 'Personas', icon: 'users', tone: 'bg-brand-100 text-brand-700' },
  { to: '/admin/tablets', label: 'Tablets', icon: 'monitor', tone: 'bg-brand-100 text-brand-700' },
  {
    to: '/admin/administradores',
    label: 'Administradores',
    icon: 'shield',
    tone: 'bg-brand-100 text-brand-700',
  },
];

const lockedCount = computed(() => locked.data.value ?? 0);

/** Cierra la sesión de admin y vuelve a la máquina. */
async function logout() {
  auth.logout();
  await router.replace('/');
}

// --- Cambiar código (el que se marca en la máquina para entrar como admin) ---
const dialogOpen = ref(false);
const saving = ref(false);
const showPassword = ref(false);
const form = reactive({ password: '', code: '', repeat: '' });
const errors = reactive<{ password?: string; code?: string; repeat?: string; general?: string }>({});

function openDialog() {
  Object.assign(form, { password: '', code: '', repeat: '' });
  clearErrors();
  showPassword.value = false;
  dialogOpen.value = true;
}

function clearErrors() {
  errors.password = errors.code = errors.repeat = errors.general = undefined;
}

/** Solo dígitos, máximo 6 (el teclado de la máquina es numérico); también corrige lo que se ve en el input. */
function onDigits(event: Event, field: 'code' | 'repeat') {
  const input = event.target as HTMLInputElement;
  const clean = input.value.replace(/\D/g, '').slice(0, 6);
  input.value = clean;
  form[field] = clean;
}

/** Validación local: contraseña escrita, código de 4 a 6 dígitos y repetido igual. */
function validate(): boolean {
  clearErrors();
  if (!form.password) errors.password = 'Escribe tu contraseña.';
  if (!/^\d{4,6}$/.test(form.code)) errors.code = 'El código debe tener de 4 a 6 dígitos.';
  else if (form.repeat !== form.code) errors.repeat = 'Los códigos no coinciden.';
  return !errors.password && !errors.code && !errors.repeat;
}

async function saveCode() {
  if (!validate()) return;
  saving.value = true;
  try {
    await services.auth.setAdminCode(form.password, form.code);
    dialogOpen.value = false;
    toasts.success('Código actualizado. Úsalo en la máquina para entrar.');
    // Se refresca el usuario (hasAdminCode); si falla, al menos se marca localmente.
    if (auth.user) auth.user = { ...auth.user, hasAdminCode: true };
    auth.user = await services.auth.me().catch(() => auth.user);
  } catch (e) {
    if (isApiError(e, 'INVALID_ADMIN_PASSWORD')) errors.password = e.message;
    else if (isApiError(e, 'INVALID_ADMIN_CODE_FORMAT') || isApiError(e, 'ADMIN_CODE_TAKEN'))
      errors.code = e.message;
    else if (isApiError(e) && Object.keys(e.fieldErrors).length) {
      const fields = e.fieldErrors;
      errors.password = fields.password;
      errors.code = fields.code;
      if (!errors.password && !errors.code) errors.general = e.message;
    } else errors.general = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdminPage title="Más" narrow>
    <div class="flex flex-col gap-2.5">
      <h1 class="page-title">Más</h1>

      <!-- Perfil -->
      <section
        class="glass-strong flex items-center gap-2.5 rounded-[18px] px-3 py-2.5"
        aria-label="Tu cuenta"
      >
        <span
          v-if="auth.user"
          class="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 font-display text-[13px] font-black text-white"
          aria-hidden="true"
          >{{ initials(auth.user) }}</span
        >
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-extrabold text-ink-900">{{ auth.user ? fullName(auth.user) : '' }}</span>
          <span class="truncate text-[11px] text-ink-500">{{ auth.user?.email }}</span>
          <span
            v-if="auth.user && auth.user.hasAdminCode === false"
            class="text-[11px] font-bold text-accent-700"
            >Aún no tienes código</span
          >
        </span>
        <button
          type="button"
          class="h-11 shrink-0 rounded-[10px] bg-ink-900/8 px-2.5 text-[11px] font-extrabold text-ink-900 hover:bg-ink-900/12"
          @click="openDialog"
        >
          Cambiar código
        </button>
      </section>

      <h2 class="px-1 pt-0.5 text-[10px] font-extrabold tracking-[1px] text-ink-500 uppercase">Módulos</h2>
      <nav class="grid grid-cols-3 gap-2" aria-label="Módulos">
        <RouterLink
          v-for="m in MODULES"
          :key="m.to"
          :to="m.to"
          class="glass press relative flex h-[84px] min-w-0 flex-col justify-between rounded-2xl p-2.5 text-xs font-extrabold text-ink-900 hover:bg-white/80 lg:h-24"
        >
          <span class="grid size-[30px] place-items-center rounded-[9px]" :class="m.tone">
            <Icon :name="m.icon" :size="16" :stroke="2.2" />
          </span>
          <span class="truncate">{{ m.label }}</span>
          <span
            v-if="m.to === '/admin/personas' && lockedCount"
            class="absolute top-2.5 right-2.5 inline-flex h-[18px] items-center rounded-md bg-[#FFE4DE] px-1.5 text-[10px] font-extrabold text-danger-700"
            >{{ lockedCount }} bloq.<span class="sr-only">
              {{ lockedCount === 1 ? 'persona bloqueada' : 'personas bloqueadas' }}</span
            ></span
          >
        </RouterLink>
      </nav>

      <button
        type="button"
        class="press mt-1.5 flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-ink-900 text-[13px] font-extrabold text-white hover:bg-brand-800"
        @click="logout"
      >
        <Icon name="enter" :size="18" :stroke="2.4" /> Cerrar sesión y volver a la máquina
      </button>
      <p class="text-center text-[11px] text-ink-500">
        En la tablet la sesión de admin se cierra sola tras 5 minutos sin uso.
      </p>
    </div>

    <BaseDialog
      :open="dialogOpen"
      title="Cambiar código"
      description="Es el código numérico con el que entras como administrador desde la máquina."
      @close="dialogOpen = false"
    >
      <form class="flex flex-col gap-4" novalidate @submit.prevent="saveCode">
        <p
          v-if="errors.general"
          class="rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700 ring-1 ring-danger-600/20"
          role="alert"
        >
          {{ errors.general }}
        </p>
        <FormField id="code-password" label="Tu contraseña" :error="errors.password">
          <template #default="{ id, invalid }">
            <div class="relative">
              <input
                :id="id"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="input h-12 pr-12"
                autocomplete="current-password"
                autocapitalize="off"
                spellcheck="false"
                :aria-invalid="invalid"
                :aria-describedby="invalid ? `${id}-error` : undefined"
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
          </template>
        </FormField>
        <FormField id="code-new" label="Código nuevo (4 a 6 dígitos)" :error="errors.code">
          <template #default="{ id, invalid }">
            <input
              :id="id"
              :value="form.code"
              type="password"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              class="input num h-12 text-lg tracking-[0.3em]"
              autocomplete="off"
              :aria-invalid="invalid"
              :aria-describedby="invalid ? `${id}-error` : undefined"
              @input="onDigits($event, 'code')"
            />
          </template>
        </FormField>
        <FormField id="code-repeat" label="Repite el código" :error="errors.repeat">
          <template #default="{ id, invalid }">
            <input
              :id="id"
              :value="form.repeat"
              type="password"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              class="input num h-12 text-lg tracking-[0.3em]"
              autocomplete="off"
              :aria-invalid="invalid"
              :aria-describedby="invalid ? `${id}-error` : undefined"
              @input="onDigits($event, 'repeat')"
            />
          </template>
        </FormField>
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="btn-secondary min-h-11" :disabled="saving" @click="dialogOpen = false">
            Cancelar
          </button>
          <button type="submit" class="btn-primary min-h-11" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar código' }}
          </button>
        </div>
      </form>
    </BaseDialog>
  </AdminPage>
</template>
