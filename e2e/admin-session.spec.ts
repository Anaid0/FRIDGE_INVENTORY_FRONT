import { expect, test } from '@playwright/test';
import { activeView, ADMIN, API_URL, apiAdminToken, bearer, loginAdmin, resetDatabase } from './fixtures';

test.beforeAll(() => resetDatabase());

test('sin sesión, la administración pide login y vuelve a la página pedida', async ({ page }) => {
  await page.goto('/admin/personas');
  await expect(page).toHaveURL(/\/admin\/login\?redirect=\/admin\/personas/);
  // Se llena el formulario que ya está en pantalla (conserva el ?redirect).
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin\/personas$/);
});

test('si se desactiva a un administrador, su sesión abierta se cierra en la siguiente acción', async ({
  page,
  request,
}) => {
  const token = await apiAdminToken(request);
  const created = await request.post(`${API_URL}/users`, {
    headers: bearer(token),
    data: { name: 'Temporal', lastname: 'E2E', email: 'temporal@e2e.test', password: 'Temporal123' },
  });
  expect(created.ok()).toBe(true);
  const temporal = await created.json();

  await loginAdmin(page, { email: 'temporal@e2e.test', password: 'Temporal123' });
  await expect(activeView(page).getByRole('heading', { name: /Hola, Temporal/ })).toBeVisible();

  await request.patch(`${API_URL}/users/${temporal.id}`, {
    headers: bearer(token),
    data: { isActive: false },
  });
  await page
    .getByRole('navigation', { name: 'Administración' })
    .getByText('Movimientos', { exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login\?.*expired=1/);
  await expect(page.getByText('Tu sesión terminó. Vuelve a iniciar sesión.')).toBeVisible();
});
