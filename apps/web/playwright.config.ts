import { defineConfig, devices } from '@playwright/test';

// The sandbox must be running and seeded (`npm run sandbox:init` and `npm run dev:up`).
// PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome instead of the browser that `playwright install` downloads.
const channel = process.env.PLAYWRIGHT_CHANNEL === undefined || process.env.PLAYWRIGHT_CHANNEL === '' ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${process.env.LUMIA_WEB_PORT ?? '5173'}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...channel, viewport: { width: 1440, height: 900 } } }],
});
