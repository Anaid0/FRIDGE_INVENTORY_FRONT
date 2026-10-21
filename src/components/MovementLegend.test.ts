import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import MovementLegend from './MovementLegend.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MovementLegend', () => {
  it('abre la nota de las flechas y se cierra con Escape o tocando fuera', async () => {
    const wrapper = mount(MovementLegend, { attachTo: document.body });
    const button = wrapper.get('button[aria-label="Qué significan las flechas"]');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);

    await button.trigger('click');
    const tip = wrapper.get('[role="tooltip"]');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(button.attributes('aria-describedby')).toBe(tip.attributes('id'));
    expect(tip.text()).toContain('Retiro: alguien sacó de la nevera');
    expect(tip.text()).toContain('Ingreso: entró a la nevera (compra o ingreso del administrador)');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);

    await button.trigger('click');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
