import { test, expect } from '@playwright/test';

test('tax examples show the matching input mode, formula and whole-dollar results', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('tax/');
  await expect(page).toHaveTitle('含稅未稅計算機：5% 稅額與換算公式｜小事務');
  await expect(page.getByRole('heading', { name: '稅額試算', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '試算未稅 1,000 元範例', exact: true }).click();
  await expect(page.getByRole('radio', { name: '未稅輸入', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: '未稅金額', exact: true })).toHaveValue('1000');
  await expect(
    page.locator('.equation-row').filter({ hasText: '銷售額' }).locator('strong'),
  ).toHaveText('1,000');
  await expect(
    page.locator('.equation-row').filter({ hasText: '稅額' }).locator('strong'),
  ).toHaveText('50');
  await expect(page.locator('.equation-total strong')).toHaveText('1,050');
  await expect(page.locator('.calculation-explanation')).toContainText('未稅銷售額 × 5%');
  await page.getByRole('button', { name: '試算 1,050 元範例', exact: true }).click();
  await expect(page.getByRole('radio', { name: '含稅輸入', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: '含稅金額', exact: true })).toHaveValue('1050');
  await expect(page.locator('.equation-total strong')).toHaveText('1,050');
  await expect(page.locator('.calculation-explanation')).toContainText('含稅總額 × 5 ÷ 105');
  await expect(page.locator('.page-guide')).toContainText('含稅 31 元拆成銷售額 30 元、稅額 1 元');
  await page.getByRole('textbox', { name: '含稅金額', exact: true }).fill('31');
  await expect(page.locator('.equation-total strong')).toHaveText('31');
  await expect(
    page.locator('.equation-row').filter({ hasText: '銷售額' }).locator('strong'),
  ).toHaveText('30');
  await expect(
    page.locator('.equation-row').filter({ hasText: '稅額' }).locator('strong'),
  ).toHaveText('1');
  await page.getByRole('radio', { name: '未稅輸入', exact: true }).check();
  await expect(page.getByRole('textbox', { name: '未稅金額', exact: true })).toHaveValue('31');
  await page.getByRole('textbox', { name: '未稅金額', exact: true }).fill('30');
  await expect(page.locator('.equation-total strong')).toHaveText('32');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('tax-intent.png'), fullPage: false });
});

test('tax and workday search guidance remains visible with JavaScript disabled', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    const base = String(info.project.use.baseURL);
    await page.goto(new URL('tax/', base).href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '含稅未稅計算機：5% 稅額與換算公式',
    );
    await expect(page.locator('.page-guide')).toContainText('未稅 1,000 元');
    await expect(page.locator('.page-guide')).toContainText('總額變成 32 元');
    await page.goto(new URL('workdays/', base).href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '工作天計算機：日期區間、交期與倒推',
    );
    await expect(page.locator('.page-guide')).toContainText('2026/10/13');
    await expect(page.locator('.page-guide')).toContainText('2026/10/6');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('workdays-guide-no-js.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
