import type { AxiosInstance } from 'axios';
import type { MovementView, PeriodRanking, RankingPeriod, RankingScope } from '@/domain/models';
import type {
  AuthService,
  CatalogService,
  FundingService,
  KioskAdminService,
  KioskService,
  MovementService,
  PeopleService,
  PurchaseService,
  ReportService,
  Services,
  UserService,
} from '../ports';

/** Quita claves undefined/'' para no mandar parámetros vacíos en la query. */
function clean<T extends object>(params?: T): Partial<T> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

/** `'week'` → `{ period: 'week' }`; `{ periodId }` se envía tal cual. */
const rankingScope = (scope: RankingPeriod | RankingScope) =>
  typeof scope === 'string' ? { period: scope } : scope;

/** Servicios de la tablet sobre su propio cliente HTTP (token de tablet). */
export function createKioskService(http: AxiosInstance): KioskService {
  const get = async <T>(url: string, params?: object) =>
    (await http.get<T>(url, { params: clean(params) })).data;
  return {
    me: () => get('/kiosk/me'),
    people: () => get('/kiosk/people'),
    products: () => get('/products'),
    categories: () => get('/categories'),
    topWithdrawers: (scope = 'all', limit) =>
      get('/stats/top-withdrawers', { ...rankingScope(scope), limit }),
    latestHungriest: async () =>
      (await get<{ ranking: PeriodRanking | null }>('/stats/hungriest/latest')).ranking,
    rankingPeriods: () => get('/stats/ranking-periods'),
    periodRanking: (periodId) => get(`/funding-periods/${periodId}/ranking`),
    computeRanking: async (periodId) => (await http.post(`/funding-periods/${periodId}/ranking`)).data,
    latestMovements: async (limit = 20) =>
      (await get<{ items: MovementView[] }>('/movements', { pageSize: limit })).items,
    movements: (query) => get('/movements', query),
    register: async (input) => (await http.post('/kiosk/movements', input)).data,
    adminSession: async (code) => (await http.post('/kiosk/admin-session', { code })).data,
    changePin: async (currentPin, newPin) => (await http.post('/kiosk/pin', { currentPin, newPin })).data,
  };
}

/**
 * Servicios de la administración sobre el cliente con la sesión del admin.
 * `kioskHttp` (opcional) es el cliente con el token de la tablet; si falta se usa el mismo.
 */
export function createHttpServices(http: AxiosInstance, kioskHttp: AxiosInstance = http): Services {
  const get = async <T>(url: string, params?: object) =>
    (await http.get<T>(url, { params: clean(params) })).data;
  const post = async <T>(url: string, body?: unknown) => (await http.post<T>(url, body)).data;
  const patch = async <T>(url: string, body?: unknown) => (await http.patch<T>(url, body)).data;

  const auth: AuthService = {
    login: (email, password) => post('/auth/login', { email, password }),
    me: () => get('/auth/me'),
    setAdminCode: async (password, code) => {
      await http.put('/auth/me/admin-code', { password, code });
    },
  };

  const users: UserService = {
    list: (filter) => get('/users', filter),
    options: () => get('/users/options'),
    createAdmin: (input) => post('/users', input),
    update: (id, input) => patch(`/users/${id}`, input),
  };

  const people: PeopleService = {
    list: (filter) => get('/people', filter),
    activity: (periodId) => get('/stats/people-activity', { periodId }),
    create: (input) => post('/people', input),
    update: (id, input) => patch(`/people/${id}`, input),
    resetPin: (id, pin, adminPassword) => post(`/people/${id}/pin`, { pin, adminPassword }),
  };

  const kioskAdmin: KioskAdminService = {
    listDevices: () => get('/kiosk/devices'),
    pair: (name) => post('/kiosk/devices', { name }),
    revoke: async (id) => (await http.delete(`/kiosk/devices/${id}`)).data,
  };

  const catalog: CatalogService = {
    listCategories: () => get('/categories'),
    createCategory: (name) => post('/categories', { name }),
    listProducts: (filter) => get('/products', filter),
    getProduct: (id) => get(`/products/${id}`),
    createProduct: (input) => post('/products', input),
    updateProduct: (id, input) => patch(`/products/${id}`, input),
  };

  const movements: MovementService = {
    stockIn: (input) => post('/movements/in', input),
    stockOut: (input) => post('/movements/out', input),
    list: (filter) => get('/movements', filter),
    topWithdrawers: (scope = 'all', limit) =>
      get('/stats/top-withdrawers', { ...rankingScope(scope), limit }),
    dashboard: () => get('/dashboard/summary'),
  };

  const funding: FundingService = {
    list: () => get('/funding-periods'),
    current: () => get('/funding-periods/current'),
    detail: (id) => get(`/funding-periods/${id}`),
    open: (input) => post('/funding-periods', input),
    close: (id) => patch(`/funding-periods/${id}/close`),
    contribute: (periodId, input) => post(`/funding-periods/${periodId}/contributions`, input),
    ranking: (periodId) => get(`/funding-periods/${periodId}/ranking`),
    charges: (periodId) => get(`/funding-periods/${periodId}/charges`),
    generateCharges: (periodId) => post(`/funding-periods/${periodId}/charges`),
    pendingCharges: () => get('/charges/pending'),
    payCharge: (chargeId, input = {}) => post(`/charges/${chargeId}/payments`, input),
    computeRanking: (periodId) => post(`/funding-periods/${periodId}/ranking`),
  };

  const purchases: PurchaseService = {
    list: (filter) => get('/purchases', filter),
    detail: (id) => get(`/purchases/${id}`),
    register: ({ receipt, items, ...fields }) => {
      // Con comprobante se envía multipart (items como JSON); sin comprobante, JSON normal.
      if (!receipt) return post('/purchases', { ...fields, items });
      const form = new FormData();
      for (const [key, value] of Object.entries(clean(fields) ?? {})) form.append(key, String(value));
      form.append('items', JSON.stringify(items));
      form.append('receipt', receipt);
      return post('/purchases', form);
    },
    void: (id) => post(`/purchases/${id}/void`),
    receipt: async (id) => (await http.get<Blob>(`/purchases/${id}/receipt`, { responseType: 'blob' })).data,
  };

  const reports: ReportService = {
    spendingByProduct: (scope) => get('/reports/spending-by-product', scope),
    spendingByCategory: (scope) => get('/reports/spending-by-category', scope),
    priceHistory: (productId, range) => get(`/reports/price-history/${productId}`, range),
  };

  return {
    auth,
    users,
    people,
    kioskAdmin,
    kiosk: createKioskService(kioskHttp),
    catalog,
    movements,
    funding,
    purchases,
    reports,
  };
}
