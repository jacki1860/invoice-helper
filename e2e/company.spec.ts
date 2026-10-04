import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/invoice/') && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  test
    .info()
    .annotations.push({ type: 'coverage', description: 'Built static company site, Chromium' });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
});

test('search opens a real tool and unknown routes stay 404', async ({ page, request }, info) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/小事務/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('今天，要做什麼？');
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('假日');
  await page.locator('.directory-tool').filter({ hasText: '假日行事曆' }).click();
  await expect(page).toHaveURL(/\/invoice\/calendar\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('國定假日行事曆');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true });
  expect((await request.get('missing-page/')).status()).toBe(404);
});

test('quote sample produces a real PNG and a readable print PDF', async ({ page }, info) => {
  await page.goto('quote/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('報價與請款單');
  await page.getByRole('button', { name: '載入文件範例' }).click();
  await expect(page.getByRole('textbox', { name: '開立方 *', exact: true })).toHaveValue(
    '小事務工作室',
  );
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載文件 PNG', exact: true }).click();
  const download = await pendingDownload;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const png = info.outputPath('quote.png');
  await download.saveAs(png);
  const image = await readFile(png);
  expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(image.readUInt32BE(16)).toBeGreaterThan(500);
  expect(image.readUInt32BE(20)).toBeGreaterThan(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('quote-screen.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Check the real button reaches print, then exercise Chromium's print-to-PDF renderer.
  await page.evaluate(() => {
    window.print = () => document.documentElement.setAttribute('data-print-requested', 'true');
  });
  await page.getByRole('button', { name: '列印／另存 PDF', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
  const pdf = info.outputPath('quote.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  expect(text).toContain('小事務工作室');
  expect(text).toContain('範例客戶');
  expect(text).toContain('設計服務');
  expect(text).toContain('印刷製作');
  expect(text).not.toContain('下載文件 PNG');
});

test('annual calendar download contains dated events and a cross-year end date', async ({
  page,
}, info) => {
  await page.goto('calendar/');
  await page.getByLabel('選擇年份').selectOption('2027');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^下載 2027 (?:節日與補假|全年) ICS$/ }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('taiwan-holidays-2027.ics');
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const content = await readFile(file, 'utf8');
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(24);
  expect(content).toContain('DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101');
  expect(content).toContain('SUMMARY:2028 年元旦補假');
});
