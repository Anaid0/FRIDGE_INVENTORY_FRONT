import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { TopWithdrawer } from '@/domain/models';
import { useStatsStore } from '@/stores/stats';
import { setupFakeServices } from '@/testing/fakeServices';
import TopWithdrawerBadge from './TopWithdrawerBadge.vue';

async function mountBadge(top: TopWithdrawer | null) {
  const { services } = setupFakeServices();
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.movements.topWithdrawers).mockResolvedValue(top ? [top] : []);
  await useStatsStore().refresh();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<p/>' } }],
  });
  return mount(TopWithdrawerBadge, { global: { plugins: [pinia, router] } });
}

describe('TopWithdrawerBadge', () => {
  it('muestra a quien más retira', async () => {
    const wrapper = await mountBadge({
      user: { id: 'u', name: 'Ana', lastname: 'Pérez' },
      totalWithdrawn: 12,
      withdrawals: 4,
    });
    expect(wrapper.text()).toContain('Ana Pérez');
    expect(wrapper.text()).toContain('12 und.');
    expect(wrapper.attributes('href')).toBe('/admin/ranking');
  });

  it('sin retiros lo dice', async () => {
    const wrapper = await mountBadge(null);
    expect(wrapper.text()).toContain('Aún no hay retiros');
  });
});
