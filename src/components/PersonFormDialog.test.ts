import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Person } from '@/domain/models';
import { ApiError } from '@/services/errors';
import { setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import PersonFormDialog from './PersonFormDialog.vue';

const david: Person = {
  id: 'u1',
  name: 'David',
  lastname: 'Ospino',
  fullName: 'David Ospino',
  isActive: true,
  hasPin: true,
  isPinLocked: false,
  pinLockedUntil: null,
  createdAt: '',
  updatedAt: '',
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function setup(mode: 'create' | 'edit' | 'pin', person: Person | null = david) {
  vi.useFakeTimers();
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(PersonFormDialog, {
    props: { open: true, mode, person },
    global: { plugins: [pinia], stubs: dialogStubs },
    attachTo: document.body,
  });
  const submit = () => wrapper.get<HTMLButtonElement>('button[type="submit"]');
  return { wrapper, services, submit };
}

/** Genera un PIN, espera a que se oculte y lo confirma de memoria. */
async function confirmGeneratedPin(wrapper: ReturnType<typeof setup>['wrapper']) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Generar')!
    .trigger('click');
  const pin = wrapper.get<HTMLInputElement>('#pp-pin').element.value;
  await vi.advanceTimersByTimeAsync(5000);
  await wrapper.get('#pp-pin-confirm').setValue(pin);
  return pin;
}

describe('PersonFormDialog', () => {
  it('restablecer el PIN exige confirmarlo de memoria y la contraseña del administrador', async () => {
    const { wrapper, services, submit } = setup('pin');
    vi.mocked(services.people.resetPin).mockResolvedValue(david);
    expect(wrapper.text()).toContain('Restablecer PIN de David Ospino');
    expect(submit().element.disabled).toBe(true);

    const pin = await confirmGeneratedPin(wrapper);
    expect(submit().element.disabled).toBe(true); // falta la contraseña

    await wrapper.get('#pp-admin-password').setValue('secreta');
    expect(submit().element.disabled).toBe(false);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.people.resetPin).toHaveBeenCalledWith('u1', pin, 'secreta');
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('una contraseña de administrador incorrecta se muestra junto a ese campo', async () => {
    const { wrapper, services } = setup('pin');
    vi.mocked(services.people.resetPin).mockRejectedValue(
      new ApiError(400, 'INVALID_ADMIN_PASSWORD', 'La contraseña no es correcta.'),
    );
    await confirmGeneratedPin(wrapper);
    await wrapper.get('#pp-admin-password').setValue('mala');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('La contraseña no es correcta.');
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('una persona bloqueada: avisa que el PIN nuevo la desbloquea', () => {
    const { wrapper } = setup('pin', { ...david, isPinLocked: true });
    expect(wrapper.text()).toContain('el PIN nuevo lo desbloquea');
  });

  it('editar solo cambia nombre y apellido (sin PIN ni contraseña)', async () => {
    const { wrapper, services } = setup('edit');
    vi.mocked(services.people.update).mockResolvedValue({ ...david, name: 'Dave' });
    expect(wrapper.find('#pp-pin').exists()).toBe(false);
    expect(wrapper.find('#pp-admin-password').exists()).toBe(false);
    await wrapper.get('#pp-name').setValue('Dave');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(services.people.update).toHaveBeenCalledWith('u1', { name: 'Dave', lastname: 'Ospino' });
  });
});
