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
    /** 'admin' muestra el menú lateral; 'kiosk' es pantalla completa para la tablet. */
    layout?: 'admin' | 'kiosk';
  }
}

const admin = (
  path: string,
  name: string,
  component: RouteRecordRaw['component'],
  title: string,
  props = false,
) =>
  ({
    path: `/admin${path}`,
    name,
    component,
    props,
    meta: { title, layout: 'admin' },
  }) as RouteRecordRaw;

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'kiosk',
    component: () => import('@/views/kiosk/KioskHomeView.vue'),
    meta: { title: 'Nevera', public: true, layout: 'kiosk' },
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
  admin('/productos', 'products', () => import('@/views/ProductsView.vue'), 'Productos'),
  admin('/productos/nuevo', 'product-new', () => import('@/views/ProductFormView.vue'), 'Nuevo producto'),
  admin(
    '/productos/:id/editar',
    'product-edit',
    () => import('@/views/ProductFormView.vue'),
    'Editar producto',
    true,
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
  admin('/compras/nueva', 'purchase-new', () => import('@/views/PurchaseFormView.vue'), 'Registrar compra'),
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
