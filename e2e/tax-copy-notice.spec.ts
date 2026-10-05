import { test, expect, type Page } from '@playwright/test';

type PendingCopy = { text: string; resolve: () => void; reject: () => void };
type CopyWindow = Window & { pendingCopies: PendingCopy[] };

async function finishCopy(page: Page, requestIndex: number, requestSuccess: boolean) {
  await page.evaluate(
    ({ index, success }) => {
      const request = (window as CopyWindow).pendingCopies[index];
      if (success) request.resolve();
      else request.reject();
    },
    { index: requestIndex, success: requestSuccess },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as CopyWindow;
    state.pendingCopies = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) =>
          new Promise<void>((resolve, reject) => {
            state.pendingCopies.push({ text, resolve, reject: () => reject(new Error('Denied')) });
          }),
      },
      configurable: true,
    });
  });
  await page.goto('tax/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('稅額試算');
});

test('editing any tax input or loading the sample invalidates pending copy feedback', async ({
  page,
}, info) => {
  const amount = page.getByRole('textbox', { name: '含稅金額', exact: true });
  const copy = page.getByRole('button', { name: '複製結果', exact: true });
  const notice = page.locator('.secondary-workspace:visible .action-status[role="status"]');
  await amount.fill('1050');
  await copy.click();
  expect(await page.evaluate(() => (window as CopyWindow).pendingCopies[0].text)).toContain(
    '總計：1050',
  );
  await amount.fill('2100');
  await finishCopy(page, 0, true);
  await expect(notice).toHaveText('');
  await expect(page.locator('.equation-total strong')).toHaveText('2,100');

  await copy.click();
  await page.getByRole('radio', { name: '未稅輸入', exact: true }).check();
  await finishCopy(page, 1, false);
  await expect(notice).toHaveText('');

  await copy.click();
  await page.getByRole('combobox', { name: '課稅別', exact: true }).selectOption('exempt');
  await finishCopy(page, 2, true);
  await expect(notice).toHaveText('');

  await copy.click();
  await page.getByRole('button', { name: '試算 1,050 元範例' }).click();
  await finishCopy(page, 3, false);
  await expect(notice).toHaveText('已帶入 1,050 元範例。');
  // Loading the same sample also invalidates a pending request, even without a value change.
  await copy.click();
  await page.getByRole('button', { name: '試算 1,050 元範例' }).click();
  await finishCopy(page, 4, true);
  await expect(notice).toHaveText('已帶入 1,050 元範例。');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('tax-copy-notice.png'), fullPage: true });
});

test('only the latest copy request may report success or failure', async ({ page }) => {
  await page.getByRole('textbox', { name: '含稅金額', exact: true }).fill('1050');
  const copy = page.getByRole('button', { name: '複製結果', exact: true });
  const notice = page.locator('.secondary-workspace:visible .action-status[role="status"]');
  await copy.click();
  await copy.click();
  await finishCopy(page, 1, true);
  await expect(notice).toHaveText('已複製試算結果。');
  await finishCopy(page, 0, false);
  await expect(notice).toHaveText('已複製試算結果。');
  await copy.click();
  await expect(notice).toHaveText('');
  await finishCopy(page, 2, false);
  await expect(notice).toHaveText('瀏覽器未允許複製，請允許剪貼簿存取後重試。');
  await copy.click();
  await expect(notice).toHaveText('');
  await finishCopy(page, 3, true);
  await expect(notice).toHaveText('已複製試算結果。');
});
