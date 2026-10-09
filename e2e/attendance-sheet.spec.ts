import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const repeatedNames = [
  '林小青',
  '林小青',
  ...Array.from({ length: 19 }, (_, index) => `參與者${index + 3}`),
].join('\n');

async function fillEvent(page: import('@playwright/test').Page) {
  await page.getByLabel('活動名稱 *', { exact: true }).fill('社區交流日');
  await page.getByLabel('活動日期 *', { exact: true }).fill('2026-10-09');
  await page.getByLabel('活動地點（選填）', { exact: true }).fill('活動中心一樓');
  await page.getByLabel('主辦單位（選填）', { exact: true }).fill('交流小組');
}

const pdfPageCount = (pdf: Buffer) =>
  [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('attendance-sheet/');
  await expect(page).toHaveTitle(/活動簽到表/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('活動簽到表');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('21 names preserve duplicates across two pages, complete clipboard and real page PNG downloads', async ({
  page,
  context,
}, info) => {
  test.setTimeout(60_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(
    page.getByRole('button', { name: '列印全部／另存 PDF', exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: info.outputPath('attendance-initial.png'), fullPage: false });
  await fillEvent(page);
  await page.getByLabel('總列數 *', { exact: true }).fill('21');
  await page.getByLabel('姓名名單（選填）', { exact: true }).fill(repeatedNames);
  await expect(page.locator('.attendance-paper')).toHaveCount(2);
  await expect(page.locator('.attendance-table tbody tr')).toHaveCount(21);
  await expect(page.locator('.attendance-table tbody tr').nth(0)).toContainText('林小青');
  await expect(page.locator('.attendance-table tbody tr').nth(1)).toContainText('林小青');
  await expect(page.locator('.attendance-table tbody tr').nth(20)).toHaveText('21參與者21');
  await expect(page.locator('.attendance-paper footer')).toHaveText(['第 1 / 2 頁', '第 2 / 2 頁']);
  await page.getByRole('button', { name: '複製完整簽到表', exact: true }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split('\n').filter((line) => /^\d+\t/.test(line))).toHaveLength(21);
  expect(text).toContain('1\t林小青\t\t\t\n2\t林小青\t\t\t');
  expect(text).toContain('第 2 / 2 頁');
  expect(text).toContain('21\t參與者21\t\t\t');
  for (let index = 1; index <= 2; index += 1) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `下載第 ${index} 頁 PNG`, exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(`活動簽到表_2026-10-09_第${index}頁.png`);
    const file = info.outputPath(`attendance-${index}.png`);
    await download.saveAs(file);
    const data = await readFile(file);
    expect(data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(data.readUInt32BE(16)).toBe(1520);
    expect(data.readUInt32BE(20)).toBeGreaterThanOrEqual(2150);
  }
  await page.screenshot({ path: info.outputPath('attendance-21.png'), fullPage: true });
  const pdf = await page.pdf({
    path: info.outputPath('attendance-21.pdf'),
    preferCSSPageSize: true,
  });
  expect(pdfPageCount(pdf)).toBe(2);
  await page.getByLabel('主辦單位（選填）', { exact: true }).fill('新的交流小組');
  await expect(page.locator('.attendance-output-controls [role="status"]')).toHaveText(['', '']);
});

test('100 rows with maximum-length text fit exactly five A4 pages with every PNG available', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await fillEvent(page);
  await page.getByLabel('活動名稱 *', { exact: true }).fill('長'.repeat(80));
  await page.getByLabel('活動地點（選填）', { exact: true }).fill('地'.repeat(80));
  await page.getByLabel('主辦單位（選填）', { exact: true }).fill('組'.repeat(80));
  await page.getByLabel('總列數 *', { exact: true }).fill('100');
  await page
    .getByLabel('姓名名單（選填）', { exact: true })
    .fill(Array(100).fill('姓名'.repeat(12)).join('\n'));
  await expect(page.locator('.attendance-paper')).toHaveCount(5);
  await expect(page.locator('.attendance-table tbody tr')).toHaveCount(100);
  await expect(page.locator('.attendance-table tbody tr').last()).toHaveText(
    `100${'姓名'.repeat(12)}`,
  );
  await page.screenshot({ path: info.outputPath('attendance-max-screen.png'), fullPage: false });
  const pdf = await page.pdf({
    path: info.outputPath('attendance-max-five-pages.pdf'),
    preferCSSPageSize: true,
  });
  expect(pdfPageCount(pdf)).toBe(5);
  await page.emulateMedia({ media: 'print' });
  expect(
    await page
      .locator('.attendance-table tbody tr')
      .evaluateAll((rows) => rows.every((row) => row.getBoundingClientRect().height >= 35)),
  ).toBe(true);
  await page.emulateMedia({ media: 'screen' });
  for (let index = 1; index <= 5; index += 1) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `下載第 ${index} 頁 PNG`, exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    await download.saveAs(info.outputPath(`attendance-max-page-${index}.png`));
  }
});

test('invalid data remains intact and blocks all output, including name and row overflow', async ({
  page,
}, info) => {
  await fillEvent(page);
  const names = page.getByLabel('姓名名單（選填）', { exact: true });
  const print = page.getByRole('button', { name: '列印全部／另存 PDF', exact: true });
  const copy = page.getByRole('button', { name: '複製完整簽到表', exact: true });
  for (const invalid of ['王\t明', '字'.repeat(25), Array(101).fill('甲').join('\n')]) {
    await names.fill(invalid);
    await expect(names).toHaveValue(invalid);
    await expect(page.locator('#attendance-errors')).toBeVisible();
    await expect(print).toBeDisabled();
    await expect(copy).toBeDisabled();
    await expect(page.locator('.attendance-paper')).toHaveCount(0);
  }
  await names.fill(repeatedNames);
  await expect(page.locator('#attendance-errors')).toContainText('超過總列數 20');
  await page.screenshot({ path: info.outputPath('attendance-error.png'), fullPage: true });
  await names.fill('甲');
  await page.getByLabel('活動日期 *', { exact: true }).fill('2026-02-29');
  await expect(print).toBeDisabled();
  await page.getByLabel('活動日期 *', { exact: true }).fill('2024-02-29');
  await expect(print).toBeEnabled();
  await page.getByLabel('總列數 *', { exact: true }).fill('101');
  await expect(copy).toBeDisabled();
});

test('oversized native paste preserves the previous text and blocks stale output until editing', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fillEvent(page);
  const names = page.getByLabel('姓名名單（選填）', { exact: true });
  await names.fill('原有姓名');
  for (const oversized of ['測'.repeat(10_001), '\n'.repeat(1000)]) {
    await page.evaluate((value) => navigator.clipboard.writeText(value), oversized);
    await names.focus();
    await names.press('ControlOrMeta+A');
    await names.press('ControlOrMeta+V');
    await expect(names).toHaveValue('原有姓名');
    await expect(page.locator('#attendance-errors')).toContainText('這次貼上未套用');
    await expect(page.getByRole('button', { name: '複製完整簽到表', exact: true })).toBeDisabled();
    await expect(page.locator('.attendance-paper')).toHaveCount(0);
    await names.fill('原有姓名');
  }
  await page.evaluate(() => navigator.clipboard.writeText('甲\n甲\n\n乙'));
  await names.focus();
  await names.press('ControlOrMeta+A');
  await names.press('ControlOrMeta+V');
  await expect(names).toHaveValue('甲\n甲\n\n乙');
  await expect(page.locator('.attendance-summary')).toContainText('3 筆姓名');
});

test('native paste uses textarea newline normalization and UTF-16 selection boundaries', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fillEvent(page);
  const names = page.getByLabel('姓名名單（選填）', { exact: true });
  const clipboard = '甲' + Array(1000).fill(' '.repeat(9)).join('\r\n');
  const normalized = clipboard.replace(/\r\n?/g, '\n');
  expect(Array.from(normalized)).toHaveLength(10_000);
  await page.evaluate((value) => navigator.clipboard.writeText(value), clipboard);
  await names.focus();
  await names.press('ControlOrMeta+A');
  await names.press('ControlOrMeta+V');
  await expect(names).toHaveValue(normalized);
  await expect(page.locator('#attendance-errors')).toHaveCount(0);
  await expect(page.locator('.attendance-summary')).toContainText('1 筆姓名');
  await names.fill('😀甲乙😀');
  await page.evaluate(() => navigator.clipboard.writeText('新名'));
  await names.focus();
  await names.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(2, 4));
  await names.press('ControlOrMeta+V');
  await expect(names).toHaveValue('😀新名😀');
  await expect(page.locator('.attendance-table tbody tr').first()).toHaveText('1😀新名😀');
});

test('confirmations, internal navigation and reload respect the temporary draft boundary', async ({
  page,
}) => {
  await fillEvent(page);
  const names = page.getByLabel('姓名名單（選填）', { exact: true });
  await names.fill('合成測試名單');
  for (const action of ['載入範例', '清空']) {
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(names).toHaveValue('合成測試名單');
  }
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('簽到');
  await page.locator('.directory-tool').filter({ hasText: '活動簽到表' }).click();
  await expect(page).toHaveURL(/\/invoice\/attendance-sheet\/$/);
  await expect(names).toHaveValue('合成測試名單');
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    '合成測試名單',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(names).toHaveValue('林小青\n陳文宇\n林小青\n王庭安');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(names).toHaveValue('');
  await expect(page.getByLabel('活動名稱 *', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('總列數 *', { exact: true })).toHaveValue('20');
  await names.fill('合成測試名單');
  await page.reload();
  await expect(names).toHaveValue('');
});

test('a failed page PNG restores controls and a subsequent real download succeeds', async ({
  page,
}, info) => {
  await fillEvent(page);
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    let failed = false;
    HTMLAnchorElement.prototype.click = function () {
      if (!failed && this.download.startsWith('活動簽到表')) {
        failed = true;
        throw new Error('Simulated attendance download failure');
      }
      original.call(this);
    };
  });
  const downloadButton = page.getByRole('button', { name: '下載第 1 頁 PNG', exact: true });
  await downloadButton.click();
  await expect(page.locator('.attendance-output-controls > [role="status"]')).toContainText(
    '圖片製作失敗',
  );
  await expect(downloadButton).toBeEnabled();
  await expect(page.getByRole('button', { name: '列印全部／另存 PDF', exact: true })).toBeEnabled();
  await expect(page.locator('body > .export-surface')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await downloadButton.click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  await download.saveAs(info.outputPath('attendance-recovered.png'));
});
