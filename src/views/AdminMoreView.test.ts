import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { adminUser, setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import AdminMoreView from './AdminMoreView.vue';

async function setup(hasAdminCode = false) {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue({ ...adminUser, hasAdminCode });
  vi.mocked(services.people.list).mockResolvedValue([]);
  await useAuthStore().restoreSession();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/mas', component: AdminMoreView },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/admin/mas');
  const wrapper = mount(AdminMoreView, { global: { plugins: [pinia, router], stubs: dialogStubs } });
  await flushPromises();
  return { wrapper, services, router };
}

async function openAndFill(
  wrapper: Awaited<ReturnType<typeof setup>>['wrapper'],
  values: { password: string; code: string; repeat: string },
) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Cambiar código')!
    .trigger('click');
  await wrapper.get('#code-password').setValue(values.password);
  await wrapper.get('#code-new').setValue(values.code);
  await wrapper.get('#code-repeat').setValue(values.repeat);
  await wrapper.get('[role="dialog"] form').trigger('submit');
  await flushPromises();
}

describe('AdminMoreView · Cambiar código', () => {
  it('avisa si aún no hay código y valida antes de llamar a la API', async () => {
    const { wrapper, services } = await setup();
    expect(wrapper.text()).toContain('Aún no tienes código');

    await openAndFill(wrapper, { password: '', code: '12', repeat: '12' });
    expect(wrapper.text()).toContain('Escribe tu contraseña.');
    expect(wrapper.text()).toContain('El código debe tener de 4 a 6 dígitos.');

    await wrapper.get('#code-password').setValue('Secreta1');
    await wrapper.get('#code-new').setValue('1a2b34');
    expect((wrapper.get('#code-new').element as HTMLInputElement).value).toBe('1234');
    await wrapper.get('#code-repeat').setValue('4321');
    await wrapper.get('[role="dialog"] form').trigger('submit');
    expect(wrapper.text()).toContain('Los códigos no coinciden.');
    expect(services.auth.setAdminCode).not.toHaveBeenCalled();
  });

  it('muestra en su campo el error de la API', async () => {
    const { wrapper, services } = await setup();
    vi.mocked(services.auth.setAdminCode).mockRejectedValue(
      new ApiError(409, 'ADMIN_CODE_TAKEN', 'Ese código ya lo usa otro administrador'),
    );
    await openAndFill(wrapper, { password: 'Secreta1', code: '2580', repeat: '2580' });
    expect(services.auth.setAdminCode).toHaveBeenCalledWith('Secreta1', '2580');
    expect(wrapper.get('#code-new-error').text()).toContain('Ese código ya lo usa otro administrador');
  });

  it('guarda el código y refresca el usuario', async () => {
    const { wrapper, services } = await setup();
    vi.mocked(services.auth.setAdminCode).mockResolvedValue();
    vi.mocked(services.auth.me).mockResolvedValue({ ...adminUser, hasAdminCode: true });
    await openAndFill(wrapper, { password: 'Secreta1', code: '2580', repeat: '2580' });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(useAuthStore().user?.hasAdminCode).toBe(true);
    expect(wrapper.text()).not.toContain('Aún no tienes código');
  });
});
