import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const original = '通知\n交付 10/15\n\n001\n結束';
const revised = '通知\n交付 10/18\n\n001\n新增聯絡方式\n結束';
const expectedRows = [
  '[= 原:1 新:1] 通知',
  '[- 原:2 新:—] 交付 10/15',
  '[+ 原:— 新:2] 交付 10/18',
  '[= 原:3 新:3] ',
  '[= 原:4 新:4] 001',
  '[+ 原:— 新:5] 新增聯絡方式',
  '[= 原:5 新:6] 結束',
].join('\n');

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('text-diff/');
  await expect(page).toHaveTitle(/文字版本差異/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('文字版本差異');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('line comparison produces the same actual clipboard and UTF-8 TXT report', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(page.getByRole('button', { name: '複製完整報告' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下載 TXT', exact: true })).toBeDisabled();
  await page.locator('#text-diff-original').fill(original);
  await page.locator('#text-diff-revised').fill(revised);
  await expect(page.locator('.text-diff-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['4', '2', '1']);
  const report = await page.locator('#text-diff-report').inputValue();
  expect(report).toContain('原版 5 行／新版 6 行');
  expect(report.split('--- 差異內容開始 ---\n')[1]).toBe(expectedRows);
  await page.getByRole('button', { name: '複製完整報告' }).click();
  await expect(page.locator('.text-diff-results .copy-action [role="status"]')).toHaveText(
    '已複製。',
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(report);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 TXT', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('文字版本差異.txt');
  const file = info.outputPath('text-diff.txt');
  await download.saveAs(file);
  expect(await readFile(file)).toEqual(Buffer.from(report, 'utf8'));
  await page.locator('.text-diff-results').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('text-diff-result.png'), fullPage: true });
  await page.locator('#text-diff-revised').fill(`${revised}\n`);
  await expect(page.locator('.text-diff-results .copy-action [role="status"]')).toHaveText('');
  await expect(page.locator('.text-diff-download-status')).toHaveText('');
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['4', '3', '1']);
});

test('bounds preserve raw text and disable all output until corrected', async ({ page }) => {
  const before = page.locator('#text-diff-original');
  const after = page.locator('#text-diff-revised');
  await before.fill('001\n001\n');
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['0', '0', '3']);
  await after.fill('001\n001\n');
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['3', '0', '0']);
  const limitLines = Array.from({ length: 1000 }, () => 'A').join('\n');
  await before.fill(limitLines);
  await after.fill(limitLines);
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['1000', '0', '0']);
  await before.fill(`${limitLines}\n`);
  await expect(before).toHaveValue(`${limitLines}\n`);
  await expect(page.locator('#text-diff-original-error')).toContainText('超過 1,000 行');
  await expect(page.locator('.text-diff-table')).toHaveCount(0);
  await expect(page.locator('#text-diff-report')).toHaveValue('');
  await expect(page.getByRole('button', { name: '下載 TXT', exact: true })).toBeDisabled();
  await before.fill('😀'.repeat(100_000));
  await after.fill('');
  await expect(page.locator('#text-diff-original-error')).toHaveCount(0);
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['0', '0', '1']);
  await before.fill('😀'.repeat(100_001));
  await expect(before).toHaveValue('😀'.repeat(100_001));
  await expect(page.locator('#text-diff-original-error')).toContainText('超過 100,000 個字元');
  await expect(page.getByRole('button', { name: '複製完整報告' })).toBeDisabled();
  await before.fill('修正後');
  await expect(page.getByRole('button', { name: '複製完整報告' })).toBeEnabled();
  // The browser normalizes pasted CRLF before the input's code-point limit is applied.
  await before.fill(`${'a'.repeat(99_999)}\r\n`);
  await expect(before).toHaveValue(`${'a'.repeat(99_999)}\n`);
  await expect(page.locator('#text-diff-original-error')).toHaveCount(0);
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['0', '0', '2']);
});

test('sample and clear confirm overwrites while navigation retains only current session inputs', async ({
  page,
}, info) => {
  const before = page.locator('#text-diff-original');
  const after = page.locator('#text-diff-revised');
  await before.fill('保留原稿');
  await after.fill('保留新版');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(before).toHaveValue('保留原稿');
  await expect(after).toHaveValue('保留新版');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '清空雙欄' }).click();
  await expect(after).toHaveValue('保留新版');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(before).toHaveValue(/專案交付通知/);
  await expect(page.locator('.text-diff-stats dd')).toHaveText(['4', '2', '1']);
  await page.screenshot({ path: info.outputPath('text-diff-sample.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空雙欄' }).click();
  await expect(before).toHaveValue('');
  await expect(after).toHaveValue('');
  await expect(page.getByRole('button', { name: '清空雙欄' })).toBeDisabled();
  await before.fill('只在這一頁的合成測試文字');
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('文字版本');
  await page.locator('.directory-tool').filter({ hasText: '文字版本差異' }).click();
  await expect(page).toHaveURL(/\/invoice\/text-diff\/$/);
  await expect(before).toHaveValue('只在這一頁的合成測試文字');
  const stores = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(stores).not.toContain('只在這一頁的合成測試文字');
  await page.reload();
  await expect(before).toHaveValue('');
  await expect(after).toHaveValue('');
});
