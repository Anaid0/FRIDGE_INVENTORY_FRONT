import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { createAuthGuard } from './guards';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** No requiere sesión de administrador. */
    public?: boolean;
    /** Solo para quien NO ha iniciado sesión (login). */
    guestOnly?: boolean;
    requiresAdmin?: boolean;
    /** 'admin' muestra la barra de pestañas; 'kiosk' es pantalla completa (la máquina). */
    layout?: 'admin' | 'kiosk';
    /** Con `false` no se muestra la barra de pestañas (pantallas con su propia barra de guardar). */
    tabs?: boolean;
  }
}

const admin = (
  path: string,
  name: string,
  component: RouteRecordRaw['component'],
  title: string,
  props = false,
  tabs = true,
) =>
  ({
    path: `/admin${path}`,
    name,
    component,
    props,
    meta: { title, layout: 'admin', tabs },
  }) as RouteRecordRaw;

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'kiosk',
    component: () => import('@/views/kiosk/KioskMachineView.vue'),
    meta: { title: 'Nevera', public: true, layout: 'kiosk' },
  },
  {
    path: '/ranking',
    name: 'kiosk-ranking',
    component: () => import('@/views/kiosk/KioskRankingView.vue'),
    meta: { title: 'Ranking', public: true, layout: 'kiosk' },
  },
  {
    path: '/historial',
    name: 'kiosk-history',
    component: () => import('@/views/kiosk/KioskHistoryView.vue'),
    meta: { title: 'Historial', public: true, layout: 'kiosk' },
  },
  {
    path: '/configurar-servidor',
    name: 'server-setup',
    component: () => import('@/views/ServerSetupView.vue'),
    meta: { title: 'Servidor', public: true, layout: 'kiosk' },
  },
  {
    path: '/admin/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Administración', public: true, guestOnly: true },
  },
  admin('', 'dashboard', () => import('@/views/DashboardView.vue'), 'Inicio'),
  admin('/ingresar', 'stock-in', () => import('@/views/StockInView.vue'), 'Ingresar stock', false, false),
  admin('/mas', 'more', () => import('@/views/AdminMoreView.vue'), 'Más'),
  admin('/productos', 'products', () => import('@/views/ProductsView.vue'), 'Productos'),
  admin(
    '/productos/nuevo',
    'product-new',
    () => import('@/views/ProductFormView.vue'),
    'Nuevo producto',
    false,
    false,
  ),
  admin(
    '/productos/:id/editar',
    'product-edit',
    () => import('@/views/ProductFormView.vue'),
    'Editar producto',
    true,
    false,
  ),
  admin('/movimientos', 'movements', () => import('@/views/MovementsView.vue'), 'Movimientos'),
  admin('/ranking', 'ranking', () => import('@/views/RankingView.vue'), 'Ranking'),
  admin('/quincenas', 'periods', () => import('@/views/FundingPeriodsView.vue'), 'Quincenas'),
  admin(
    '/quincenas/:id',
    'period-detail',
    () => import('@/views/FundingPeriodDetailView.vue'),
    'Quincena',
    true,
  ),
  admin('/compras', 'purchases', () => import('@/views/PurchasesView.vue'), 'Compras'),
  admin(
    '/compras/nueva',
    'purchase-new',
    () => import('@/views/PurchaseFormView.vue'),
    'Registrar compra',
    false,
    false,
  ),
  admin('/compras/:id', 'purchase-detail', () => import('@/views/PurchaseDetailView.vue'), 'Compra', true),
  admin('/reportes', 'reports', () => import('@/views/SpendingReportsView.vue'), 'Reportes de gasto'),
  admin('/personas', 'people', () => import('@/views/PeopleView.vue'), 'Personas'),
  admin('/tablets', 'tablets', () => import('@/views/TabletsView.vue'), 'Tablets'),
  admin('/administradores', 'admins', () => import('@/views/AdminsView.vue'), 'Administradores'),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'No encontrado', public: true },
  },
];

export function createAppRouter(needsServerSetup: () => boolean = () => false) {
  const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes });
  router.beforeEach(createAuthGuard(() => useAuthStore(), needsServerSetup));
  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · FridgeYA` : 'FridgeYA';
  });
  return router;
}
