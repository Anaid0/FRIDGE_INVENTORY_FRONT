import { expect, test } from '@playwright/test';
import { activeView, ANA, headerBadge, loginAdmin, money, resetDatabase, stockOf } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test.beforeAll(() => resetDatabase());

test.describe('Administración (Ionic)', () => {
  test('login, menú lateral y quién más retira en la cabecera', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=\/admin/);
    await shot(page, '01-login');
    await loginAdmin(page);
    await expect(activeView(page).getByRole('heading', { name: /Hola, / })).toBeVisible();
    await expect(headerBadge(page)).toContainText(ANA.name); // demo: Ana es quien más retira
    const nav = page.getByRole('navigation', { name: 'Administración' });
    for (const label of [
      'Productos',
      'Movimientos',
      'Ranking',
      'Quincenas',
      'Compras',
      'Reportes',
      'Personas',
      'Tablets',
      'Administradores',
    ]) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
    await shot(page, '02-dashboard');
  });

  test('personas: agregar con PIN y ver su estado', async ({ page }) => {
    const name = `Persona${Date.now() % 100000}`;
    await loginAdmin(page);
    await page
      .getByRole('navigation', { name: 'Administración' })
      .getByText('Personas', { exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/personas$/);
    const view = activeView(page);
    await expect(view.getByRole('listitem').filter({ hasText: ANA.name })).toContainText('PIN asignado');

    // Panel lateral "Agregar persona" (formulario en la misma página).
    const form = view.getByRole('complementary', { name: 'Agregar persona' });
    await form.getByLabel('Nombre', { exact: true }).fill(name);
    await form.getByLabel('Apellido').fill('E2E');
    await form.getByLabel('PIN de 4 dígitos').fill('1234');
    await form.getByRole('button', { name: 'Agregar persona' }).click();
    await expect(form.getByText('Ese PIN es muy fácil de adivinar')).toBeVisible();
    await form.getByRole('button', { name: 'Generar' }).click();
    await expect(form.getByLabel('PIN de 4 dígitos')).toHaveValue(/^\d{4}$/);
    await shot(page, '03-persona-formulario');
    await form.getByRole('button', { name: 'Agregar persona' }).click();
    await expect(view.getByRole('listitem').filter({ hasText: `${name} E2E` })).toContainText('PIN asignado');
    await shot(page, '04-personas');
  });

  test('productos: retiro a nombre de una persona desde el modal de Ionic', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/productos');
    const before = await stockOf(page, 'Papas fritas');
    await activeView(page).getByRole('button', { name: 'Sacar Papas fritas' }).click();
    const dialog = page.locator('ion-modal').filter({ hasText: 'Sacar de la nevera' });
    await dialog.getByLabel('¿Quién lo realizó?').selectOption({ label: ANA.name });
    await dialog.getByLabel('Cantidad').fill('2');
    await page.waitForTimeout(400); // fin de la animación de entrada del modal
    await shot(page, '05-sacar-modal');
    await dialog.getByRole('button', { name: 'Sacar', exact: true }).click();
    await expect(page.locator('ion-toast').first()).toBeAttached();
    await expect.poll(() => stockOf(page, 'Papas fritas')).toBe(before - 2);
    await shot(page, '06-productos');

    await page.goto('/admin/movimientos?kind=out');
    await expect(activeView(page).locator('table tbody tr[data-movement]').first()).toContainText(
      'Papas fritas',
    );
    await shot(page, '07-movimientos');
  });

  test('quincenas, compras, reportes, tablets y administradores cargan', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/quincenas');
    await expect(activeView(page).getByText('Quincena de demostración').first()).toBeVisible();
    await shot(page, '08-quincenas');
    await page.goto('/admin/compras');
    await expect(activeView(page).locator('table:not(.chart-data-table)')).toContainText('Éxito');
    await page.goto('/admin/reportes');
    await expect(activeView(page).getByRole('heading', { name: 'Gasto por producto' })).toBeVisible();
    await expect(activeView(page).getByText(money('121.900')).first()).toBeVisible();
    await shot(page, '09-reportes');
    await page.goto('/admin/tablets');
    await expect(activeView(page).getByText('No hay tablets autorizadas')).toBeVisible();
    await page.goto('/admin/administradores');
    await expect(activeView(page).getByText('admin@fridgeya.local')).toBeVisible();
    await shot(page, '10-administradores');
  });
});
