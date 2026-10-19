import { defineConfig, devices } from '@playwright/test';

const BACK_DIR = '../FRIDGE_INVENTORY_BACK';
const FRONT_PORT = 5174;
const API_PORT = 3100;

/**
 * E2E de punta a punta: navegador → front (Vite) → API real → MySQL (base *_test).
 * Usa el Google Chrome instalado (channel: 'chrome'), así no se descarga ningún navegador.
 * Los tests comparten la base: corren en serie, en un solo worker.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      testMatch: /admin.*\.spec/,
    },
    {
      // Tablet en horizontal, táctil: el uso principal de la app.
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
      },
      testMatch: /kiosk.*\.spec/,
    },
    { name: 'celular', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: BACK_DIR,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      env: { VITE_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
