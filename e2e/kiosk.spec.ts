import { expect, test, type Page } from '@playwright/test';
import { activeView, ADMIN, ANA, LUIS, openTab, resetDatabase, tapProduct, typePin } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const stockText = (page: Page, name: string) =>
  activeView(page)
    .getByRole('button', { name: new RegExp(`^${name}:`) })
    .getAttribute('aria-label');

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
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin\/tablets\?autorizar=1/);
  const dialog = page.locator('ion-modal').filter({ hasText: 'Usar este dispositivo como tablet' });
  await dialog.getByLabel('Nombre de la tablet').fill('Tablet E2E');
  await dialog.getByRole('button', { name: 'Autorizar' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(activeView(page).getByText('Quien más retira')).toBeVisible();
  await expect(activeView(page).getByText(ANA.name).first()).toBeVisible(); // demo: Ana encabeza
  await shot(page, 'k02-inicio');

  // La sesión de admin se cerró al autorizar.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/');
});

test('Luis saca 2 gaseosas y 1 yogur con su nombre y PIN', async () => {
  await expect(activeView(page).getByRole('tab', { name: 'Sacar' })).toHaveAttribute('aria-selected', 'true');
  await tapProduct(page, 'Gaseosa 400 ml', 2);
  await tapProduct(page, 'Yogur de fresa');
  const cart = activeView(page).getByRole('complementary', { name: 'Lo que elegiste' });
  await expect(cart).toContainText('Gaseosa 400 ml');
  await shot(page, 'k03-lista');
  await cart.getByRole('button', { name: /Continuar/ }).click();

  await expect(activeView(page).getByRole('heading', { name: '¿Quién eres?' })).toBeVisible();
  await expect(activeView(page).getByRole('button', { name: /Luis/ })).toBeVisible();
  await shot(page, 'k04-quien-eres');
  await activeView(page).getByRole('button', { name: /Luis/ }).click();

  await expect(activeView(page).getByRole('heading', { name: 'Hola, Luis' })).toBeVisible();
  await typePin(page, '0000');
  await expect(activeView(page).getByRole('alert')).toContainText('Te quedan 4 intentos');
  await shot(page, 'k05-pin-incorrecto');
  await typePin(page, LUIS.pin);

  const done = activeView(page).getByRole('status').filter({ hasText: '¡Listo, Luis!' });
  await expect(done).toContainText('Sacaste 2 Gaseosa 400 ml y 1 Yogur de fresa.');
  await shot(page, 'k06-listo');
  await done.getByRole('button', { name: 'Terminar' }).click();

  // Demo: Luis tenía 7 retiros de unidades; ahora 10 y pasa a ser quien más retira (Ana: 9).
  await expect(activeView(page).locator('header')).toContainText(LUIS.name);
  await expect(activeView(page).locator('header')).toContainText('10 und.');
});

test('meter productos y ver ranking y movimientos', async () => {
  await openTab(page, 'Meter');
  const before = await stockText(page, 'Manzanas');
  await tapProduct(page, 'Manzanas', 3);
  await activeView(page)
    .getByRole('button', { name: /Continuar/ })
    .click();
  await activeView(page).getByRole('button', { name: /Ana/ }).click();
  await typePin(page, ANA.pin);
  await expect(activeView(page).getByRole('status').filter({ hasText: '¡Listo, Ana!' })).toContainText(
    'Metiste 3 Manzanas.',
  );
  await activeView(page).getByRole('button', { name: 'Terminar' }).click();
  expect(await stockText(page, 'Manzanas')).not.toBe(before);

  await openTab(page, 'Ranking');
  await expect(activeView(page).getByRole('list', { name: 'Unidades retiradas por persona' })).toContainText(
    LUIS.name,
  );
  await shot(page, 'k07-ranking');
  await openTab(page, 'Historial');
  await expect(
    activeView(page)
      .getByText(/Ana Gómez\s+metió 3 unidades de/)
      .first(),
  ).toBeVisible();
  await shot(page, 'k08-movimientos');
});

test('Atrás vuelve al paso anterior y Vaciar limpia la lista', async () => {
  await openTab(page, 'Sacar');
  await tapProduct(page, 'Papas fritas');
  await activeView(page)
    .getByRole('button', { name: /Continuar/ })
    .click();
  await activeView(page).getByRole('button', { name: 'Volver a elegir' }).click();
  const cart = activeView(page).getByRole('complementary', { name: 'Lo que elegiste' });
  await expect(cart).toContainText('Papas fritas');
  await cart.getByRole('button', { name: 'Vaciar' }).click();
  await expect(cart).toContainText('Toca los productos para agregarlos.');
});
