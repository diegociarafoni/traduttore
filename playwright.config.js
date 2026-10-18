import { defineConfig, devices } from '@playwright/test';

const port = 4173;
export const API_URL = 'https://proxy.traduttore.test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.js',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', acceptDownloads: true },
  projects: [
    { name: 'chiaro', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'scuro', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'telefono', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
