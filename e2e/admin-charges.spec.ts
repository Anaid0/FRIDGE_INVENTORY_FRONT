import { expect, test } from '@playwright/test';
import { activeView, API_URL, apiAdminToken, bearer, loginAdmin, money, resetDatabase } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => resetDatabase());

/**
 * Quien más consume, más aporta. Demo (al precio de la última compra de cada producto):
 * Ana 3 gaseosas ($2.650) + 2 yogures ($3.000) + 4 aguas ($2.200) = $22.750;
 * Luis 2 papas ($2.800) + 2 gaseosas + 3 yogures = $19.900; Marta 3 manzanas ($900) = $2.700.
 */
test('al cerrar la quincena cada uno debe lo que consumió en precio y paga en la siguiente', async ({
  page,
  request,
}) => {
  const token = await apiAdminToken(request);
  const current = await (
    await request.get(`${API_URL}/funding-periods/current`, { headers: bearer(token) })
  ).json();

  await loginAdmin(page);
  await page.goto(`/admin/quincenas/${current.periodId}`);
  const view = activeView(page);
  const charges = view.getByRole('list', { name: 'Aporte por persona' });

  // Abierta: estimación en vivo.
  await expect(view.getByRole('heading', { name: 'Cuánto aporta cada uno' })).toBeVisible();
  await expect(view.getByText('Estimado')).toBeVisible();
  await expect(charges.getByRole('listitem')).toHaveText([
    new RegExp(`Ana Gómez.*${money('22.750').source}`),
    new RegExp(`Luis Martínez.*${money('19.900').source}`),
    new RegExp(`Marta Ríos.*${money('2.700').source}`),
  ]);

  // Al cerrar se generan los cobros.
  await view.getByRole('button', { name: 'Cerrar quincena' }).click();
  await page.locator('ion-modal').getByRole('button', { name: 'Cerrar quincena' }).click();
  await expect(page.getByText('Ya se calculó cuánto aporta cada uno')).toBeVisible();
  await expect(charges.getByRole('listitem').first()).toContainText(/Debe \$\s?22\.750/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c01-cobros.png`, fullPage: true });

  // El pago entra como aporte a la quincena siguiente.
  const next = await (
    await request.post(`${API_URL}/funding-periods`, {
      headers: bearer(token),
      data: { name: 'Siguiente quincena', startDate: '2099-01-01', endDate: '2099-01-15' },
    })
  ).json();
  await page.goto(`/admin/quincenas/${next.id}`);
  const pending = view.getByRole('region', { name: 'Por cobrar' });
  await expect(pending.getByRole('listitem')).toHaveCount(3);
  await pending.getByRole('button', { name: 'Registrar pago de Ana Gómez' }).click();
  const dialog = page.locator('ion-modal').filter({ hasText: 'Registrar pago' });
  await expect(dialog.getByLabel('Monto')).toHaveValue('22750');
  await dialog.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByText(/Pago de \$\s?22\.750 de Ana Gómez registrado como aporte/)).toBeVisible();

  await expect(pending.getByRole('listitem')).toHaveCount(2);
  await expect(view.getByText('Pago de consumo · Quincena de demostración')).toBeVisible();
  await expect(view.getByRole('region', { name: 'Dinero de la quincena' })).toContainText(money('22.750'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c02-por-cobrar.png`, fullPage: true });
});
