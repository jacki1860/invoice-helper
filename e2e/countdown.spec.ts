import { test, expect, type Page } from '@playwright/test';

const clockTime = new Date('2026-10-10T01:00:00Z');
const tool = (page: Page) => page.locator('.countdown-tool');
const display = (page: Page) => page.locator('#countdown-clock');
const status = (page: Page) => page.locator('.countdown-status');
const action = (page: Page, name: string) => tool(page).getByRole('button', { name, exact: true });

async function configure(page: Page, seconds: string, name = '提案討論') {
  await page.getByLabel('本次名稱（選填）', { exact: true }).fill(name);
  await page.getByLabel('分鐘', { exact: true }).fill('0');
  await page.getByLabel('秒數', { exact: true }).fill(seconds);
}

async function freezeClock(page: Page) {
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(new Date(clockTime.getTime() + 1000));
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('countdown/');
  await expect(page).toHaveTitle(/工作與會議倒數/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('工作與會議倒數');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('real two-second countdown finishes and the native clipboard matches its complete summary', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(display(page)).toHaveText('00:25:00');
  await expect(action(page, '複製當次摘要')).toBeDisabled();
  await configure(page, '2', '兩秒實際倒數');
  await page.screenshot({ path: info.outputPath('countdown-ready.png'), fullPage: true });
  await action(page, '開始倒數').click();
  await expect(status(page)).toHaveText('倒數進行中');
  await expect(status(page)).toHaveText('時間到', { timeout: 6000 });
  await expect(display(page)).toHaveText('00:00:00');
  await page.screenshot({ path: info.outputPath('countdown-finished.png'), fullPage: true });
  await action(page, '複製當次摘要').click();
  const expected =
    '工作與會議倒數\n名稱：兩秒實際倒數\n設定時間：00:00:02\n狀態：時間到\n剩餘時間：00:00:00';
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(tool(page).locator('.copy-action [role="status"]')).toHaveText('已複製。');
  await tool(page).getByText('查看可選取的摘要', { exact: true }).click();
  await expect(page.getByLabel('當次倒數摘要')).toHaveValue(expected);
  await action(page, '重設倒數').click();
  await expect(status(page)).toHaveText('準備開始');
  await expect(display(page)).toHaveText('00:00:02');
  await expect(action(page, '開始倒數')).toBeEnabled();
});

test('presets, keyboard start, pause, resume and reset preserve the configured duration', async ({
  page,
}, info) => {
  await freezeClock(page);
  for (const minutes of [5, 15, 25]) {
    await action(page, `${minutes} 分鐘`).click();
    await expect(page.getByLabel('分鐘', { exact: true })).toHaveValue(String(minutes));
    await expect(page.getByLabel('秒數', { exact: true })).toHaveValue('0');
  }
  await configure(page, '15');
  await action(page, '開始倒數').focus();
  await action(page, '開始倒數').press('Enter');
  await expect(page.getByLabel('本次名稱（選填）', { exact: true })).toBeDisabled();
  await expect(action(page, '5 分鐘')).toBeDisabled();
  await expect(action(page, '暫停')).toBeFocused();
  await page.clock.runFor(3200);
  await expect(display(page)).toHaveText('00:00:12');
  await action(page, '暫停').press('Space');
  await expect(action(page, '繼續倒數')).toBeFocused();
  await expect(status(page)).toHaveText('已暫停');
  await page.clock.runFor(8000);
  await expect(display(page)).toHaveText('00:00:12');
  await page.screenshot({ path: info.outputPath('countdown-paused.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await action(page, '重設倒數').click();
  await expect(status(page)).toHaveText('已暫停');
  await action(page, '繼續倒數').click();
  await page.clock.runFor(11_799);
  await expect(status(page)).toHaveText('倒數進行中');
  await page.clock.runFor(251);
  await expect(status(page)).toHaveText('時間到');
  await action(page, '重設倒數').click();
  await expect(display(page)).toHaveText('00:00:15');
  await action(page, '開始倒數').click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await action(page, '重設倒數').click();
  await expect(status(page)).toHaveText('倒數進行中');
  page.once('dialog', (dialog) => dialog.accept());
  await action(page, '重設倒數').click();
  await expect(display(page)).toHaveText('00:00:15');
  await expect(status(page)).toHaveText('準備開始');
  await page.clock.runFor(30_000);
  await expect(display(page)).toHaveText('00:00:15');
});

test('invalid settings and long Unicode names retain raw input and block starting', async ({
  page,
}, info) => {
  for (const [minutes, seconds] of [
    ['0', '0'],
    ['1440', '1'],
    ['1441', '0'],
    ['1.5', '0'],
    ['-1', '0'],
    ['', '0'],
    ['0', '60'],
    ['0', '1e1'],
  ]) {
    await page.getByLabel('分鐘', { exact: true }).fill(minutes);
    await page.getByLabel('秒數', { exact: true }).fill(seconds);
    await expect(page.getByLabel('分鐘', { exact: true })).toHaveValue(minutes);
    await expect(page.getByLabel('秒數', { exact: true })).toHaveValue(seconds);
    await expect(action(page, '開始倒數')).toBeDisabled();
    await expect(page.locator('#countdown-errors')).toBeVisible();
  }
  await configure(page, '1', '😀'.repeat(61));
  await expect(page.getByLabel('本次名稱（選填）', { exact: true })).toHaveValue('😀'.repeat(61));
  await expect(action(page, '開始倒數')).toBeDisabled();
  await page.screenshot({ path: info.outputPath('countdown-invalid.png'), fullPage: true });
  await page.getByLabel('本次名稱（選填）', { exact: true }).fill('😀'.repeat(60));
  await expect(action(page, '開始倒數')).toBeEnabled();
  await page.getByLabel('本次名稱（選填）', { exact: true }).fill('line1\nline2');
  await expect(action(page, '開始倒數')).toBeDisabled();
  await configure(page, '0', '😀'.repeat(60));
  await page.getByLabel('分鐘', { exact: true }).fill('1440');
  await expect(display(page)).toHaveText('24:00:00');
  await action(page, '開始倒數').click();
  await expect(status(page)).toHaveText('倒數進行中');
  await expect(page.locator('#countdown-display-heading')).toHaveText('😀'.repeat(60));
  await page.screenshot({ path: info.outputPath('countdown-max-name.png'), fullPage: true });
});

test('entry, search, task navigation and reload follow the memory-only run lifecycle', async ({
  page,
}) => {
  await freezeClock(page);
  await page.getByRole('link', { name: '依事情找工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('倒數計時');
  await page.locator('.directory-tool').filter({ hasText: '工作與會議倒數' }).click();
  await expect(page).toHaveURL(/\/invoice\/countdown\/$/);
  await configure(page, '15', '合成會議名稱');
  await action(page, '開始倒數').click();
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.clock.runFor(5000);
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('timer');
  await page.locator('.directory-tool').filter({ hasText: '工作與會議倒數' }).click();
  await expect(display(page)).toHaveText('00:00:10');
  await expect(status(page)).toHaveText('倒數進行中');
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    '合成會議名稱',
  );
  await page.reload();
  await expect(status(page)).toHaveText('準備開始');
  await expect(display(page)).toHaveText('00:25:00');
  await expect(page.getByLabel('本次名稱（選填）', { exact: true })).toHaveValue('');
  await page.goto('task/reference/');
  await expect(page.locator('.directory-tool').filter({ hasText: '工作與會議倒數' })).toBeVisible();
  await page.goto('category/conversions/');
  await expect(page.locator('.directory-tool').filter({ hasText: '工作與會議倒數' })).toBeVisible();
});

test('late ticks and simulated foreground recovery correct from system time without overcounting', async ({
  page,
}) => {
  await freezeClock(page);
  await configure(page, '15');
  await action(page, '開始倒數').click();
  const startedAt = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(startedAt + 6000);
  // No timer callbacks run with setSystemTime: foreground events must recalculate independently.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(display(page)).toHaveText('00:00:09');
  await page.clock.setSystemTime(startedAt - 5000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(display(page)).toHaveText('00:00:15');
  await page.clock.setSystemTime(startedAt + 30_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(status(page)).toHaveText('時間到');
  await expect(display(page)).toHaveText('00:00:00');
  await action(page, '重設倒數').click();
  await action(page, '開始倒數').click();
  await page.clock.fastForward(60_000);
  await expect(status(page)).toHaveText('時間到');
  await expect(display(page)).toHaveText('00:00:00');
});

test('old clipboard completions cannot announce success after reset or during another run', async ({
  page,
}) => {
  await freezeClock(page);
  await configure(page, '10');
  await action(page, '開始倒數').click();
  await action(page, '暫停').click();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () =>
        new Promise<void>((resolve) => {
          (window as typeof window & { finishCopy?: () => void }).finishCopy = resolve;
        }),
    });
  });
  await action(page, '複製當次摘要').click();
  page.once('dialog', (dialog) => dialog.accept());
  await action(page, '重設倒數').click();
  await configure(page, '20', '下一輪');
  await action(page, '開始倒數').click();
  await action(page, '暫停').click();
  await page.evaluate(() => (window as typeof window & { finishCopy?: () => void }).finishCopy?.());
  await expect(tool(page).locator('.copy-action [role="status"]')).toHaveText('');
  await expect(display(page)).toHaveText('00:00:20');
  await expect(page.locator('#countdown-display-heading')).toHaveText('下一輪');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('controlled clipboard failure')),
    });
  });
  await action(page, '複製當次摘要').click();
  await expect(tool(page).locator('.copy-action [role="status"]')).toContainText('無法存取剪貼簿');
  await tool(page).getByText('查看可選取的摘要', { exact: true }).click();
  await expect(page.getByLabel('當次倒數摘要')).toHaveValue(/名稱：下一輪/);
});
