import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const success = 'PNG 已產生，請查看瀏覽器下載項目。';
const idleNotice = '列印視窗可選擇另存為 PDF；此文件非統一發票。';
const failure = '圖片製作失敗，請稍後重試，或使用列印／另存 PDF。';
const exportButton = (page: Page) =>
  page.getByRole('button', { name: '下載文件 PNG', exact: true });
const notice = (page: Page) =>
  page.locator('.document-editor > .action-status').filter({ visible: true });

async function holdExport(page: Page) {
  await page.evaluate(() => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const ready = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    Object.defineProperty(document.fonts, 'ready', { configurable: true, get: () => ready });
    Object.assign(window, {
      releaseQuoteExport: (fail: boolean) => {
        Reflect.deleteProperty(document.fonts, 'ready');
        if (fail) reject(new Error('Controlled font readiness failure'));
        else resolve();
      },
    });
  });
}

async function releaseExport(page: Page, fail = false) {
  await page.evaluate((shouldFail) => {
    (window as typeof window & { releaseQuoteExport: (fail: boolean) => void }).releaseQuoteExport(
      shouldFail,
    );
  }, fail);
}

async function saveExport(page: Page, info: TestInfo, filename: string) {
  const pending = page.waitForEvent('download');
  await exportButton(page).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const path = info.outputPath(filename);
  await download.saveAs(path);
  await expect(exportButton(page)).toBeEnabled();
  return { bytes: await readFile(path), filename: download.suggestedFilename() };
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as Page & { quoteErrors: string[] }).quoteErrors = errors;
  await page.goto('quote/');
  await page.getByRole('button', { name: '載入文件範例', exact: true }).click();
  await page.getByLabel('文件日期 *', { exact: true }).fill('2026-10-10');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { quoteErrors: string[] }).quoteErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('body > .export-surface')).toHaveCount(0);
});

test('editing during export keeps the clicked PNG and suppresses stale success', async ({
  page,
}, info) => {
  // Three real PNG renders and a print PDF intentionally share this end-to-end case.
  test.setTimeout(60_000);
  const original = await saveExport(page, info, 'quote-original.png');
  await expect(notice(page)).toHaveText(success);
  await holdExport(page);
  const pending = page.waitForEvent('download');
  await exportButton(page).click();
  await expect(notice(page)).toHaveText('正在製作圖片…');
  await page.getByLabel('客戶名稱 *', { exact: true }).fill('修訂客戶測試');
  await page.getByLabel('文件日期 *', { exact: true }).fill('2026-10-11');
  await page
    .getByRole('group', { name: '文件類型' })
    .getByRole('button', { name: '請款單', exact: true })
    .click();
  await releaseExport(page);
  const frozen = await pending;
  expect(frozen.suggestedFilename()).toBe('報價單_2026-10-10.png');
  const frozenPath = info.outputPath('quote-frozen.png');
  await frozen.saveAs(frozenPath);
  await expect(exportButton(page)).toBeEnabled();
  expect(await readFile(frozenPath)).toEqual(original.bytes);
  await expect(notice(page)).toHaveText(idleNotice);
  await page.screenshot({
    path: info.outputPath('quote-edited-no-stale-success.png'),
    fullPage: true,
  });
  const revised = await saveExport(page, info, 'payment-revised.png');
  expect(revised.filename).toBe('請款單_2026-10-11.png');
  expect(revised.bytes).not.toEqual(original.bytes);
  await expect(notice(page)).toHaveText(success);
  const pdf = info.outputPath('payment-revised.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  expect(text).toContain('修訂客戶測試');
  expect(text).toContain('請款單');
  expect(text).toContain('2026-10-11');
  expect(text).not.toContain('範例客戶');
});

test('current failures stay visible while edited documents ignore stale failures and can retry', async ({
  page,
}, info) => {
  await holdExport(page);
  await exportButton(page).click();
  await releaseExport(page, true);
  await expect(notice(page)).toHaveText(failure);
  await expect(exportButton(page)).toBeEnabled();
  await holdExport(page);
  await exportButton(page).click();
  await page.getByLabel('開立方 *', { exact: true }).fill('修訂工作室測試');
  await releaseExport(page, true);
  await expect(exportButton(page)).toBeEnabled();
  await expect(notice(page)).toHaveText(idleNotice);
  await page.screenshot({
    path: info.outputPath('quote-edited-no-stale-failure.png'),
    fullPage: true,
  });
  await saveExport(page, info, 'quote-recovered.png');
  await expect(notice(page)).toHaveText(success);
});

test('cancelled sample preserves export feedback and accepted sample preserves its own notice', async ({
  page,
}, info) => {
  await holdExport(page);
  const pending = page.waitForEvent('download');
  await exportButton(page).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '載入文件範例', exact: true }).click();
  await expect(notice(page)).toHaveText('正在製作圖片…');
  await releaseExport(page);
  await (await pending).saveAs(info.outputPath('quote-cancelled-sample.png'));
  await expect(exportButton(page)).toBeEnabled();
  await expect(notice(page)).toHaveText(success);
  await holdExport(page);
  await exportButton(page).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入文件範例', exact: true }).click();
  await releaseExport(page, true);
  await expect(exportButton(page)).toBeEnabled();
  await expect(notice(page)).toHaveText('已載入範例。');
});

test('logo removal and accepted tool handoff invalidate a pending export notice', async ({
  page,
}, info) => {
  await page.getByLabel('選擇 Logo 圖片', { exact: true }).setInputFiles({
    name: 'test-logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZfoAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('button', { name: '更換 Logo', exact: true })).toBeVisible();
  await expect(exportButton(page)).toBeEnabled();
  await holdExport(page);
  const pending = page.waitForEvent('download');
  await exportButton(page).click();
  await page.getByRole('button', { name: '移除 Logo', exact: true }).click();
  await releaseExport(page);
  await (await pending).saveAs(info.outputPath('quote-clicked-logo.png'));
  await expect(exportButton(page)).toBeEnabled();
  await expect(notice(page)).toHaveText(idleNotice);
  await holdExport(page);
  await exportButton(page).click();
  await page
    .getByRole('navigation', { name: '行政工具' })
    .getByRole('link', { name: '全部工具', exact: true })
    .click();
  await page.locator('.directory-tool[href="/invoice/profit/"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入文件範例', exact: true }).click();
  await page.getByRole('button', { name: '以售價建立報價單', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '確認帶入文件', exact: true }).click();
  await releaseExport(page, true);
  // The new handoff intentionally leaves parties blank, so fill them before retrying.
  await expect(notice(page)).toHaveText('已帶入品項，請確認開立方、客戶與新文件資料。');
  await expect(page.getByLabel('開立方 *', { exact: true })).toHaveValue('');
  await page.getByLabel('開立方 *', { exact: true }).fill('帶入工作室測試');
  await page.getByLabel('客戶名稱 *', { exact: true }).fill('帶入客戶測試');
  await expect(exportButton(page)).toBeEnabled();
  await saveExport(page, info, 'quote-handoff-recovered.png');
  await expect(notice(page)).toHaveText(success);
});
