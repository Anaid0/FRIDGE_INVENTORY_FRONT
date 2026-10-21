import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Credenciales del admin del backend (.env) y de los usuarios del seed de demo (prisma/seed-demo.ts). */
function backendEnv(): Record<string, string> {
  const file = path.resolve(import.meta.dirname, '../../FRIDGE_INVENTORY_BACK/.env');
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1]!, match[2]!]),
  );
}

const env = backendEnv();
export const API_URL = 'http://localhost:3100/api';
export const ADMIN = { email: env.ADMIN_EMAIL ?? 'admin@fridgeya.local', password: env.ADMIN_PASSWORD ?? '' };
/** Personas del seed de demo (prisma/seed-demo.ts): se identifican en la tablet con nombre + PIN. */
export const ANA = { name: 'Ana Gómez', pin: '2580' };
export const LUIS = { name: 'Luis Martínez', pin: '3691' };
export const MARTA = { name: 'Marta Ríos', pin: '4826' };

export async function loginAdmin(page: Page, user: { email: string; password: string } = ADMIN) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Dinero como lo muestra la app ("$ 48.000", con espacio duro): tolera cualquier espacio. */
export function money(amount: string): RegExp {
  return new RegExp(`\\$\\s?${amount.replace(/\./g, '\\.')}`);
}

/**
 * La página visible. Ionic deja en el DOM (ocultas) las páginas visitadas antes para animar el "atrás",
 * así que las búsquedas deben limitarse a la activa.
 */
export function activeView(page: Page) {
  return page.locator('ion-router-outlet > .ion-page:not(.ion-page-hidden)');
}

/** Número de unidades que muestra la fila de un producto en /admin/productos. */
export async function stockOf(page: Page, productName: string): Promise<number> {
  // `has` se evalúa dentro de cada fila: el localizador interno debe partir de `page`, no de la vista.
  const row = activeView(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: new RegExp(`^Editar ${productName}(,|$)`) }) });
  return Number(await row.locator('[data-stock]').innerText());
}

/**
 * Deja la base *_test en el estado del seed de demo. Cada archivo de e2e la reinicia al empezar para no
 * depender de lo que hicieron los demás (todos comparten la misma base).
 */
export function resetDatabase() {
  execFileSync('npm', ['run', 'e2e:reset-db'], {
    cwd: path.resolve(import.meta.dirname, '../../FRIDGE_INVENTORY_BACK'),
    stdio: 'ignore',
  });
}

// ---------------------------------------------------------------------------------------------------------
// API directa (para preparar escenarios sin pasar por la interfaz)
// ---------------------------------------------------------------------------------------------------------

export async function apiAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, { data: ADMIN });
  expect(res.ok()).toBe(true);
  return (await res.json()).token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Autoriza una tablet por API y devuelve su token (el mismo que guardaría la app). */
export async function apiPairTablet(request: APIRequestContext, adminToken: string, name = 'Tablet E2E') {
  const res = await request.post(`${API_URL}/kiosk/devices`, { headers: bearer(adminToken), data: { name } });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return { token: body.token as string, deviceId: body.device.id as string };
}

export async function apiPersonId(request: APIRequestContext, adminToken: string, fullName: string) {
  const people: { id: string; fullName: string }[] = await (
    await request.get(`${API_URL}/people`, { headers: bearer(adminToken) })
  ).json();
  const person = people.find((p) => p.fullName === fullName);
  if (!person) throw new Error(`No existe la persona ${fullName}`);
  return person.id;
}

export async function apiProductId(request: APIRequestContext, adminToken: string, name: string) {
  const products: { id: string; name: string }[] = await (
    await request.get(`${API_URL}/products`, { headers: bearer(adminToken) })
  ).json();
  const product = products.find((p) => p.name === name);
  if (!product) throw new Error(`No existe el producto ${name}`);
  return product.id;
}

// ---------------------------------------------------------------------------------------------------------
// Tablet
// ---------------------------------------------------------------------------------------------------------

/** Abre la app como una tablet ya autorizada (token precargado como si se hubiera emparejado antes). */
export async function openPairedTablet(page: Page, kioskToken: string) {
  await page.addInitScript((token) => localStorage.setItem('fridgeya.kioskToken', token), kioskToken);
  await page.goto('/');
  await expect(machine(page)).toBeVisible();
}

/** La vitrina de la máquina expendedora. */
export const machine = (page: Page) => activeView(page).getByRole('region', { name: 'Máquina de productos' });
/** "Tu retiro": lo elegido, con un botón para quitar cada producto. */
export const cartPanel = (page: Page) => activeView(page).getByRole('region', { name: 'Tu retiro' });
/** El teclado de la máquina (pantalla + teclas). */
export const keypad = (page: Page) => activeView(page).getByRole('region', { name: 'Teclado' });

/** Toca un producto de la máquina N veces. */
export async function tapProduct(page: Page, name: string, times = 1) {
  const tile = machine(page).getByRole('button', { name: new RegExp(`^Agregar ${name}, quedan`) });
  for (let i = 0; i < times; i++) await tile.click();
}

/** Marca dígitos en el teclado de la máquina (o en el teclado de PIN de "Cambiar mi PIN"). */
export async function typePin(page: Page, digits: string) {
  for (const digit of digits) await activeView(page).getByRole('button', { name: digit, exact: true }).click();
}

/** Marca dígitos y pulsa OK en la máquina. */
export async function typeAndOk(page: Page, digits: string) {
  await typePin(page, digits);
  await keypad(page).getByRole('button', { name: /^OK/ }).click();
}

/**
 * Retirar: tocar los productos → PIN + OK (el PIN identifica a la persona).
 * En el celular el PIN va en un segundo paso: primero "Retirar · N".
 */
export async function kioskRegister(
  page: Page,
  items: [string, number][],
  person: { name: string; pin: string },
) {
  for (const [name, times] of items) await tapProduct(page, name, times);
  const withdraw = cartPanel(page).getByRole('button', { name: /^Retirar/ });
  if (await withdraw.isVisible()) await withdraw.click();
  await expect(keypad(page)).toContainText('TU PIN');
  await typeAndOk(page, person.pin);
}

/** Código del administrador del e2e (backend: scripts/e2eEnv.ts → E2E_ADMIN_CODE). */
export const ADMIN_CODE = '482915';

// ---------------------------------------------------------------------------------------------------------
// Diseño
// ---------------------------------------------------------------------------------------------------------

/**
 * Ancho que se sale de la pantalla dentro del contenido visible. En Ionic el scroll vive dentro de
 * <ion-content> (shadow DOM), no en el documento: se mide ahí.
 */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const contents = document.querySelectorAll<HTMLElement & { getScrollElement(): Promise<HTMLElement> }>(
      'ion-router-outlet > .ion-page:not(.ion-page-hidden) ion-content',
    );
    let worst = document.documentElement.scrollWidth - window.innerWidth;
    for (const content of contents) {
      const scroll = await content.getScrollElement();
      worst = Math.max(worst, scroll.scrollWidth - scroll.clientWidth);
    }
    return worst;
  });
}

/** Desliza un dedo en horizontal (eventos táctiles reales de Chrome), de `fromX` a `toX` a la altura `y`. */
export async function swipe(page: Page, fromX: number, toX: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  const point = (x: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(fromX) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(fromX + ((toX - fromX) * i) / steps),
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
