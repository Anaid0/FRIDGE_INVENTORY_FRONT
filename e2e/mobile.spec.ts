import { expect, test } from '@playwright/test';
import {
  activeView,
  apiAdminToken,
  apiPairTablet,
  horizontalOverflow,
  kioskRegister,
  LUIS,
  loginAdmin,
  openPairedTablet,
  resetDatabase,
} from './fixtures';

test.beforeAll(() => resetDatabase());

test.describe('Celular', () => {
  test('administración: el menú se despliega y las pantallas caben sin scroll horizontal', async ({
    page,
  }) => {
    await loginAdmin(page);
    const nav = page.getByRole('navigation', { name: 'Administración' });
    await expect(nav).toBeHidden(); // en pantallas angostas el menú está plegado
    await activeView(page).getByRole('button', { name: 'Abrir menú' }).click();
    await expect(nav).toBeVisible();
    await nav.getByText('Productos', { exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/productos$/);

    for (const path of [
      '/admin',
      '/admin/productos',
      '/admin/movimientos',
      '/admin/ranking',
      '/admin/quincenas',
      '/admin/compras',
      '/admin/reportes',
      '/admin/personas',
      '/admin/tablets',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(1);
    }
  });

  test('tablet en un celular: cabe en pantalla y se puede sacar un producto', async ({ page, request }) => {
    const { token } = await apiPairTablet(request, await apiAdminToken(request), 'Celular E2E');
    await openPairedTablet(page, token);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await kioskRegister(page, [['Manzanas', 1]], LUIS);
    await expect(activeView(page).getByRole('status').filter({ hasText: '¡Listo, Luis!' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
