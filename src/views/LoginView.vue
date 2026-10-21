<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import FridgeLogo from '@/components/brand/FridgeLogo.vue';
import Icon from '@/components/ui/Icon.vue';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const expired = computed(() => route.query.expired === '1');

async function submit(event: Event) {
  error.value = null;
  // El autocompletado del navegador puede no disparar `input` hasta que el usuario interactúa:
  // se leen también los valores reales del formulario.
  const form = event.target as HTMLFormElement;
  email.value ||= (form.elements.namedItem('email') as HTMLInputElement | null)?.value ?? '';
  password.value ||= (form.elements.namedItem('password') as HTMLInputElement | null)?.value ?? '';
  if (!email.value.trim() || !password.value) {
    error.value = 'Escribe tu email y tu contraseña.';
    return;
  }
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin';
    // Solo rutas internas: evita redirigir a otro sitio (https://… o //otro-dominio).
    const safe = redirect.startsWith('/') && !redirect.startsWith('//');
    await router.replace(safe ? redirect : '/admin');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="flex min-h-full flex-col bg-white lg:flex-row">
        <!-- Panel de marca (mockup Login): celeste con las esquinas de abajo redondeadas. -->
        <section
          class="flex shrink-0 flex-col gap-[18px] rounded-b-[36px] bg-[#E6F3FB] px-6 pt-[calc(var(--ion-safe-area-top)+56px)] pb-8 sm:px-10 lg:flex-1 lg:justify-center lg:rounded-b-none lg:rounded-r-[36px] lg:p-16"
        >
          <FridgeLogo variant="small" label="FridgeYA" class="size-[76px] lg:size-28" />
          <div class="flex max-w-[480px] flex-col gap-1.5">
            <div class="flex flex-wrap items-center gap-2.5">
              <span class="font-display text-[34px] leading-none font-black tracking-[-1px] text-ink-900"
                >Fridge<span class="text-brand-600">YA</span></span
              >
              <span
                class="inline-flex h-[26px] items-center rounded-lg bg-ink-900 px-2.5 text-xs font-extrabold tracking-[1px] text-white"
                >ADMIN</span
              >
            </div>
            <p class="mt-1 font-display text-[22px] leading-tight font-extrabold text-ink-900 lg:text-[32px]">
              La nevera de la oficina, en orden.
            </p>
            <p class="text-[15px] text-[#33607F] lg:text-lg">
              Productos, movimientos, quincenas y compras en un solo lugar.
            </p>
          </div>
        </section>

        <section class="flex flex-1 justify-center lg:items-center">
          <form
            class="flex w-full max-w-[480px] flex-col gap-4 px-6 pt-7 pb-[calc(var(--ion-safe-area-bottom)+34px)] sm:px-10 lg:py-14"
            novalidate
            @submit.prevent="submit"
          >
            <h1 class="font-display text-[22px] leading-tight font-black text-ink-900">
              Entrar como administrador
            </h1>
            <p
              v-if="expired && !error"
              class="rounded-xl bg-warning-50 px-3.5 py-2.5 text-sm text-warning-700 ring-1 ring-warning-600/20"
              role="status"
            >
              Tu sesión terminó. Vuelve a iniciar sesión.
            </p>
            <p
              v-if="error"
              class="rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700 ring-1 ring-danger-600/20"
              role="alert"
            >
              {{ error }}
            </p>

            <div class="flex flex-col gap-1.5">
              <label for="email" class="text-sm font-extrabold text-ink-700">Email</label>
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                inputmode="email"
                class="input h-[54px] rounded-[14px] border-[1.5px] bg-white px-4 text-[17px] text-ink-800"
                autocomplete="username"
                required
                placeholder="tu@empresa.com"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="password" class="text-sm font-extrabold text-ink-700">Contraseña</label>
              <div class="relative">
                <input
                  id="password"
                  v-model="password"
                  name="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="input h-[54px] rounded-[14px] border-[1.5px] bg-white pr-14 pl-4 text-[17px] text-ink-800"
                  autocomplete="current-password"
                  autocapitalize="off"
                  spellcheck="false"
                  required
                />
                <button
                  type="button"
                  class="absolute top-[5px] right-[5px] grid size-11 place-items-center rounded-[10px] text-ink-500 hover:text-ink-900"
                  :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  <Icon :name="showPassword ? 'eyeOff' : 'eye'" :size="22" :stroke="2" />
                </button>
              </div>
            </div>
            <p class="text-sm text-ink-500">
              Los empleados no necesitan cuenta: en la nevera solo escriben su PIN.
            </p>

            <div class="mt-4 flex flex-col gap-2">
              <button
                type="submit"
                class="btn-primary h-[58px] w-full rounded-[18px] font-display text-[19px] font-black"
                :disabled="loading"
              >
                {{ loading ? 'Entrando…' : 'Entrar' }}
              </button>
              <RouterLink
                to="/"
                class="inline-flex h-12 items-center justify-center gap-1.5 font-extrabold text-brand-700 hover:text-ink-900"
              >
                <Icon name="chevronLeft" :size="20" :stroke="2.4" /> Volver a la nevera
              </RouterLink>
            </div>
          </form>
        </section>
      </div>
    </IonContent>
  </IonPage>
</template>
