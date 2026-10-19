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
  await page.getByLabel('Contraseña').fill(user.password);
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
  const view = activeView(page);
  // `has` se evalúa dentro de cada fila: el localizador interno debe partir de `page`, no de la vista.
  const row = view.getByRole('row').filter({ has: page.getByText(productName, { exact: true }) });
  return Number(await row.locator('[data-stock]').innerText());
}

export function headerBadge(page: Page) {
  return activeView(page).getByRole('link', { name: /Quien más retira|Aún no hay retiros/ });
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
  await expect(activeView(page).getByText('Quien más retira')).toBeVisible();
}

/** Toca un producto de la grilla N veces. */
export async function tapProduct(page: Page, name: string, times = 1) {
  const tile = activeView(page).getByRole('button', { name: new RegExp(`^${name}:`) });
  for (let i = 0; i < times; i++) await tile.click();
}

export async function typePin(page: Page, pin: string) {
  for (const digit of pin) await activeView(page).getByRole('button', { name: digit, exact: true }).click();
}

/**
 * Cambia de pestaña en la navegación de la tablet (barra lateral, o abajo en el celular) y comprueba que
 * quedó seleccionada. Pestañas: Sacar, Meter, Ranking, Historial.
 */
export async function openTab(page: Page, label: string) {
  await activeView(page).getByRole('tab', { name: label }).click();
  await expect(activeView(page).getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
}

/** Lista de lo elegido (panel lateral de la tablet). */
export const cartPanel = (page: Page) =>
  activeView(page).getByRole('complementary', { name: 'Lo que elegiste' });

/** Sacar/Meter: productos → Continuar → persona → PIN. */
export async function kioskRegister(
  page: Page,
  items: [string, number][],
  person: { name: string; pin: string },
) {
  for (const [name, times] of items) await tapProduct(page, name, times);
  await cartPanel(page)
    .getByRole('button', { name: /Continuar/ })
    .click();
  await activeView(page)
    .getByRole('button', { name: new RegExp(person.name.split(' ')[0]!) })
    .click();
  await typePin(page, person.pin);
}

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
