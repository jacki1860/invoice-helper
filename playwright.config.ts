import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.COMPANY_TEST_PORT || 4178);
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || join(tmpdir(), 'invoice-helper-browser-results'),
  use: {
    baseURL: `http://127.0.0.1:${port}/invoice/`,
    browserName: 'chromium',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 320, height: 800 } } },
  ],
  webServer: {
    command: 'node scripts/serve-company.mjs',
    url: `http://127.0.0.1:${port}/invoice/`,
    reuseExistingServer: false,
  },
});
