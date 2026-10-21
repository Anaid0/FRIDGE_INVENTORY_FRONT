import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { FundingPeriodDetail, PeriodSummary } from '@/domain/models';
import { useAuthStore } from '@/stores/auth';
import { adminUser, anaUser, setupFakeServices } from '@/testing/fakeServices';
import FundingPeriodDetailView from './FundingPeriodDetailView.vue';

const summary: PeriodSummary = {
  periodId: 'q2',
  name: 'Octubre · 2ª quincena',
  startDate: '2026-10-16',
  endDate: '2026-10-31',
  status: 'OPEN',
  collected: '120000.00',
  spent: '86500.00',
  balance: '33500.00',
  isOverspent: false,
};

const detail: FundingPeriodDetail = {
  period: {
    id: 'q2',
    name: summary.name,
    startDate: summary.startDate,
    endDate: summary.endDate,
    status: 'OPEN',
    notes: null,
    createdBy: adminUser.id,
    closedAt: null,
    createdAt: '2026-10-16T12:00:00.000Z',
  },
  summary,
  contributions: [
    {
      id: 'c1',
      periodId: 'q2',
      user: anaUser,
      amount: '20000.00',
      paidAt: '2026-10-16T12:00:00.000Z',
      note: null,
      registeredBy: adminUser,
      createdAt: '2026-10-16T12:00:00.000Z',
      charge: { id: 'ch1', periodId: 'q1', periodName: 'Oct · 1ª quincena' },
    },
  ],
  contributorTotals: [],
  purchases: [
    {
      id: 'p1',
      periodId: 'q2',
      periodName: summary.name,
      buyer: adminUser,
      store: 'Éxito',
      purchasedAt: '2026-10-19T15:00:00.000Z',
      total: '56500.00',
      itemsCount: 2,
      lines: [
        { productName: 'Coca cola 250ml', quantity: 12 },
        { productName: 'Agua', quantity: 2 },
      ],
      hasReceipt: false,
      voidedAt: null,
      createdAt: '2026-10-19T15:00:00.000Z',
    },
  ],
};

async function setup(current: PeriodSummary | null) {
  const { services } = setupFakeServices('t');
  const pinia = createPinia();
  setActivePinia(pinia);
  vi.mocked(services.auth.me).mockResolvedValue(adminUser);
  vi.mocked(services.users.options).mockResolvedValue([adminUser, anaUser]);
  vi.mocked(services.funding.current).mockResolvedValue(current);
  vi.mocked(services.funding.detail).mockResolvedValue(detail);
  vi.mocked(services.funding.list).mockResolvedValue(current ? [current] : []);
  vi.mocked(services.funding.pendingCharges).mockResolvedValue([]);
  vi.mocked(services.funding.charges).mockResolvedValue({
    periodId: 'q2',
    status: 'estimate',
    canGenerate: false,
    charges: [],
    totals: { amount: '0.00', paid: '0.00', pending: '0.00', unpricedUnits: 0 },
  });
  await useAuthStore().restoreSession();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/quincenas/:id', component: FundingPeriodDetailView, props: true },
      { path: '/:p(.*)*', component: { template: '<p/>' } },
    ],
  });
  await router.push('/admin/quincenas/actual');
  const wrapper = mount(FundingPeriodDetailView, {
    props: { id: 'actual' },
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return { wrapper, services };
}

describe('FundingPeriodDetailView', () => {
  it('con "actual" carga la quincena abierta y muestra su dinero, aportes y compras', async () => {
    const { wrapper, services } = await setup(summary);
    expect(services.funding.detail).toHaveBeenCalledWith('q2');
    const text = wrapper.text().replace(/\s/g, ' ');
    expect(wrapper.get('h1').text()).toBe('Octubre · 2ª quincena');
    expect(wrapper.get('[aria-label="Dinero de la quincena"]').text().replace(/\s/g, ' ')).toContain(
      '$ 33.500',
    );
    expect(text).toContain('1 de 2 al día');
    expect(text).toContain('Pago de consumo · Oct · 1ª quincena');
    expect(text).toContain('19 oct · sin comprobante');
    expect(text).toContain('12 Coca cola 250ml · 2 Agua');
    const link = wrapper.findAll('a').find((a) => a.text().includes('Registrar compra'))!;
    expect(link.attributes('href')).toBe('/admin/compras/nueva?periodo=q2');
    expect(wrapper.findAll('button').some((b) => b.text() === 'Cerrar quincena…')).toBe(true);
  });

  it('con "actual" y sin quincena abierta invita a abrir una', async () => {
    const { wrapper, services } = await setup(null);
    expect(services.funding.detail).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No hay una quincena abierta');
    const open = wrapper.findAll('a').find((a) => a.text().includes('Abrir quincena'))!;
    expect(open.attributes('href')).toBe('/admin/quincenas?abrir=1');
  });
});
