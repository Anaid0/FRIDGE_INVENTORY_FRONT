import { expect, test } from '@playwright/test';
import { activeView, API_URL, apiAdminToken, apiPairTablet, bearer, openPairedTablet, resetDatabase } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => resetDatabase());

test('desde la máquina: ver quién va ganando, y al terminar calcular el más hambriento y ver el podio', async ({
  page,
  request,
}) => {
  // Demo: en la quincena abierta Ana sacó 9, Luis 7 y Marta 3.
  const adminToken = await apiAdminToken(request);
  const { token } = await apiPairTablet(request, adminToken);
  await openPairedTablet(page, token);
  await activeView(page).getByRole('link', { name: /Ver ranking/ }).click();
  const view = activeView(page);

  await expect(view.getByText('Va ganando el más hambriento')).toBeVisible();
  await expect(view.getByText(/Se habilita el /)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Calcular el más hambriento' })).toBeDisabled();
  await expect(view.getByRole('listitem', { name: /^Ana Gómez: 9 und\./ })).toBeVisible(); // en vivo
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/r01-maquina-ranking.png` });

  // Termina la quincena (aquí: el admin la cierra).
  const current = await (
    await request.get(`${API_URL}/funding-periods/current`, { headers: bearer(adminToken) })
  ).json();
  const closed = await request.patch(`${API_URL}/funding-periods/${current.periodId}/close`, {
    headers: bearer(adminToken),
  });
  expect(closed.ok()).toBe(true);

  // Al volver a entrar, la máquina ofrece el botón.
  await view.getByRole('button', { name: 'Volver' }).click();
  await activeView(page).getByRole('link', { name: /Ver ranking/ }).click();
  await expect(activeView(page).getByText('¡Quincena de demostración terminó!')).toBeVisible();
  await activeView(page).getByRole('button', { name: 'Calcular el más hambriento' }).click();

  const podium = activeView(page).getByRole('list', { name: 'Podio de la quincena' });
  await expect(podium.getByRole('listitem')).toHaveText([/Ana\s*9 und\./, /Luis\s*7 und\./, /Marta\s*3 und\./]);
  await expect(activeView(page).getByText('El más hambriento', { exact: true })).toBeVisible();
  await expect(activeView(page).getByRole('button', { name: 'Calcular el más hambriento' })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/r02-maquina-podio.png` });
});
