import { expect, test } from '@playwright/test';
import {
  activeView,
  ANA,
  API_URL,
  apiAdminToken,
  apiPairTablet,
  apiPersonId,
  apiProductId,
  bearer,
  cartPanel,
  kioskRegister,
  LUIS,
  MARTA,
  openPairedTablet,
  resetDatabase,
  tapProduct,
  typePin,
} from './fixtures';

let adminToken: string;
let kioskToken: string;
let deviceId: string;

test.beforeAll(async ({ request }) => {
  resetDatabase();
  adminToken = await apiAdminToken(request);
  ({ token: kioskToken, deviceId } = await apiPairTablet(request, adminToken));
});

const done = (page: import('@playwright/test').Page, name: string) =>
  activeView(page)
    .getByRole('status')
    .filter({ hasText: `¡Listo, ${name}!` });

test('tras 5 PIN incorrectos la persona queda bloqueada; el admin restablece el PIN', async ({
  page,
  request,
}) => {
  await openPairedTablet(page, kioskToken);
  await kioskRegister(page, [['Manzanas', 1]], { name: MARTA.name, pin: '0000' });
  await expect(activeView(page).getByRole('alert')).toContainText('Te quedan 4 intentos');
  for (let i = 0; i < 3; i++) await typePin(page, '0000');
  await expect(activeView(page).getByRole('alert')).toContainText('Te queda 1 intento');
  await typePin(page, '0000');
  await expect(activeView(page).getByRole('alert')).toContainText(
    'Demasiados intentos. Podrás volver a intentarlo a las',
  );
  // Ni con el PIN correcto mientras dure el bloqueo.
  await typePin(page, MARTA.pin);
  await expect(activeView(page).getByRole('alert')).toContainText('Demasiados intentos');

  const martaId = await apiPersonId(request, adminToken, MARTA.name);
  const reset = await request.post(`${API_URL}/people/${martaId}/pin`, {
    headers: bearer(adminToken),
    data: { pin: '7351' },
  });
  expect(reset.ok()).toBe(true);
  await typePin(page, '7351');
  await expect(done(page, 'Marta')).toContainText('Sacaste 1 Manzanas.');
});

test('cada persona cambia su PIN en la tablet y luego lo usa', async ({ page }) => {
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Papas fritas');
  await cartPanel(page)
    .getByRole('button', { name: /Continuar/ })
    .click();
  await activeView(page).getByRole('button', { name: /Ana/ }).click();
  await activeView(page).getByRole('button', { name: 'Cambiar mi PIN' }).click();

  await typePin(page, ANA.pin);
  await typePin(page, '1234');
  await expect(activeView(page).getByRole('alert')).toContainText('muy fácil de adivinar');
  await typePin(page, '9147');
  await typePin(page, '9147');

  await expect(activeView(page).getByRole('heading', { name: 'Hola, Ana' })).toBeVisible(); // vuelve al PIN con la lista intacta
  await typePin(page, ANA.pin);
  await expect(activeView(page).getByRole('alert')).toContainText('PIN incorrecto');
  await typePin(page, '9147');
  await expect(done(page, 'Ana')).toContainText('Sacaste 1 Papas fritas.');
});

test('si otra persona saca algo mientras alguien elige, la lista se ajusta y se avisa', async ({
  page,
  request,
}) => {
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Agua con gas', 2); // demo: hay 2
  await cartPanel(page)
    .getByRole('button', { name: /Continuar/ })
    .click();

  // Mientras tanto, el admin registra que alguien sacó 1.
  const aguaId = await apiProductId(request, adminToken, 'Agua con gas');
  const luisId = await apiPersonId(request, adminToken, LUIS.name);
  await request.post(`${API_URL}/movements/out`, {
    headers: bearer(adminToken),
    data: { productId: aguaId, quantity: 1, performedBy: luisId },
  });

  await activeView(page).getByRole('button', { name: /Luis/ }).click();
  await typePin(page, LUIS.pin);
  await expect(
    activeView(page).getByRole('status').filter({ hasText: 'Cambió el stock de Agua con gas' }),
  ).toBeVisible();
  await expect(cartPanel(page)).toContainText('Agua con gas');
  await expect(cartPanel(page).getByLabel('Una Agua con gas más')).toBeDisabled(); // ahora solo queda 1
});

test('tras un minuto sin uso, la tablet vuelve sola al inicio y vacía la lista', async ({ page }) => {
  await page.clock.install();
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Gaseosa 400 ml');
  await cartPanel(page)
    .getByRole('button', { name: /Continuar/ })
    .click();
  await expect(activeView(page).getByRole('heading', { name: '¿Quién eres?' })).toBeVisible();

  await page.clock.runFor(61_000);
  await expect(activeView(page).getByRole('tab', { name: 'Sacar' })).toHaveAttribute('aria-selected', 'true');
  await expect(cartPanel(page)).toContainText('Toca los productos para agregarlos.');
});

test('si el admin revoca la tablet con la app abierta, deja de funcionar al instante', async ({
  page,
  request,
}) => {
  await openPairedTablet(page, kioskToken);
  const revoked = await request.delete(`${API_URL}/kiosk/devices/${deviceId}`, {
    headers: bearer(adminToken),
  });
  expect(revoked.ok()).toBe(true);

  // La siguiente petición a la API (el ranking) recibe 401 DEVICE_REVOKED: la pantalla cambia antes de que
  // la pestaña llegue a quedar seleccionada, por eso solo se toca.
  await activeView(page).getByRole('tab', { name: 'Ranking' }).click();
  await expect(
    activeView(page).getByRole('heading', { name: 'Esta tablet fue desautorizada' }),
  ).toBeVisible();
  await expect(activeView(page).getByRole('button', { name: 'Autorizar esta tablet' })).toBeVisible();
});
