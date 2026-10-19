<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
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
      <div class="flex min-h-full flex-col lg:flex-row">
        <!-- Panel de marca (azul del logo): la nevera blanca con el mono marino asomándose. -->
        <section
          class="flex flex-col gap-5 bg-brand-600 px-6 pt-[calc(var(--ion-safe-area-top)+24px)] pb-7 text-white sm:px-10 lg:flex-1 lg:justify-between lg:gap-10 lg:p-14"
        >
          <div class="flex items-center gap-3">
            <span class="text-[26px] font-black tracking-tight"
              >Fridge<span class="text-brand-200">YA</span></span
            >
            <span
              class="rounded-full bg-brand-200 px-2.5 py-1 text-xs leading-none font-extrabold tracking-[0.08em] text-ink-900"
              >ADMIN</span
            >
          </div>
          <div class="flex items-center gap-5 lg:flex-col lg:justify-center">
            <svg
              viewBox="0 0 400 400"
              class="size-24 shrink-0 sm:size-28 lg:size-80"
              role="img"
              aria-label="Mono de FridgeYA asomándose sobre la nevera"
            >
              <g transform="translate(168,6) scale(0.62)">
                <circle cx="28" cy="100" r="31" fill="#fff" />
                <circle cx="172" cy="100" r="31" fill="#fff" />
                <circle cx="100" cy="100" r="81" fill="#fff" />
                <circle cx="28" cy="100" r="24" fill="#073b5e" />
                <circle cx="172" cy="100" r="24" fill="#073b5e" />
                <circle cx="28" cy="100" r="11" fill="#fff" />
                <circle cx="172" cy="100" r="11" fill="#fff" />
                <circle cx="100" cy="100" r="74" fill="#073b5e" />
                <circle cx="78" cy="90" r="28" fill="#fff" />
                <circle cx="122" cy="90" r="28" fill="#fff" />
                <ellipse cx="100" cy="128" rx="40" ry="32" fill="#fff" />
                <circle cx="80" cy="90" r="10" fill="#073b5e" />
                <circle cx="120" cy="90" r="10" fill="#073b5e" />
                <circle cx="83" cy="87" r="3" fill="#fff" />
                <circle cx="123" cy="87" r="3" fill="#fff" />
              </g>
              <rect x="96" y="96" width="208" height="262" rx="30" fill="#fff" />
              <line x1="96" y1="178" x2="304" y2="178" stroke="#0b79c3" stroke-width="8" />
              <rect x="118" y="118" width="12" height="40" rx="6" fill="#0b79c3" />
              <rect x="118" y="198" width="12" height="72" rx="6" fill="#0b79c3" />
              <circle cx="190" cy="98" r="15" fill="#073b5e" stroke="#fff" stroke-width="6" />
              <circle cx="276" cy="98" r="15" fill="#073b5e" stroke="#fff" stroke-width="6" />
              <circle cx="292" cy="330" r="40" fill="#ff8a1f" stroke="#0b79c3" stroke-width="8" />
              <path
                d="M273 331 L286 344 L310 318"
                stroke="#fff"
                stroke-width="10"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div class="flex max-w-[460px] flex-col gap-2 lg:hidden">
              <p class="text-2xl leading-tight font-black">La nevera de la oficina, en orden.</p>
            </div>
          </div>
          <div class="hidden max-w-[460px] flex-col gap-3 lg:flex">
            <p class="text-[40px] leading-[1.1] font-black">La nevera de la oficina, en orden.</p>
            <p class="text-lg text-brand-50/90">
              Productos, movimientos, quincenas y compras en un solo lugar. Una app de MonkeyJobs.
            </p>
          </div>
        </section>

        <section class="flex flex-1 items-start justify-center px-5 py-8 sm:px-8 lg:items-center lg:py-14">
          <form class="flex w-full max-w-[400px] flex-col gap-5" novalidate @submit.prevent="submit">
            <div class="flex flex-col gap-1.5">
              <h1 class="text-[26px] leading-tight font-black text-ink-900 sm:text-3xl">
                Entrar como administrador
              </h1>
              <p class="text-[15px] text-ink-500">
                Los empleados no necesitan cuenta: usan su nombre y PIN en la tablet.
              </p>
            </div>
            <p
              v-if="expired && !error"
              class="rounded-xl bg-warning-50/90 px-3.5 py-2.5 text-sm text-warning-700 ring-1 ring-warning-600/20"
              role="status"
            >
              Tu sesión terminó. Vuelve a iniciar sesión.
            </p>
            <p
              v-if="error"
              class="rounded-xl bg-danger-50/90 px-3.5 py-2.5 text-sm text-danger-700 ring-1 ring-danger-600/20"
              role="alert"
            >
              {{ error }}
            </p>

            <div>
              <label for="email" class="label">Email</label>
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                class="input h-12"
                autocomplete="username"
                required
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label for="password" class="label">Contraseña</label>
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                class="input h-12"
                autocomplete="current-password"
                required
              />
            </div>
            <button type="submit" class="btn-primary h-[50px] w-full text-base" :disabled="loading">
              {{ loading ? 'Entrando…' : 'Entrar' }}
            </button>
            <RouterLink
              to="/"
              class="inline-flex min-h-11 items-center justify-center gap-2 text-[15px] font-extrabold text-brand-600 hover:text-brand-800"
            >
              <Icon name="arrowLeft" :size="18" :stroke="2" /> Volver a la nevera (modo tablet)
            </RouterLink>
          </form>
        </section>
      </div>
    </IonContent>
  </IonPage>
</template>
