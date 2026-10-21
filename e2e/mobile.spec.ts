import { expect, test } from '@playwright/test';
import {
  activeView,
  apiAdminToken,
  apiPairTablet,
  cartPanel,
  horizontalOverflow,
  keypad,
  kioskRegister,
  LUIS,
  loginAdmin,
  machine,
  openPairedTablet,
  resetDatabase,
  tapProduct,
} from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

test.beforeAll(() => resetDatabase());

const ADMIN_PATHS = [
  '/admin',
  '/admin/ingresar',
  '/admin/productos',
  '/admin/movimientos',
  '/admin/quincenas/actual',
  '/admin/compras/nueva',
  '/admin/mas',
  '/admin/ranking',
  '/admin/compras',
  '/admin/reportes',
  '/admin/personas',
  '/admin/tablets',
  '/admin/administradores',
];

test.describe('Celular', () => {
  test('administración: barra de pestañas abajo y las pantallas caben sin scroll horizontal', async ({
    page,
  }) => {
    await loginAdmin(page);
    const nav = page.getByRole('navigation', { name: 'Administración' });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Productos' }).click();
    await expect(page).toHaveURL(/\/admin\/productos$/);
    await expect(nav.getByRole('link', { name: 'Productos' })).toHaveAttribute('aria-current', 'page');

    for (const path of ADMIN_PATHS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(1);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-${path.replace(/\//g, '_')}.png`, fullPage: true });
    }
  });

  test('máquina en un celular: cabe en pantalla y se puede retirar', async ({ page, request }) => {
    const { token } = await apiPairTablet(request, await apiAdminToken(request), 'Celular E2E');
    await openPairedTablet(page, token);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    // Paso 1: solo la máquina (sin teclado); "Retirar · N" lleva al PIN.
    await expect(keypad(page)).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-maquina.png` });
    await tapProduct(page, 'Manzanas');
    await cartPanel(page).getByRole('button', { name: 'Retirar · 1' }).click();
    await expect(activeView(page).getByRole('heading', { name: 'Escribe tu PIN' })).toBeVisible();
    await expect(keypad(page)).toBeInViewport();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-pin.png` });
    // Volver conserva lo elegido.
    await activeView(page).getByRole('button', { name: 'Volver a la máquina' }).click();
    await expect(cartPanel(page)).toContainText('1×Manzanas');
    await kioskRegister(page, [], LUIS);
    await expect(activeView(page).getByRole('region', { name: 'Confirmación' })).toContainText('¡Listo, Luis!');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-entrega.png` });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await activeView(page).getByRole('button', { name: 'Volver ahora' }).click();

    // El candado lleva al teclado del código de administrador.
    await activeView(page).getByRole('button', { name: 'Administración' }).click();
    await expect(activeView(page).getByRole('heading', { name: 'Código de administrador' })).toBeVisible();
    await expect(activeView(page).getByRole('link', { name: '¿Sin código? Entrar con correo' })).toBeVisible();
  });
});

test.describe('Celular en horizontal', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('máquina: se desplaza en una columna y se puede retirar', async ({ page, request }) => {
    const { token } = await apiPairTablet(request, await apiAdminToken(request), 'Horizontal E2E');
    await openPairedTablet(page, token);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await expect(machine(page)).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-horizontal.png` });
    await kioskRegister(page, [['Gaseosa 400 ml', 1]], LUIS);
    await expect(activeView(page).getByRole('region', { name: 'Confirmación' })).toContainText('¡Listo, Luis!');
    await activeView(page).getByRole('button', { name: 'Volver ahora' }).click();
    await expect(cartPanel(page)).toContainText('Tu retiro está vacío');
  });
});
