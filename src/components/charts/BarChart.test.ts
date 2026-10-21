import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BarChart from './BarChart.vue';

const rows = [
  { key: 'a', label: 'Ana', value: 10, valueLabel: '10 und.', detail: '3 retiros' },
  { key: 'b', label: 'Luis', value: 5, valueLabel: '5 und.' },
];

describe('BarChart', () => {
  it('escala las barras respecto al máximo y resalta solo la enfatizada', () => {
    const wrapper = mount(BarChart, { props: { rows, caption: 'Retiros', emphasizeKey: 'a' } });
    const bars = wrapper.findAll('li [data-bar]');
    expect(bars[0]?.attributes('style')).toContain('width: 100%');
    expect(bars[1]?.attributes('style')).toContain('width: 50%');
    expect(bars[0]?.attributes('style')).toContain('--color-brand-600');
    expect(bars[1]?.attributes('style')).toContain('--color-ink-300');
  });

  it('cada barra es enfocable con su valor y existe una tabla accesible', async () => {
    const wrapper = mount(BarChart, { props: { rows, caption: 'Retiros', valueHeader: 'Unidades' } });
    const first = wrapper.get('li');
    expect(first.attributes('tabindex')).toBe('0');
    expect(first.attributes('aria-label')).toBe('Ana: 10 und., 3 retiros');
    await first.trigger('focus');
    expect(wrapper.get('[role="tooltip"]').text()).toContain('10 und.');
    expect(wrapper.get('table caption').text()).toBe('Retiros');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
  });
});
