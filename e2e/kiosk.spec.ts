import { expect, test, type Page } from '@playwright/test';
import {
  activeView,
  ADMIN,
  ADMIN_CODE,
  ANA,
  cartPanel,
  keypad,
  LUIS,
  machine,
  resetDatabase,
  tapProduct,
  typeAndOk,
  typePin,
} from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

// Un solo dispositivo durante todo el archivo: la tablet se autoriza una vez y conserva su token.
test.describe.configure({ mode: 'serial' });
let page: Page;

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
});
test.afterAll(() => page.close());

test('una tablet nueva pide autorización y el admin la autoriza desde ella', async () => {
  await page.goto('/');
  await expect(
    activeView(page).getByRole('heading', { name: 'Esta tablet aún no está autorizada' }),
  ).toBeVisible();
  await shot(page, 'k01-sin-autorizar');

  await activeView(page).getByRole('button', { name: 'Autorizar esta tablet' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin\/tablets\?autorizar=1/);
  const dialog = page.locator('ion-modal').filter({ hasText: 'Usar este dispositivo como tablet' });
  await dialog.getByLabel('Nombre de la tablet').fill('Tablet E2E');
  await dialog.getByRole('button', { name: 'Autorizar' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(machine(page)).toBeVisible();
  await expect(activeView(page).getByRole('link', { name: /Quien más retira: Ana Gómez/ })).toBeVisible();
  await shot(page, 'k02-maquina');

  // La sesión de admin se cerró al autorizar.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/');
});

test('Luis toca los productos y retira solo con su PIN', async () => {
  await expect(keypad(page)).toContainText('Toca los productos que vas a llevar');
  await tapProduct(page, 'Gaseosa 400 ml', 2);
  await tapProduct(page, 'Yogur de fresa');
  await expect(cartPanel(page)).toContainText('2×Gaseosa 400 ml');
  await expect(cartPanel(page)).toContainText('1×Yogur de fresa');
  await expect(cartPanel(page)).toContainText('falta tu PIN');
  await expect(keypad(page)).toContainText('TU PIN');
  await shot(page, 'k03-retiro');

  await typeAndOk(page, '9999'); // de nadie
  await expect(keypad(page)).toContainText('PIN incorrecto · te quedan 4 intentos');
  await shot(page, 'k04-pin-incorrecto');
  await typeAndOk(page, LUIS.pin);

  await expect(activeView(page).getByText('Producto entregado')).toBeVisible();
  const done = activeView(page).getByRole('region', { name: 'Confirmación' });
  await expect(done).toContainText('¡Listo, Luis!');
  await expect(done).toContainText('Retiraste 2 Gaseosa 400 ml y 1 Yogur de fresa');
  await shot(page, 'k05-entrega');
  await done.getByRole('button', { name: 'Volver ahora' }).click();

  // De vuelta en la máquina, vacía y con el aviso. Demo: Luis tenía 7 y pasa a 10 (Ana: 9).
  await expect(activeView(page).getByRole('status').filter({ hasText: 'retiró 2 Gaseosa 400 ml' })).toBeVisible();
  await expect(cartPanel(page)).toContainText('Tu retiro está vacío');
  await expect(activeView(page).getByRole('link', { name: /Quien más retira: Luis Martínez, 10 unidades/ })).toBeVisible();
  await shot(page, 'k06-regreso');
});

test('buscar un producto (desde 3 letras) y ver su precio por unidad', async () => {
  const search = activeView(page).getByRole('searchbox', { name: /Buscar producto/ });
  await search.fill('yo');
  await expect(machine(page).getByRole('button', { name: /^Agregar / })).toHaveCount(5); // aún no filtra
  await search.fill('yog');
  await expect(machine(page).getByRole('button', { name: /^Agregar / })).toHaveCount(1);
  await expect(machine(page).getByRole('button', { name: /^Agregar Yogur de fresa, quedan \d+, \$\s?[\d.]+ c\/u/ })).toBeVisible();
  await search.fill('zzz');
  await expect(machine(page).getByRole('status')).toContainText('No hay productos que coincidan con «zzz»');
  await shot(page, 'k03b-busqueda');
  await activeView(page).getByRole('button', { name: 'Borrar búsqueda' }).click();
  await expect(machine(page).getByRole('button', { name: /^Agregar / })).toHaveCount(5);
});

test('quitar del retiro', async () => {
  await tapProduct(page, 'Papas fritas');
  await cartPanel(page).getByRole('button', { name: 'Quitar Papas fritas del retiro' }).click();
  await expect(cartPanel(page)).toContainText('Tu retiro está vacío');
  await expect(keypad(page)).toContainText('Toca los productos que vas a llevar');
});

test('ranking e historial desde la máquina', async () => {
  await activeView(page).getByRole('link', { name: /Ver ranking/ }).click();
  await expect(page).toHaveURL(/\/ranking$/);
  await expect(activeView(page).getByRole('list', { name: 'Unidades retiradas por persona' })).toContainText(
    LUIS.name,
  );
  await shot(page, 'k07-ranking');
  await activeView(page).getByRole('button', { name: 'Volver' }).click();
  await expect(machine(page)).toBeVisible();

  await activeView(page).getByRole('link', { name: 'Historial' }).click();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(activeView(page).getByText(`${LUIS.name} ·`).first()).toBeVisible();
  await activeView(page).getByRole('button', { name: 'Retiros' }).click();
  await shot(page, 'k08-historial');
  await activeView(page).getByRole('button', { name: 'Volver' }).click();
  await expect(machine(page)).toBeVisible();
});

test('el administrador entra desde la máquina con su código', async () => {
  await typePin(page, '1357');
  await expect(keypad(page)).toContainText('ADMINISTRADOR');
  await expect(activeView(page).getByRole('link', { name: '¿Sin código? Entrar con correo' })).toBeVisible();
  await keypad(page).getByRole('button', { name: /^OK/ }).click();
  await expect(keypad(page)).toContainText('Código incorrecto · te quedan 4 intentos');

  await typeAndOk(page, ADMIN_CODE);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('navigation', { name: 'Administración' })).toBeVisible();
  await shot(page, 'k09-admin');
  expect(ANA.name).toBeTruthy();
});
