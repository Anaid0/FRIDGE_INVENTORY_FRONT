import { expect, test } from '@playwright/test';
import {
  activeView,
  API_URL,
  apiAdminToken,
  apiPairTablet,
  bearer,
  openPairedTablet,
  openTab,
  resetDatabase,
} from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => resetDatabase());

test('desde la tablet: ver la quincena en curso, y al terminar calcular el más hambriento y ver el podio', async ({
  page,
  request,
}) => {
  // Demo: en la quincena abierta Ana sacó 9, Luis 7 y Marta 3.
  const adminToken = await apiAdminToken(request);
  const { token } = await apiPairTablet(request, adminToken);
  await openPairedTablet(page, token);
  await openTab(page, 'Ranking');
  const view = activeView(page);

  await expect(view.getByText('Va ganando')).toBeVisible();
  await expect(view.getByText(/Se habilita el .*, cuando termine la quincena\./)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Calcular el más hambriento' })).toBeDisabled();
  await expect(view.getByRole('listitem', { name: /^Ana Gómez: 9 und\./ })).toBeVisible(); // en vivo

  // Termina la quincena (aquí: el admin la cierra).
  const current = await (
    await request.get(`${API_URL}/funding-periods/current`, { headers: bearer(adminToken) })
  ).json();
  const closed = await request.patch(`${API_URL}/funding-periods/${current.periodId}/close`, {
    headers: bearer(adminToken),
  });
  expect(closed.ok()).toBe(true);

  // Al volver a la pestaña, la tablet ofrece el botón.
  await openTab(page, 'Sacar');
  await openTab(page, 'Ranking');
  await expect(view.getByText('¡Quincena de demostración terminó!')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/r03-tablet-calcular.png` });
  await view.getByRole('button', { name: 'Calcular el más hambriento' }).click();

  const podium = view.getByRole('list', { name: 'Podio de la quincena' });
  await expect(podium.getByRole('listitem')).toHaveText([
    /Ana\s*9 und\./,
    /Luis\s*7 und\./,
    /Marta\s*3 und\./,
  ]);
  await expect(view.getByText('Ganó', { exact: true })).toBeVisible();
  await expect(view.getByText(/Calculado el .* desde la tablet «Tablet E2E»/)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Calcular el más hambriento' })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/r04-tablet-podio.png` });
});
