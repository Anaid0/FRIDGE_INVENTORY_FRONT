import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { createMemoryTokens } from '@/testing/fakeServices';
import { createApiClient } from './apiClient';
import { createHttpServices } from './httpServices';

function recordingServices() {
  const calls: InternalAxiosRequestConfig[] = [];
  const client = createApiClient({ baseURL: '/api', tokens: createMemoryTokens() });
  client.defaults.adapter = async (config) => {
    calls.push(config);
    return { status: 200, data: { ok: true }, statusText: '', headers: {}, config };
  };
  return { services: createHttpServices(client), calls };
}

describe('createHttpServices', () => {
  it('no envía filtros vacíos en la query', async () => {
    const { services, calls } = recordingServices();
    await services.catalog.listProducts({ search: '', lowStock: true, categoryId: undefined });
    expect(calls[0]?.url).toBe('/products');
    expect(calls[0]?.params).toEqual({ lowStock: true });
  });

  it('historial de la tablet: GET /movements paginado, con el tipo solo si se elige', async () => {
    const { services, calls } = recordingServices();
    await services.kiosk.movements({ page: 2, pageSize: 20, type: 'IN' });
    await services.kiosk.movements({ page: 1, pageSize: 20, type: undefined });
    expect(calls[0]?.url).toBe('/movements');
    expect(calls[0]?.params).toEqual({ page: 2, pageSize: 20, type: 'IN' });
    expect(calls[1]?.params).toEqual({ page: 1, pageSize: 20 });
  });

  it('una compra sin comprobante se envía como JSON', async () => {
    const { services, calls } = recordingServices();
    const items = [{ productId: 'p1', quantity: 2, unitPrice: '2500' }];
    await services.purchases.register({ periodId: 'q', buyerId: 'u', purchasedAt: '2026-10-16', items });
    expect(JSON.parse(calls[0]?.data as string)).toEqual({
      periodId: 'q',
      buyerId: 'u',
      purchasedAt: '2026-10-16',
      items,
    });
  });

  it('una compra con comprobante se envía como multipart con items en JSON', async () => {
    const { services, calls } = recordingServices();
    const receipt = new File(['x'], 'recibo.png', { type: 'image/png' });
    await services.purchases.register({
      periodId: 'q',
      buyerId: 'u',
      store: '',
      purchasedAt: '2026-10-16',
      items: [{ productId: 'p1', quantity: 2, unitPrice: '2500' }],
      receipt,
    });
    const form = calls[0]?.data as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('periodId')).toBe('q');
    expect(form.has('store')).toBe(false);
    expect(JSON.parse(form.get('items') as string)).toHaveLength(1);
    expect((form.get('receipt') as File).name).toBe('recibo.png');
  });

  it('ranking por quincena: en vivo por id, estado y "calcular el más hambriento"', async () => {
    const { services, calls } = recordingServices();
    await services.movements.topWithdrawers({ periodId: 'q1' }, 10);
    await services.movements.topWithdrawers('period');
    await services.funding.ranking('q1');
    await services.funding.computeRanking('q1');
    expect(calls.map((c) => [c.method, c.url, c.params])).toEqual([
      ['get', '/stats/top-withdrawers', { periodId: 'q1', limit: 10 }],
      ['get', '/stats/top-withdrawers', { period: 'period' }],
      ['get', '/funding-periods/q1/ranking', undefined],
      ['post', '/funding-periods/q1/ranking', undefined],
    ]);
  });

  it('usa las rutas y métodos de la API', async () => {
    const { services, calls } = recordingServices();
    await services.movements.topWithdrawers('week', 3);
    await services.funding.close('q1');
    await services.purchases.void('c1');
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['get', '/stats/top-withdrawers'],
      ['patch', '/funding-periods/q1/close'],
      ['post', '/purchases/c1/void'],
    ]);
    expect(calls[0]?.params).toEqual({ period: 'week', limit: 3 });
  });
});
