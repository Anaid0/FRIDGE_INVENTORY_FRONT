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
  keypad,
  kioskRegister,
  LUIS,
  MARTA,
  openPairedTablet,
  resetDatabase,
  tapProduct,
  typeAndOk,
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

const done = (page: import('@playwright/test').Page) => activeView(page).getByRole('region', { name: 'Confirmación' });

test('tras 5 PIN incorrectos seguidos la tablet deja de aceptar PIN un par de minutos', async ({
  page,
  request,
}) => {
  // Tablet propia: el bloqueo es por tablet y no debe afectar a las demás pruebas.
  const { token } = await apiPairTablet(request, adminToken, 'Tablet bloqueo');
  await openPairedTablet(page, token);
  await kioskRegister(page, [['Manzanas', 1]], { name: MARTA.name, pin: '9999' }); // PIN de nadie
  await expect(keypad(page)).toContainText('te quedan 4 intentos');
  for (let i = 0; i < 3; i++) await typeAndOk(page, '9999');
  await expect(keypad(page)).toContainText('te queda 1 intento');
  await typeAndOk(page, '9999');
  await expect(keypad(page)).toContainText('Demasiados intentos · vuelve a intentarlo a las');
  // Ni con un PIN correcto mientras dure el bloqueo.
  await typeAndOk(page, MARTA.pin);
  await expect(keypad(page)).toContainText('Demasiados intentos');
  await expect(done(page)).toHaveCount(0);
});

test('cada persona cambia su PIN en la tablet y luego lo usa', async ({ page }) => {
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Papas fritas');
  await activeView(page).getByRole('button', { name: 'Cambiar mi PIN' }).click();

  await typePin(page, ANA.pin);
  await typePin(page, '1234');
  await expect(activeView(page).getByRole('alert')).toContainText('muy fácil de adivinar');
  await typePin(page, '9147');
  await typePin(page, '9147');

  // Vuelve a la máquina con el retiro intacto, pidiendo el PIN.
  await expect(activeView(page).getByRole('status').filter({ hasText: 'tu PIN se cambió' })).toBeVisible();
  await expect(keypad(page)).toContainText('TU PIN');
  await typeAndOk(page, ANA.pin);
  await expect(keypad(page)).toContainText('PIN incorrecto');
  await typeAndOk(page, '9147');
  await expect(done(page)).toContainText('Retiraste 1 Papas fritas');
});

test('si otra persona saca algo mientras alguien elige, el retiro se ajusta y se avisa', async ({
  page,
  request,
}) => {
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Agua con gas', 2); // demo: hay 2

  // Mientras tanto, el admin registra que alguien sacó 1.
  const aguaId = await apiProductId(request, adminToken, 'Agua con gas');
  const luisId = await apiPersonId(request, adminToken, LUIS.name);
  await request.post(`${API_URL}/movements/out`, {
    headers: bearer(adminToken),
    data: { productId: aguaId, quantity: 1, performedBy: luisId },
  });

  await typeAndOk(page, LUIS.pin);
  await expect(keypad(page)).toContainText('Cambió el stock de Agua con gas');
  await expect(cartPanel(page)).toContainText('1×Agua con gas');
});

test('tras un minuto sin uso, la máquina se limpia sola', async ({ page }) => {
  await page.clock.install();
  await openPairedTablet(page, kioskToken);
  await tapProduct(page, 'Gaseosa 400 ml');
  await expect(keypad(page)).toContainText('TU PIN');

  await page.clock.runFor(61_000);
  await expect(cartPanel(page)).toContainText('Tu retiro está vacío');
  await expect(keypad(page)).toContainText('Toca los productos que vas a llevar');
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

  // El siguiente retiro recibe 401 DEVICE_REVOKED.
  await kioskRegister(page, [['Manzanas', 1]], LUIS);
  await expect(
    activeView(page).getByRole('heading', { name: 'Esta tablet fue desautorizada' }),
  ).toBeVisible();
  await expect(activeView(page).getByRole('button', { name: 'Autorizar esta tablet' })).toBeVisible();
});
