import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const input = '原圖.JPG\n報告.final.pdf\n.env';
const names = '交件_009.JPG\n交件_010.pdf\n交件_011\n';
const report =
  '原檔名\t新檔名\n原圖.JPG\t交件_009.JPG\n報告.final.pdf\t交件_010.pdf\n.env\t交件_011\n';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('filename-plan/');
  await expect(page).toHaveTitle(/批次檔名規劃器/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('批次檔名規劃器');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ordered rename plan matches both actual clipboards and the full UTF-8 TXT', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(page.getByRole('button', { name: '複製新檔名清單', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('filename-plan-initial.png'), fullPage: false });
  await page.getByLabel('原始檔名', { exact: true }).fill(input);
  await page.getByLabel('檔名前綴', { exact: true }).fill('交件_');
  await page.getByLabel('起始編號', { exact: true }).fill('9');
  await page.getByRole('combobox', { name: '編號位數', exact: true }).selectOption('3');
  await expect(page.locator('.filename-plan-table tbody tr')).toHaveCount(3);
  await expect(page.locator('#filename-plan-names')).toHaveValue(names);
  await expect(page.locator('#filename-plan-report')).toHaveValue(report);
  for (const [label, expected] of [
    ['複製新檔名清單', names],
    ['複製完整對照表', report],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(
      page.getByRole('button', { name: label, exact: true }).locator('..').getByRole('status'),
    ).toHaveText('已複製。');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 TXT 對照表', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  const file = info.outputPath('filename-plan.txt');
  await download.saveAs(file);
  expect(await readFile(file)).toEqual(Buffer.from(report, 'utf8'));
  await page.screenshot({ path: info.outputPath('filename-plan-result.png'), fullPage: true });
  await page.getByLabel('保留最後副檔名', { exact: true }).uncheck();
  await expect(page.locator('#filename-plan-names')).toHaveValue('交件_009\n交件_010\n交件_011\n');
  await expect(page.locator('.filename-plan-results .copy-action [role="status"]')).toHaveText([
    '',
    '',
  ]);
  await expect(page.locator('.filename-plan-download-status')).toHaveText('');
});

test('invalid lines and settings stop output while preserving the exact input', async ({
  page,
}, info) => {
  const source = page.getByLabel('原始檔名', { exact: true });
  await source.fill('正常.pdf\nCON.txt\nfolder/file.jpg');
  await expect(source).toHaveValue('正常.pdf\nCON.txt\nfolder/file.jpg');
  await expect(page.locator('#filename-plan-errors')).toContainText('2');
  await expect(page.locator('#filename-plan-errors')).toContainText('3');
  await expect(page.getByRole('button', { name: '複製完整對照表', exact: true })).toBeDisabled();
  await expect(page.locator('#filename-plan-report')).toHaveValue('');
  await page.screenshot({ path: info.outputPath('filename-plan-errors.png'), fullPage: true });
  await source.fill('É.pdf\ne\u0301.PDF');
  await expect(page.locator('#filename-plan-errors')).toContainText('重複');
  await source.fill('first.pdf\nsecond.pdf');
  await page.getByLabel('起始編號', { exact: true }).fill('999999');
  await expect(page.getByRole('button', { name: '下載 TXT 對照表', exact: true })).toBeDisabled();
  await page.getByLabel('起始編號', { exact: true }).fill('1');
  await expect(page.getByRole('button', { name: '下載 TXT 對照表', exact: true })).toBeEnabled();
  await page.getByLabel('檔名前綴', { exact: true }).fill('錯/');
  await expect(page.getByRole('button', { name: '下載 TXT 對照表', exact: true })).toBeDisabled();
  await page.getByLabel('檔名前綴', { exact: true }).fill('修正_');
  await expect(page.getByRole('button', { name: '下載 TXT 對照表', exact: true })).toBeEnabled();
});

test('pagination never truncates exports and raw row limits stop the whole plan', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const raw = Array.from({ length: 1000 }, (_, index) => `附件${index + 1}.pdf`).join('\n');
  const source = page.getByLabel('原始檔名', { exact: true });
  await source.fill(raw);
  await expect(page.locator('.filename-plan-table tbody tr')).toHaveCount(100);
  const firstReport = await page.locator('#filename-plan-report').inputValue();
  expect(firstReport.split('\n')).toHaveLength(1002);
  expect(firstReport).toContain('附件1000.pdf\t');
  await page.getByRole('button', { name: /下一頁/ }).click();
  await expect(page.locator('.filename-plan-table tbody tr').first()).toContainText('附件101.pdf');
  await expect(page.locator('#filename-plan-report')).toHaveValue(firstReport);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 TXT 對照表', exact: true }).click();
  const download = await pending;
  const file = info.outputPath('filename-plan-1000.txt');
  await download.saveAs(file);
  expect(await readFile(file, 'utf8')).toBe(firstReport);
  // Real clipboard paste avoids Playwright's per-character fill cost for long CJK strings.
  await page.evaluate((value) => navigator.clipboard.writeText(value), `${raw}\n`);
  await source.focus();
  await source.press('ControlOrMeta+A');
  await source.press('ControlOrMeta+V');
  await expect(source).toHaveValue(`${raw}\n`);
  await expect(page.locator('#filename-plan-errors')).toContainText('1,000');
  await expect(page.getByRole('button', { name: '複製新檔名清單', exact: true })).toBeDisabled();
  await expect(page.locator('#filename-plan-report')).toHaveValue('');
});

test('confirmation and navigation preserve current work but reload clears it', async ({
  page,
}, info) => {
  const source = page.getByLabel('原始檔名', { exact: true });
  await source.fill('合成測試原檔.txt');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(source).toHaveValue('合成測試原檔.txt');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(source).not.toHaveValue('合成測試原檔.txt');
  await page.screenshot({ path: info.outputPath('filename-plan-sample.png'), fullPage: true });
  await source.fill('合成測試原檔.txt');
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('檔名');
  await page.locator('.directory-tool').filter({ hasText: '批次檔名規劃器' }).click();
  await expect(page).toHaveURL(/\/invoice\/filename-plan\/$/);
  await expect(source).toHaveValue('合成測試原檔.txt');
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    '合成測試原檔.txt',
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(source).toHaveValue('合成測試原檔.txt');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(source).toHaveValue('');
  await expect(page.getByLabel('起始編號', { exact: true })).toHaveValue('1');
  await source.fill('合成測試原檔.txt');
  await page.reload();
  await expect(source).toHaveValue('');
});

test('rename-order warnings and long Unicode names remain readable without changing raw text', async ({
  page,
}, info) => {
  await page.getByLabel('原始檔名', { exact: true }).fill('002.pdf\n001.pdf\n\n  leading name.txt');
  await expect(page.locator('.filename-plan-warnings')).toContainText('更名順序可能衝突');
  await expect(page.locator('.filename-plan-table tbody tr')).toHaveCount(3);
  await expect(page.locator('#filename-plan-report')).toHaveValue(
    '原檔名\t新檔名\n002.pdf\t001.pdf\n001.pdf\t002.pdf\n  leading name.txt\t003.txt\n',
  );
  await page.screenshot({ path: info.outputPath('filename-plan-conflict.png'), fullPage: true });
  const longName = `${'龍😀'.repeat(95)}.txt`;
  await page.getByLabel('原始檔名', { exact: true }).fill(longName);
  await page.getByLabel('檔名前綴', { exact: true }).fill('交件😀');
  await expect(page.locator('.filename-plan-table tbody tr')).toHaveCount(1);
  await expect(page.locator('#filename-plan-report')).toHaveValue(
    `原檔名\t新檔名\n${longName}\t交件😀001.txt\n`,
  );
  await page.screenshot({ path: info.outputPath('filename-plan-unicode.png'), fullPage: true });
});
