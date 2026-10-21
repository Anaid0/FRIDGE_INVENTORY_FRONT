import { expect, test } from '@playwright/test';
import { activeView, ADMIN, ANA, loginAdmin, money, resetDatabase, stockOf } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test.beforeAll(() => resetDatabase());

test.describe('Administración (Ionic)', () => {
  test('login, barra de pestañas y el módulo Más', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=\/admin/);
    await shot(page, '01-login');
    await loginAdmin(page);
    await expect(activeView(page).getByRole('heading', { name: /Hola, / })).toBeVisible();
    await expect(activeView(page).getByText(ANA.name).first()).toBeVisible(); // demo: Ana va ganando
    const nav = page.getByRole('navigation', { name: 'Administración' });
    for (const label of ['Inicio', 'Productos', 'Movimientos', 'Quincena', 'Más']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
    await shot(page, '02-dashboard');
    await nav.getByRole('link', { name: 'Más' }).click();
    await expect(page).toHaveURL(/\/admin\/mas$/);
    for (const label of ['Ranking', 'Compras', 'Reportes', 'Personas', 'Tablets', 'Administradores']) {
      await expect(activeView(page).getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
  });

  test('personas: agregar con PIN y ver su estado', async ({ page }) => {
    const name = `Persona${Date.now() % 100000}`;
    await loginAdmin(page);
    await page.goto('/admin/mas');
    await activeView(page).getByRole('link', { name: /Personas/ }).click();
    await expect(page).toHaveURL(/\/admin\/personas$/);
    const view = activeView(page);
    await expect(view.getByRole('listitem').filter({ hasText: ANA.name })).toBeVisible();

    const form = view.getByRole('region', { name: 'Agregar persona' });
    await form.getByLabel('Nombre', { exact: true }).fill(name);
    await form.getByLabel('Apellido').fill('E2E');
    await form.getByLabel('PIN de 4 dígitos').fill('1234');
    await expect(form.getByText('Ese PIN es muy fácil de adivinar')).toBeVisible();
    await form.getByRole('button', { name: 'Agregar', exact: true }).click(); // sin PIN confirmado no se agrega
    await expect(view.getByRole('listitem').filter({ hasText: `${name} E2E` })).toHaveCount(0);

    // Generar: el PIN se ve 5 segundos (para memorizarlo) y la confirmación espera.
    await form.getByRole('button', { name: 'Generar' }).click();
    const pin = await form.getByLabel('PIN de 4 dígitos').inputValue();
    expect(pin).toMatch(/^\d{4}$/);
    await expect(form.getByText(/se oculta en \d s/)).toBeVisible();
    await expect(form.getByLabel('Confirma el PIN')).toBeDisabled();
    await shot(page, '03-persona-formulario');

    // Luego se oculta y el empleado lo confirma de memoria.
    await expect(form.getByLabel('Confirma el PIN')).toBeEnabled({ timeout: 8000 });
    await expect(form.getByLabel(/PIN de 4 dígitos/)).toHaveValue('••••');
    await form.getByLabel('Confirma el PIN').fill(pin === '9999' ? '1111' : '9999');
    await expect(form.getByText('Los PIN no coinciden.')).toBeVisible();
    await form.getByLabel('Confirma el PIN').fill(pin);
    await expect(form.getByText('Los PIN coinciden')).toBeVisible();
    await form.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByText(`${name} E2E agregado. Ya puede usar su PIN en la tablet.`)).toBeVisible();
    await expect(view.getByRole('listitem').filter({ hasText: `${name} E2E` })).toBeVisible();

    // Restablecer el PIN pide la contraseña del admin.
    await view.getByRole('button', { name: `Restablecer PIN de ${name} E2E` }).click();
    const dialog = page.locator('ion-modal').filter({ hasText: 'Restablecer PIN' });
    await dialog.getByRole('button', { name: 'Generar' }).click();
    const newPin = await dialog.getByLabel('PIN de 4 dígitos').inputValue();
    await expect(dialog.getByLabel('Confirma el PIN')).toBeEnabled({ timeout: 8000 });
    await dialog.getByLabel('Confirma el PIN').fill(newPin);
    await dialog.getByLabel('Tu contraseña de administrador').fill('no-es-mi-clave');
    await dialog.getByRole('button', { name: /^Guardar/ }).click();
    await expect(dialog.getByText('La contraseña de administrador no es correcta')).toBeVisible();
    await dialog.getByLabel('Tu contraseña de administrador').fill(ADMIN.password);
    await dialog.getByRole('button', { name: /^Guardar/ }).click();
    await expect(
      page.getByText(`PIN de ${name} E2E actualizado. Ya puede usarlo en la tablet.`),
    ).toBeVisible();
    await shot(page, '04-personas');
  });

  test('productos: ingresar stock y retiro a nombre de una persona desde la edición', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/productos');
    const before = await stockOf(page, 'Papas fritas');
    await shot(page, '05-productos');
    await activeView(page).getByRole('link', { name: /^Editar Papas fritas/ }).click();
    const view = activeView(page);
    const stock = view.getByRole('region', { name: 'Stock' }).locator('[data-stock]');
    await expect(stock).toHaveText(String(before));

    // Ingresar 3 a la nevera.
    await view.getByRole('button', { name: 'Más' }).click();
    await view.getByRole('button', { name: 'Más' }).click();
    await view.getByRole('button', { name: /^Ingresar 3 a la nevera/ }).click();
    await expect(stock).toHaveText(String(before + 3));

    // Retiro a nombre de Ana.
    await view.getByRole('button', { name: 'Registrar un retiro a nombre de otra persona' }).click();
    const dialog = page.locator('ion-modal').filter({ hasText: 'Sacar de la nevera' });
    await dialog.getByLabel('¿Quién lo realizó?').selectOption({ label: ANA.name });
    await dialog.getByLabel('Cantidad').fill('2');
    await page.waitForTimeout(400); // fin de la animación de entrada del modal
    await shot(page, '06-sacar-modal');
    await dialog.getByRole('button', { name: 'Sacar', exact: true }).click();
    await expect(stock).toHaveText(String(before + 1));

    await page.goto('/admin/movimientos');
    const first = activeView(page).getByRole('listitem').first();
    await expect(first).toContainText('Papas fritas');
    await expect(first).toContainText('registrado por');
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
    await expect(activeView(page).getByRole('heading', { name: 'Tablets' })).toBeVisible();
    await page.goto('/admin/administradores');
    await expect(activeView(page).getByText('admin@fridgeya.local')).toBeVisible();
    await shot(page, '10-administradores');
  });
});
