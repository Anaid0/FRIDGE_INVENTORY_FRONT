import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PinPad from './PinPad.vue';

const press = async (wrapper: ReturnType<typeof mount>, label: string) => {
  const button = wrapper
    .findAll('button')
    .find((b) => b.text() === label || b.attributes('aria-label') === label);
  await button!.trigger('click');
};

describe('PinPad', () => {
  it('emite el PIN al escribir el cuarto dígito', async () => {
    const wrapper = mount(PinPad, { props: { label: 'Escribe tu PIN' } });
    for (const digit of ['2', '5', '8']) await press(wrapper, digit);
    expect(wrapper.emitted('complete')).toBeUndefined();
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('3 de 4 dígitos');
    await press(wrapper, '0');
    expect(wrapper.emitted('complete')?.[0]).toEqual(['2580']);
  });

  it('borra el último dígito y acepta el teclado físico', async () => {
    const wrapper = mount(PinPad, { props: { label: 'PIN' }, attachTo: document.body });
    await press(wrapper, '1');
    await press(wrapper, 'Borrar');
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('0 de 4 dígitos');
    for (const key of ['7', '3', '5', '1']) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    expect(wrapper.emitted('complete')?.[0]).toEqual(['7351']);
    wrapper.unmount();
  });

  it('ante un error lo muestra y vacía el teclado', async () => {
    const wrapper = mount(PinPad, { props: { label: 'PIN', error: null } });
    await press(wrapper, '1');
    await wrapper.setProps({ error: 'PIN incorrecto. Te quedan 4 intentos.' });
    expect(wrapper.get('[role="alert"]').text()).toContain('Te quedan 4 intentos');
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('0 de 4 dígitos');
  });

  it('deshabilitado no acepta dígitos', async () => {
    const wrapper = mount(PinPad, { props: { label: 'PIN', disabled: true } });
    for (const digit of ['1', '2', '3', '4']) await press(wrapper, digit);
    expect(wrapper.emitted('complete')).toBeUndefined();
  });
});
