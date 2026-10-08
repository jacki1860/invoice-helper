import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const scope of ['year', 'month'] as const) {
  test(`calendar ${scope} download reports failure, clears stale status and retries real ICS`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('calendar/');
    await expect(page).toHaveTitle(/假日/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('國定假日行事曆');
    await page.getByLabel('選擇年份').selectOption('2027');
    await page.getByLabel('選擇月份').selectOption('12');
    const button = page.getByRole('button', {
      name: scope === 'year' ? '下載 2027 全年 ICS' : '下載 2027 年 12 月 ICS',
      exact: true,
    });
    const notes = page.locator('.calendar-export-note');
    const status = notes.nth(scope === 'year' ? 0 : 1);
    const range = scope === 'year' ? '2027 年' : '2027 年 12 月';
    const filename = scope === 'year' ? 'taiwan-holidays-2027.ics' : 'taiwan-holidays-2027-12.ics';
    const initial = page.waitForEvent('download');
    await button.click();
    expect(await (await initial).failure()).toBeNull();
    await expect(status).toContainText(`已產生 ${range} ICS`);

    // Fault injection only: the success and recovery downloads use the real browser APIs.
    await page.evaluate(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        URL.createObjectURL = create;
        throw new Error(`Controlled creation failure: ${blob.type}`);
      };
    });
    await button.click();
    await expect(status).toHaveText(`無法產生 ${range} ICS，請重試下載。`);
    await expect(notes.filter({ hasText: '已產生' })).toHaveCount(0);
    expect(await page.locator('a[download][href^="blob:"]').count()).toBe(0);
    await page.screenshot({ path: info.outputPath('calendar-download-error.png'), fullPage: true });

    const retry = page.waitForEvent('download');
    await button.click();
    const download = await retry;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(filename);
    const path = info.outputPath(filename);
    await download.saveAs(path);
    const content = await readFile(path, 'utf8');
    expect(content).toContain('BEGIN:VCALENDAR\r\n');
    expect(content).toContain('DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101');
    expect(content).toContain('SUMMARY:2028 年元旦補假');
    if (scope === 'year') expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(24);
    else {
      const starts = [...content.matchAll(/DTSTART;VALUE=DATE:(\d+)/g)].map((match) => match[1]);
      expect(starts.length).toBeGreaterThan(0);
      expect(starts.every((date) => date.startsWith('202712'))).toBe(true);
    }
    await expect(status).toContainText(`已產生 ${range} ICS`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath('calendar-download-recovered.png'),
      fullPage: true,
    });

    await page.getByLabel('選擇年份').selectOption('2026');
    await expect(notes.filter({ hasText: '已產生' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('calendar cleans up its temporary anchor and URL when clicking download fails', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('calendar/');
  await page.evaluate(() => {
    const click = HTMLAnchorElement.prototype.click;
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      document.documentElement.dataset.calendarRevokedUrl = url;
      revoke(url);
    };
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = click;
      document.documentElement.dataset.calendarFailedUrl = this.href;
      throw new Error('Controlled anchor failure');
    };
  });
  await page.getByRole('button', { name: /^下載 \d{4} 全年 ICS$/ }).click();
  await expect(page.locator('.calendar-export-note').first()).toContainText('請重試下載');
  expect(await page.locator('a[download][href^="blob:"]').count()).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { calendarFailedUrl, calendarRevokedUrl } = document.documentElement.dataset;
        return Boolean(
          calendarFailedUrl?.startsWith('blob:') && calendarFailedUrl === calendarRevokedUrl,
        );
      }),
    )
    .toBe(true);
  const retry = page.waitForEvent('download');
  await page.getByRole('button', { name: /^下載 \d{4} 全年 ICS$/ }).click();
  expect(await (await retry).failure()).toBeNull();
  expect(errors).toEqual([]);
});
