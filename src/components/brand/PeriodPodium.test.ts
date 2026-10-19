import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { PeriodRankingEntry } from '@/domain/models';
import PeriodPodium from './PeriodPodium.vue';

const entry = (name: string, position: number, totalWithdrawn: number): PeriodRankingEntry => ({
  position,
  user: { id: name, name, lastname: 'Test' },
  totalWithdrawn,
  withdrawals: 1,
});

describe('PeriodPodium', () => {
  it('pone a los tres primeros en los escalones (1.º al centro) y se lee en orden', () => {
    const wrapper = mount(PeriodPodium, {
      props: { podium: [entry('Ana', 1, 9), entry('Luis', 2, 5), entry('Marta', 3, 1)] },
    });
    const steps = wrapper.findAll('li');
    expect(steps.map((li) => li.text())).toEqual([
      expect.stringContaining('Ana'),
      expect.stringContaining('Luis'),
      expect.stringContaining('Marta'),
    ]);
    expect(steps.map((li) => li.attributes('style'))).toEqual(['order: 2;', 'order: 1;', 'order: 3;']);
    expect(steps[0]!.text()).toContain('9 und.');
  });

  it('con empate muestra el puesto real; los escalones vacíos quedan con guion', () => {
    const wrapper = mount(PeriodPodium, { props: { podium: [entry('Ana', 1, 4), entry('Luis', 1, 4)] } });
    const steps = wrapper.findAll('li');
    expect(steps[1]!.text()).toContain('puesto 1');
    expect(steps[0]!.text()).not.toContain('puesto');
    expect(steps[2]!.text()).toBe('—');
  });
});
