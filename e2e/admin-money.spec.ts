import { expect, test } from '@playwright/test';
import { activeView, ANA, LUIS, loginAdmin, money, resetDatabase, stockOf } from './fixtures';

// PNG mínimo válido (1x1) para el comprobante.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeAll(() => resetDatabase());

test.describe('Quincenas y compras (administración)', () => {
  test('aporte, compra con comprobante, ver el comprobante y anular', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/productos');
    const yogurBefore = await stockOf(page, 'Yogur de fresa');

    // --- Aporte (demo: recaudado $ 110.000) ---
    await page.goto('/admin/quincenas');
    await activeView(page)
      .getByRole('link', { name: /Quincena de demostración/ })
      .click();
    const detail = activeView(page);
    await expect(detail.getByText(money('110.000')).first()).toBeVisible();
    await detail.getByRole('button', { name: 'Registrar aporte' }).click();
    const contribution = page.locator('ion-modal').filter({ hasText: 'Registrar aporte' });
    await contribution.getByLabel('¿Quién aportó?').selectOption({ label: ANA.name });
    await contribution.getByLabel('Monto').fill('20.000');
    await contribution.getByRole('button', { name: 'Registrar aporte' }).click();
    await expect(activeView(page).getByText(money('130.000')).first()).toBeVisible();

    // --- Compra con comprobante ---
    await activeView(page).getByRole('link', { name: 'Registrar compra' }).click();
    await expect(page).toHaveURL(/\/admin\/compras\/nueva\?periodo=/);
    const form = activeView(page);
    await form.getByLabel('¿Quién compró?').selectOption({ label: LUIS.name });
    await form.getByLabel('Tienda').fill('Tienda E2E');
    await form.getByLabel('Producto 1', { exact: true }).selectOption({ label: '13 · Yogur de fresa' }) // demo: el yogur tiene el código 13;
    await form.getByLabel('Cantidad').first().fill('4');
    await form.getByLabel('Precio unitario').first().fill('3.100');
    await expect(form.getByText(money('12.400')).first()).toBeVisible();
    await form
      .getByLabel('Comprobante')
      .setInputFiles({ name: 'recibo.png', mimeType: 'image/png', buffer: PNG });
    await form.getByRole('button', { name: /Registrar compra/ }).click();

    await expect(page).toHaveURL(/\/admin\/compras\/[0-9a-f-]{36}$/);
    const purchase = activeView(page);
    await expect(purchase.getByRole('heading', { name: 'Compra en Tienda E2E' })).toBeVisible();
    await expect(purchase.locator('table')).toContainText('4 unidades');

    await purchase.getByRole('button', { name: 'Ver comprobante' }).click();
    const receipt = page.locator('ion-modal').filter({ hasText: 'Comprobante' });
    await expect(receipt.getByRole('img', { name: 'Comprobante de la compra' })).toBeVisible();
    await receipt.getByRole('button', { name: 'Cerrar' }).click();
    const purchaseUrl = page.url();

    await page.goto('/admin/productos');
    expect(await stockOf(page, 'Yogur de fresa')).toBe(yogurBefore + 4);

    // --- Anular: revierte el stock y deja de contar en el gasto ---
    await page.goto(purchaseUrl);
    await activeView(page).getByRole('button', { name: 'Anular' }).click();
    await page
      .locator('ion-modal')
      .filter({ hasText: 'Anular compra' })
      .getByRole('button', { name: 'Anular compra' })
      .click();
    await expect(activeView(page).getByRole('status').filter({ hasText: 'Anulada por' })).toBeVisible();

    await page.goto('/admin/productos');
    expect(await stockOf(page, 'Yogur de fresa')).toBe(yogurBefore);
    await page.goto('/admin/compras');
    await expect(activeView(page).locator('table:not(.chart-data-table)')).not.toContainText('Tienda E2E');
    await activeView(page).getByLabel('Incluir anuladas').check();
    await expect(activeView(page).getByRole('row').filter({ hasText: 'Tienda E2E' })).toContainText(
      'Anulada',
    );
  });

  test('cerrar la quincena y abrir la siguiente', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/quincenas');
    await expect(activeView(page).getByRole('button', { name: 'Abrir quincena' })).toBeDisabled();
    await activeView(page)
      .getByRole('link', { name: /Quincena de demostración/ })
      .click();
    await activeView(page).getByRole('button', { name: 'Cerrar' }).click();
    await page
      .locator('ion-modal')
      .filter({ hasText: 'Cerrar quincena' })
      .getByRole('button', { name: 'Cerrar quincena' })
      .click();
    await expect(activeView(page).getByText('Cerrada').first()).toBeVisible();
    await expect(activeView(page).getByRole('button', { name: 'Registrar aporte' })).toHaveCount(0);

    await page.goto('/admin/quincenas');
    await activeView(page).getByRole('button', { name: 'Abrir quincena' }).click();
    const dialog = page.locator('ion-modal').filter({ hasText: 'Abrir quincena' });
    await dialog.getByLabel('Nombre').fill('Enero 2027 · 1ª quincena');
    await dialog.getByLabel('Desde').fill('2027-01-01');
    await dialog.getByLabel('Hasta').fill('2027-01-15');
    await dialog.getByRole('button', { name: 'Abrir quincena' }).click();
    await expect(page).toHaveURL(/\/admin\/quincenas\/[0-9a-f-]{36}$/);
    await expect(
      activeView(page).getByRole('heading', { name: 'Enero 2027 · 1ª quincena' }).first(),
    ).toBeVisible();
  });
});
