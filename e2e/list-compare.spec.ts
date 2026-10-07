import { test, expect, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('list-compare/');
  await expect(page).toHaveTitle(/雙清單比對/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('雙清單比對');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('three sets, real clipboard copies and UTF-8 TXT agree, and all notices expire on any edit', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(page.getByRole('button', { name: '複製完整報告' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下載 TXT', exact: true })).toBeDisabled();
  await page.locator('#list-compare-a').fill('  丙\n甲\n\n乙\n甲\n丁  ');
  await page.locator('#list-compare-b').fill('乙\n丙\n戊\n戊\n己');
  await expect(page.locator('.list-compare-count')).toHaveText(['2 項', '2 項', '2 項']);
  await expect(page.locator('.list-compare-input-stats').first().locator('dd')).toHaveText([
    '6',
    '4',
    '1',
    '1',
  ]);
  await expect(page.locator('.list-compare-input-stats').last().locator('dd')).toHaveText([
    '5',
    '4',
    '0',
    '1',
  ]);
  for (const [id, label, value] of [
    ['onlyA', '只在 A', '甲\n丁'],
    ['common', '雙方都有', '丙\n乙'],
    ['onlyB', '只在 B', '戊\n己'],
  ]) {
    await expect(page.locator(`#list-compare-${id}`)).toHaveValue(value);
    await page.getByRole('button', { name: `複製${label}`, exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
  }
  const report = await page.locator('#list-compare-report').inputValue();
  expect(report).toContain(
    '【只在 A】2 項\n甲\n丁\n\n【雙方都有】2 項\n丙\n乙\n\n【只在 B】2 項\n戊\n己',
  );
  await page.getByRole('button', { name: '複製完整報告' }).click();
  await expect(page.locator('.list-compare-results .copy-action [role="status"]')).toHaveText([
    '已複製。',
    '已複製。',
    '已複製。',
    '已複製。',
  ]);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(report);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 TXT', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('雙清單比對.txt');
  const file = info.outputPath('list-compare.txt');
  await download.saveAs(file);
  expect(await readFile(file)).toEqual(Buffer.from(report, 'utf8'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('list-compare-result.png'), fullPage: true });
  // The edit has identical normalized output; statuses must still become stale.
  await page.locator('#list-compare-a').fill('丙\n甲\n\n乙\n甲\n丁');
  await expect(page.locator('#list-compare-report')).toHaveValue(report);
  await expect(page.locator('.list-compare-results .copy-action [role="status"]')).toHaveText([
    '',
    '',
    '',
    '',
  ]);
  await expect(page.locator('.list-compare-download-status')).toHaveText('');
});

test('empty sides, duplicates, exact Unicode and reordered common items have clear results', async ({
  page,
}) => {
  const a = page.locator('#list-compare-a');
  const b = page.locator('#list-compare-b');
  await a.fill('甲\n甲\n乙');
  await expect(page.locator('.list-compare-count')).toHaveText(['2 項', '0 項', '0 項']);
  await expect(page.getByRole('button', { name: '複製雙方都有', exact: true })).toBeDisabled();
  await b.fill('乙\n甲');
  await expect(page.locator('#list-compare-common')).toHaveValue('甲\n乙');
  await expect(page.locator('.list-compare-results > [role="status"]')).toContainText('項目相同');
  await a.fill('ABC\n001\né\na b\n<script>\n😀');
  await b.fill('abc\n1\né\na  b\n😀\n<script>');
  await expect(page.locator('#list-compare-onlyA')).toHaveValue('ABC\n001\né\na b');
  await expect(page.locator('#list-compare-common')).toHaveValue('<script>\n😀');
  await expect(page.locator('#list-compare-onlyB')).toHaveValue('abc\n1\né\na  b');
  await a.fill(' \n　');
  await b.fill('\t\n');
  await expect(page.locator('#list-compare-report')).toHaveValue('');
  await expect(page.locator('.list-compare-results > [role="status"]')).toContainText('只有空白');
  for (const label of ['複製只在 A', '複製雙方都有', '複製只在 B', '複製完整報告', '下載 TXT']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled();
  }
});

test('limits inspect raw input and suspend every result while preserving both fields', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  async function paste(target: Locator, value: string) {
    // Chromium's insertText path used by fill is slow for thousands of lines,
    // even in a plain textarea. Exercise the user's real bulk-paste action.
    await page.evaluate((text) => navigator.clipboard.writeText(text), value);
    await target.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press(value === '' ? 'Backspace' : 'ControlOrMeta+V');
    await expect(target).toHaveValue(value.replace(/\r\n|\r/g, '\n'));
  }
  const a = page.locator('#list-compare-a');
  const b = page.locator('#list-compare-b');
  const limitRows = Array(5_000).fill('甲').join('\n');
  await paste(a, limitRows);
  await paste(b, limitRows);
  await expect(page.locator('#list-compare-common')).toHaveValue('甲');
  await expect(page.locator('.list-compare-input-stats').first().locator('dd')).toHaveText([
    '5,000',
    '1',
    '0',
    '4,999',
  ]);
  await paste(b, `${limitRows}\n`);
  await expect(b).toHaveValue(`${limitRows}\n`);
  await expect(a).toHaveValue(limitRows);
  await expect(page.locator('#list-compare-b-error')).toContainText('超過 5,000 行');
  for (const id of ['onlyA', 'common', 'onlyB', 'report']) {
    await expect(page.locator(`#list-compare-${id}`)).toHaveValue('');
  }
  for (const label of ['複製只在 A', '複製雙方都有', '複製只在 B', '複製完整報告', '下載 TXT']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled();
  }
  await paste(b, '');
  await paste(a, '😀'.repeat(100_000));
  await expect(page.locator('#list-compare-a-error')).toHaveCount(0);
  await expect(page.locator('.list-compare-count')).toHaveText(['1 項', '0 項', '0 項']);
  await paste(a, '😀'.repeat(100_001));
  await expect(a).toHaveValue('😀'.repeat(100_001));
  await expect(page.locator('#list-compare-a-error')).toContainText('超過 100,000 個字元');
  await expect(page.locator('#list-compare-report')).toHaveValue('');
  await paste(a, ' '.repeat(100_001));
  await expect(page.locator('#list-compare-a-error')).toBeVisible();
  await paste(a, `${'a'.repeat(99_999)}\r\n`);
  await expect(a).toHaveValue(`${'a'.repeat(99_999)}\n`);
  await expect(page.locator('#list-compare-a-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '複製完整報告' })).toBeEnabled();
});

test('sample and clear confirm replacement, navigation retains both inputs, reload erases them', async ({
  page,
}) => {
  const a = page.locator('#list-compare-a');
  const b = page.locator('#list-compare-b');
  await a.fill('保留預定');
  await b.fill('保留實際');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(a).toHaveValue('保留預定');
  await expect(b).toHaveValue('保留實際');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '清空雙欄', exact: true }).click();
  await expect(a).toHaveValue('保留預定');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(a).toHaveValue(/投影機/);
  await expect(page.locator('.list-compare-count')).toHaveText(['1 項', '3 項', '1 項']);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空雙欄', exact: true }).click();
  await expect(a).toHaveValue('');
  await expect(b).toHaveValue('');
  await expect(page.getByRole('button', { name: '清空雙欄', exact: true })).toBeDisabled();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`));
  await a.fill('合成預定只留記憶體');
  await b.fill('合成實際只留記憶體');
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('名單核對');
  await page.locator('.directory-tool').filter({ hasText: '雙清單比對' }).click();
  await expect(a).toHaveValue('合成預定只留記憶體');
  await expect(b).toHaveValue('合成實際只留記憶體');
  const stores = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(stores).not.toContain('合成預定');
  expect(stores).not.toContain('合成實際');
  expect(requests.join('\n')).not.toContain('合成預定');
  expect(requests.join('\n')).not.toContain('合成實際');
  await page.reload();
  await expect(a).toHaveValue('');
  await expect(b).toHaveValue('');
});

test('home search, task, category and directory entries reach the canonical page', async ({
  page,
  request,
}) => {
  await page.getByRole('link', { name: '小事務，工具總覽' }).click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('缺漏清單');
  await page.locator('.directory-tool').filter({ hasText: '雙清單比對' }).click();
  await expect(page).toHaveURL(/\/invoice\/list-compare\/$/);
  for (const path of [
    'directory/',
    'task/purchasing/',
    'task/reference/',
    'category/conversions/',
  ]) {
    await page.goto(path);
    await page.locator('.directory-tool').filter({ hasText: '雙清單比對' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('雙清單比對');
    await expect(page).toHaveURL(/\/invoice\/list-compare\/$/);
  }
  const response = await request.get('list-compare/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('rel="canonical" href="https://www.ctrls.com.tw/invoice/list-compare/"');
  expect(html).toContain('雙清單比對：核對預定與實際的缺漏、共有及額外項目');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('<noscript>');
});
