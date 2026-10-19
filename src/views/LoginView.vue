<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
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
      <div class="grid min-h-full place-items-center bg-gradient-to-b from-brand-50 to-ink-50 px-4 py-10">
        <div class="w-full max-w-sm">
          <div class="mb-6 text-center">
            <img src="/favicon.svg" alt="" class="mx-auto mb-3 size-12" />
            <h1 class="text-2xl font-bold tracking-tight text-ink-900">
              Fridge<span class="text-brand-700">YA</span>
            </h1>
            <p class="mt-1 text-sm text-ink-500">Acceso para administradores</p>
          </div>

          <form class="card space-y-4 p-6" novalidate @submit.prevent="submit">
            <p
              v-if="expired && !error"
              class="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700"
              role="status"
            >
              Tu sesión terminó. Vuelve a iniciar sesión.
            </p>
            <p v-if="error" class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
              {{ error }}
            </p>

            <div>
              <label for="email" class="label">Email</label>
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                class="input"
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
                class="input"
                autocomplete="current-password"
                required
              />
            </div>
            <button type="submit" class="btn-primary w-full" :disabled="loading">
              {{ loading ? 'Entrando…' : 'Entrar' }}
            </button>
          </form>
          <p class="mt-4 text-center text-sm">
            <RouterLink to="/" class="font-medium text-brand-700 hover:underline"
              >← Volver a la nevera</RouterLink
            >
          </p>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
