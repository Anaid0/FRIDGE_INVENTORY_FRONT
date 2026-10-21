import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PinSetup from './PinSetup.vue';

afterEach(() => vi.useRealTimers());

function setup() {
  vi.useFakeTimers();
  const wrapper = mount(PinSetup, { props: { idPrefix: 't', modelValue: '' }, attachTo: document.body });
  const pinInput = () => wrapper.get<HTMLInputElement>('#t-pin');
  const confirm = () => wrapper.get<HTMLInputElement>('#t-pin-confirm');
  const lastModel = () => wrapper.emitted('update:modelValue')?.at(-1)?.[0];
  return { wrapper, pinInput, confirm, lastModel };
}

describe('PinSetup', () => {
  it('muestra el PIN generado 5 s, luego lo oculta y pide confirmarlo de memoria', async () => {
    const { wrapper, pinInput, confirm, lastModel } = setup();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Generar')!
      .trigger('click');
    const pin = pinInput().element.value;
    expect(pin).toMatch(/^\d{4}$/);
    expect(confirm().element.disabled).toBe(true);
    expect(wrapper.text()).toContain('se oculta en 5 s');

    await vi.advanceTimersByTimeAsync(5000);
    expect(pinInput().element.value).toBe('••••');
    expect(confirm().element.disabled).toBe(false);

    await confirm().setValue(pin === '9999' ? '1111' : '9999');
    expect(wrapper.text()).toContain('Los PIN no coinciden');
    expect(lastModel() ?? '').toBe('');

    await confirm().setValue(pin);
    expect(wrapper.text()).toContain('Los PIN coinciden');
    expect(lastModel()).toBe(pin);
    wrapper.unmount();
  });

  it('un PIN escrito a mano también se muestra y se oculta; los obvios no se aceptan', async () => {
    const { wrapper, pinInput, confirm } = setup();
    await pinInput().setValue('1234');
    expect(wrapper.text()).toContain('muy fácil de adivinar');
    expect(confirm().element.disabled).toBe(true);

    await pinInput().setValue('7319');
    await vi.advanceTimersByTimeAsync(5000);
    expect(pinInput().element.value).toBe('••••');

    // "Ver de nuevo" lo muestra otra vez y borra la confirmación.
    await confirm().setValue('73');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Ver de nuevo'))!
      .trigger('click');
    expect(pinInput().element.value).toBe('7319');
    expect(confirm().element.value).toBe('');
    wrapper.unmount();
  });
});
