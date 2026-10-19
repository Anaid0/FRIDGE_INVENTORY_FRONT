import { expect, test } from '@playwright/test';
import {
  activeView,
  API_URL,
  apiAdminToken,
  apiPairTablet,
  bearer,
  loginAdmin,
  openPairedTablet,
  openTab,
  resetDatabase,
} from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => resetDatabase());

test('el más hambriento de la quincena: se calcula al terminarla y se ve en el podio y en la tablet', async ({
  page,
  request,
  browser,
}) => {
  // Demo: Ana sacó 9, Luis 7 y Marta 3 en la quincena abierta.
  await loginAdmin(page);
  await page.goto('/admin/ranking');
  const view = activeView(page);
  await expect(view.getByText('Quincena de demostración sigue en curso.')).toBeVisible();
  await expect(view.getByRole('button', { name: 'Calcular el más hambriento' })).toBeDisabled();
  // El ranking en vivo de la quincena elegida ya muestra el orden.
  await expect(view.getByRole('listitem', { name: /^Ana Gómez: 9 und\./ })).toBeVisible();

  // Se cierra la quincena (también se puede esperar a que pase su último día).
  const token = await apiAdminToken(request);
  const current = await (
    await request.get(`${API_URL}/funding-periods/current`, { headers: bearer(token) })
  ).json();
  expect(
    (
      await request.patch(`${API_URL}/funding-periods/${current.periodId}/close`, { headers: bearer(token) })
    ).ok(),
  ).toBe(true);

  await page.reload();
  await expect(view.getByText('Quincena de demostración ya terminó.')).toBeVisible();
  await view.getByRole('button', { name: 'Calcular el más hambriento' }).click();
  await expect(page.getByText('El más hambriento de la quincena: Ana Gómez')).toBeVisible();

  const podium = view.getByRole('list', { name: 'Podio de la quincena' });
  await expect(podium.getByRole('listitem')).toHaveText([
    /Ana\s*9 und\./,
    /Luis\s*7 und\./,
    /Marta\s*3 und\./,
  ]);
  await expect(view.getByText('Más hambriento de la quincena', { exact: true })).toBeVisible();
  await expect(view.getByText(/Calculado el .* por Admin FridgeYA/)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Volver a calcular' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/r01-admin-ranking.png`, fullPage: true });

  // La tablet muestra el último calculado en la pestaña Ranking.
  const { token: kioskToken } = await apiPairTablet(request, token);
  const tablet = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  await openPairedTablet(tablet, kioskToken);
  await openTab(tablet, 'Ranking');
  const kiosk = activeView(tablet);
  await expect(kiosk.getByText(/Calculado el .* por Admin FridgeYA/)).toBeVisible();
  await expect(
    kiosk.getByRole('list', { name: 'Podio de la quincena' }).getByRole('listitem').first(),
  ).toContainText('Ana');
  if (SHOTS) await tablet.screenshot({ path: `${SHOTS}/r02-tablet-ranking.png`, fullPage: true });
  await tablet.close();
});
