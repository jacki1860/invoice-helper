import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openTool(page: Page, id: 'calendar' | 'workdays') {
  await page
    .getByRole('navigation', { name: '行政工具' })
    .getByRole('link', { name: '全部工具', exact: true })
    .click();
  await page.locator(`.directory-tool[href="/invoice/${id}/"]`).click();
}

async function setRange(page: Page, start: string, end: string) {
  await page.getByLabel('區間開始日期', { exact: true }).fill(start);
  await page.getByLabel('區間結束日期', { exact: true }).fill(end);
}

async function expectCustomRules(page: Page) {
  await expect(page.getByRole('combobox', { name: '日曆規則', exact: true })).toHaveValue('custom');
  await expect(page.getByLabel('週一', { exact: true })).toBeChecked();
  await expect(page.getByLabel('週日', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('週六', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('排除政府日曆的節日原日期', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('一併排除政府機關補假', { exact: true })).toBeChecked();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-09T04:00:00+08:00'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keyboard date buttons transfer a cross-month range only after confirmation', async ({
  page,
}, info) => {
  await page.goto('calendar/');
  await expect(page).toHaveTitle(/國定假日|行事曆/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('國定假日行事曆');
  await page.screenshot({ path: info.outputPath('calendar-initial.png'), fullPage: false });
  await page.getByLabel('選擇年份').selectOption('2026');
  await page.getByLabel('選擇月份').selectOption('9');
  const startDay = page.getByRole('button', { name: /^2026-09-30 星期/ });
  await startDay.focus();
  await page.keyboard.press('Enter');
  await expect(startDay).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('區間開始日期')).toHaveValue('2026-09-30');
  await page.getByRole('button', { name: '下一個月', exact: true }).click();
  const endDay = page.getByRole('button', { name: /^2026-10-02 星期/ });
  await page.getByRole('button', { name: /^2026-10-01 星期/ }).focus();
  await page.keyboard.press('Tab');
  await expect(endDay).toBeFocused();
  await page.keyboard.press('Space');
  await expect(endDay).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^2026-10-01 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('區間結束日期')).toHaveValue('2026-10-02');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('calendar-selected.png'), fullPage: true });
  await page.locator('.calendar-range').screenshot({ path: info.outputPath('calendar-range.png') });
  await page.locator('.calendar-panel').screenshot({ path: info.outputPath('calendar-month.png') });
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/invoice\/workdays\/$/);
  const pending = page.getByRole('region', { name: '待套用的年曆日期區間' });
  await expect(pending).toContainText('2026-09-30 至 2026-10-02');
  await expect(pending).toContainText('保留目前規則：政府辦公日曆');
  await expect(page.getByLabel('起始日期', { exact: true })).not.toHaveValue('2026-09-30');
  await page.getByRole('button', { name: '套用日期區間', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(pending).not.toBeVisible();
  await expect(page.getByRole('button', { name: '計算區間', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveValue('2026-09-30');
  await expect(page.getByLabel('結束日期', { exact: true })).toHaveValue('2026-10-02');
  await expect(page.getByLabel('包含開始日（結束日固定包含）', { exact: true })).toBeChecked();
  await expect(
    page.getByRole('region', { name: '工作天計算結果' }).locator('.result-number'),
  ).toHaveText('3個工作天');
  await page.screenshot({ path: info.outputPath('workdays-accepted.png'), fullPage: true });
});

test('declining preserves the original mode, dates and preferences; accepting keeps custom rules', async ({
  page,
}) => {
  await page.goto('workdays/');
  await page.getByLabel('起始日期', { exact: true }).fill('2026-02-14');
  await page.getByLabel('結束日期', { exact: true }).fill('2026-02-23');
  await page.getByLabel('包含開始日（結束日固定包含）', { exact: true }).uncheck();
  await page.getByRole('combobox', { name: '日曆規則', exact: true }).selectOption('custom');
  await page.getByLabel('週一', { exact: true }).check();
  await page.getByLabel('週日', { exact: true }).uncheck();
  await page.getByLabel('週六', { exact: true }).uncheck();
  await page.getByLabel('排除政府日曆的節日原日期', { exact: true }).uncheck();
  await page.getByLabel('一併排除政府機關補假', { exact: true }).check();
  await page.getByRole('button', { name: '推算交期', exact: true }).click();
  await page.getByLabel('起始日期', { exact: true }).fill('2026-09-29');
  await page.getByLabel('工作天數', { exact: true }).fill('7');
  await page.getByRole('combobox', { name: '推算方向', exact: true }).selectOption('backward');
  await openTool(page, 'calendar');
  await setRange(page, '2026-10-01', '2026-10-04');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  const pending = page.getByRole('region', { name: '待套用的年曆日期區間' });
  await expect(pending).toContainText('自訂工作週，休息日：週一');
  await expect(pending).toContainText('排除政府節日原日期：否；排除政府補假：是');
  await expect(page.getByRole('button', { name: '推算交期', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveValue('2026-09-29');
  await page.getByRole('button', { name: '暫不套用', exact: true }).click();
  await expect(pending).not.toBeVisible();
  await expect(page.getByRole('button', { name: '推算交期', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveValue('2026-09-29');
  await expect(page.getByLabel('工作天數', { exact: true })).toHaveValue('7');
  await expect(page.getByRole('combobox', { name: '推算方向', exact: true })).toHaveValue(
    'backward',
  );
  await expectCustomRules(page);
  await page.getByRole('button', { name: '計算區間', exact: true }).click();
  await expect(page.getByLabel('結束日期', { exact: true })).toHaveValue('2026-02-23');
  await expect(page.getByLabel('包含開始日（結束日固定包含）', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '推算交期', exact: true }).click();
  await openTool(page, 'calendar');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await page.getByRole('button', { name: '套用日期區間', exact: true }).click();
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByLabel('結束日期', { exact: true })).toHaveValue('2026-10-04');
  await expect(page.getByLabel('包含開始日（結束日固定包含）', { exact: true })).toBeChecked();
  await expectCustomRules(page);
  await expect(
    page.getByRole('region', { name: '工作天計算結果' }).locator('.result-number'),
  ).toHaveText('4個工作天');
});

test('month navigation keeps a cross-year selection and supports a same-day range', async ({
  page,
}) => {
  await page.goto('calendar/');
  await page.getByLabel('選擇年份').selectOption('2026');
  await page.getByLabel('選擇月份').selectOption('12');
  await page.getByRole('button', { name: /^2026-12-31 星期/ }).click();
  await page.getByRole('button', { name: '下一個月', exact: true }).click();
  await expect(page.getByLabel('選擇年份')).toHaveValue('2027');
  await page.getByRole('button', { name: /^2027-01-04 星期/ }).click();
  await expect(page.getByLabel('區間開始日期')).toHaveValue('2026-12-31');
  await expect(page.getByLabel('區間結束日期')).toHaveValue('2027-01-04');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await page.getByRole('button', { name: '套用日期區間', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '工作天計算結果' }).locator('.result-number'),
  ).toHaveText('2個工作天');
  await openTool(page, 'calendar');
  await page.getByRole('button', { name: '清除日期區間', exact: true }).click();
  const sameDay = page.getByRole('button', { name: /^2027-01-04 星期/ });
  await sameDay.click();
  await sameDay.click();
  await expect(sameDay).toHaveAttribute('aria-label', /開始日，結束日/);
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await page.getByRole('button', { name: '套用日期區間', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '工作天計算結果' }).locator('.result-number'),
  ).toHaveText('1個工作天');
});

test('invalid or unsupported ranges cannot leave the calendar and corrected date fields can transfer', async ({
  page,
}) => {
  await page.goto('calendar/');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await expect(page.locator('#calendar-range-error')).toHaveText(/有效的開始日期與結束日期/);
  await setRange(page, '2026-10-02', '2026-09-30');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\/$/);
  await expect(page.locator('#calendar-range-error')).toHaveText(/不可早於/);
  await setRange(page, '2025-12-31', '2026-01-01');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\/$/);
  await expect(page.locator('#calendar-range-error')).toHaveText(/已核對日曆範圍/);
  await setRange(page, '2027-12-31', '2028-01-01');
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\/$/);
  await expect(page.locator('#calendar-range-error')).toHaveText(/已核對日曆範圍/);
  await setRange(page, '2026-10-01', '2026-10-02');
  await expect(page.locator('#calendar-range-error')).toBeEmpty();
  await page.getByRole('button', { name: '帶入工作天計算', exact: true }).click();
  await expect(page).toHaveURL(/\/workdays\/$/);
});

test('range selection leaves full-year and monthly ICS contents unchanged', async ({
  page,
}, info) => {
  await page.goto('calendar/');
  await page.getByLabel('選擇年份').selectOption('2027');
  await page.getByLabel('選擇月份').selectOption('12');
  await setRange(page, '2026-12-31', '2027-01-04');
  for (const [name, filename, count] of [
    ['下載 2027 全年 ICS', 'taiwan-holidays-2027.ics', 24],
    ['下載 2027 年 12 月 ICS', 'taiwan-holidays-2027-12.ics', 3],
  ] as const) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    const file = info.outputPath(filename);
    await download.saveAs(file);
    const content = await readFile(file, 'utf8');
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(count);
    expect(content).toContain('DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101');
  }
  await expect(page.getByLabel('區間開始日期')).toHaveValue('2026-12-31');
  await expect(page.getByLabel('區間結束日期')).toHaveValue('2027-01-04');
});
