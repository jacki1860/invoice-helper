import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('hourly/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('工時費用');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('editing only time fields reveals errors and preserves row-specific validation', async ({
  page,
}, info) => {
  const row = page.locator('.hourly-row').first();
  await expect(row.locator('.field-error')).toHaveText('');
  await page.getByLabel('分鐘 1', { exact: true }).fill('60');
  await expect(row.getByRole('alert')).toContainText('分鐘須為 0 至 59');
  await page.screenshot({ path: info.outputPath('hourly-invalid.png'), fullPage: true });
  await page.getByLabel('分鐘 1', { exact: true }).fill('0');
  await expect(row.locator('.field-error')).not.toContainText('分鐘須為');
  await page.getByLabel('小時 1', { exact: true }).fill('-1');
  await expect(row.getByRole('alert')).toContainText('小時須為 0 至 9,999 的整數');
  await page.getByLabel('小時 1', { exact: true }).fill('1');
  await page.getByRole('button', { name: '新增工作', exact: true }).click();
  await expect(page.locator('.hourly-row').nth(1).locator('.field-error')).toHaveText('');
  await page.getByLabel('小時 2', { exact: true }).fill('10000');
  await expect(page.locator('.hourly-row').nth(1).getByRole('alert')).toContainText('小時須為');
  await page.getByRole('button', { name: '刪除工作 1', exact: true }).click();
  await expect(page.getByLabel('小時 1', { exact: true })).toHaveValue('10000');
  await expect(page.locator('.hourly-row').getByRole('alert')).toContainText('小時須為');
  await page.getByRole('button', { name: '新增工作', exact: true }).click();
  await expect(page.locator('.hourly-row').nth(1).locator('.field-error')).toHaveText('');
});

test('corrected time keeps actual clipboard and cost handoff working', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('分鐘 1', { exact: true }).fill('60');
  await expect(page.locator('.hourly-row').getByRole('alert')).toContainText('分鐘須為');
  await page.getByLabel('分鐘 1', { exact: true }).fill('30');
  await page.getByLabel('項目名稱 1', { exact: true }).fill('合成工時驗收');
  await page.getByLabel('時薪 1（元）', { exact: true }).fill('200');
  await expect(page.locator('.hourly-row .field-error')).toHaveText('');
  const result = page.getByRole('region', { name: '工時費用結果', exact: true });
  await expect(result.locator('.result-number')).toHaveText('NT$300.00');
  await result.getByRole('button', { name: '複製結果', exact: true }).click();
  await expect(result.getByRole('status')).toHaveText('已複製。');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '合成工時驗收：1 小時 30 分鐘，NT$ 300.00\n總費用：NT$ 300.00（未加計稅額）',
  );
  await page.screenshot({ path: info.outputPath('hourly-corrected.png'), fullPage: true });
  await page.getByRole('button', { name: '帶入成本試算', exact: true }).click();
  await expect(page).toHaveURL(/\/invoice\/profit\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('成本與利潤試算');
  await expect(page.getByRole('region', { name: '工時成本帶入確認' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '確認取代成本', exact: true }).click();
  await expect(page.getByLabel('成本名稱 1', { exact: true })).toHaveValue('');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '確認取代成本', exact: true }).click();
  await expect(page.getByLabel('成本名稱 1', { exact: true })).toHaveValue('合成工時驗收');
  await expect(page.getByLabel('未稅成本 1（元）', { exact: true })).toHaveValue('300.00');
});
