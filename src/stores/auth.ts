import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from '@/domain/models';
import { useServices, useTokenStorage } from '@/services/container';

export const useAuthStore = defineStore('auth', () => {
  const { auth } = useServices();
  const tokens = useTokenStorage();

  const user = ref<User | null>(null);
  const token = ref<string | null>(tokens.get());
  /** Ya se intentó recuperar la sesión guardada (evita llamar /auth/me en cada navegación). */
  const restored = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  async function login(email: string, password: string): Promise<User> {
    const result = await auth.login(email.trim(), password);
    tokens.set(result.token);
    token.value = result.token;
    user.value = result.user;
    restored.value = true;
    return result.user;
  }

  function logout(): void {
    tokens.clear();
    token.value = null;
    user.value = null;
  }

  /** Si hay un token guardado, carga el usuario; si ya no es válido, cierra la sesión. */
  async function restoreSession(): Promise<void> {
    if (restored.value) return;
    restored.value = true;
    if (!token.value) return;
    try {
      user.value = await auth.me();
    } catch {
      logout();
    }
  }

  return { user, token, isAuthenticated, isAdmin, login, logout, restoreSession };
});
