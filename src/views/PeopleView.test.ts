import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Person } from '@/domain/models';
import { setupFakeServices } from '@/testing/fakeServices';
import { dialogStubs } from '@/testing/stubs';
import PeopleView from './PeopleView.vue';

const person = (id: string, name: string, lastname: string, extra: Partial<Person> = {}): Person => ({
  id,
  name,
  lastname,
  fullName: `${name} ${lastname}`,
  isActive: true,
  hasPin: true,
  isPinLocked: false,
  pinLockedUntil: null,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

const david = person('u1', 'David', 'Ospino');
const jimmy = person('u2', 'Jimmy', 'Caro', { isPinLocked: true });
const andres = person('u3', 'Andres', 'Carrero');
const sofia = person('u4', 'Sofía', 'Ruiz', { isActive: false });

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

async function setup() {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.people.list).mockResolvedValue([david, jimmy, andres, sofia]);
  vi.mocked(services.people.activity).mockResolvedValue({
    period: { id: 'q1', name: 'Octubre 2ª', startDate: '2026-10-16', endDate: '2026-10-31' },
    people: [{ userId: 'u1', withdrawn: 7, stored: 0 }],
  });
  vi.mocked(services.movements.topWithdrawers).mockResolvedValue([
    { user: david, totalWithdrawn: 7, withdrawals: 7 },
  ]);
  vi.mocked(services.users.options).mockResolvedValue([]);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/personas', component: PeopleView },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/admin/personas');
  const wrapper = mount(PeopleView, {
    global: { plugins: [pinia, router], stubs: dialogStubs },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, services };
}

const rows = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper.findAll('ul[aria-label="Personas"] > li');

describe('PeopleView', () => {
  it('lista las activas con su actividad de la quincena, el #1 y el bloqueo', async () => {
    const { wrapper } = await setup();
    expect(wrapper.text()).toContain('3 activas · cada una retira con su PIN único');
    expect(wrapper.text()).toContain('Activas · 3');
    expect(wrapper.text()).toContain('Desactivadas · 1');

    const [first, second, third] = rows(wrapper);
    expect(rows(wrapper)).toHaveLength(3);
    expect(first!.text()).toContain('#1');
    expect(first!.text()).toContain('7 retiradas esta quincena');
    expect(first!.text()).toContain('Restablecer PIN');
    expect(second!.text()).toContain('Bloqueado · 5 PIN incorrectos');
    expect(second!.text()).toContain('Desbloquear');
    expect(third!.text()).toContain('Sin retiros');
  });

  it('el segmentado muestra las desactivadas, que se pueden reactivar', async () => {
    const { wrapper } = await setup();
    await wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('Desactivadas'))!
      .trigger('click');
    expect(rows(wrapper)).toHaveLength(1);
    expect(rows(wrapper)[0]!.text()).toContain('Sofía Ruiz');
    expect(rows(wrapper)[0]!.text()).toContain('Reactivar');
  });

  it('"Restablecer PIN" abre el diálogo que pide la contraseña del administrador', async () => {
    const { wrapper } = await setup();
    await rows(wrapper)[0]!
      .findAll('button')
      .find((b) => b.text() === 'Restablecer PIN')!
      .trigger('click');
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain('Restablecer PIN de David Ospino');
    expect(dialog.find('#pp-admin-password').exists()).toBe(true);
  });

  it('agregar persona: el PIN se muestra 5 s, se confirma de memoria y se crea', async () => {
    const { wrapper, services } = await setup();
    vi.useFakeTimers();
    vi.mocked(services.people.create).mockResolvedValue(person('u9', 'Johanna', 'Mahecha'));
    await wrapper.get('#np-name').setValue('Johanna');
    await wrapper.get('#np-lastname').setValue('Mahecha');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Generar')!
      .trigger('click');
    const pin = wrapper.get<HTMLInputElement>('#np-pin').element.value;
    expect(wrapper.get<HTMLInputElement>('#np-pin-confirm').element.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    await wrapper.get('#np-pin-confirm').setValue(pin);
    await wrapper.get('form').trigger('submit');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(services.people.create).toHaveBeenCalledWith({ name: 'Johanna', lastname: 'Mahecha', pin });
  });
});
