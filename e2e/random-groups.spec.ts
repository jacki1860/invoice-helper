import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const names = (count: number) =>
  Array.from({ length: count }, (_, index) => `測試參與者 ${index + 1}`);

async function verifyResult(page: Page, people: string[], groupCount: number) {
  const cards = page.locator('.random-groups-card');
  await expect(cards).toHaveCount(groupCount);
  const groups = await cards.evaluateAll((sections) =>
    sections.map((section) =>
      [...section.querySelectorAll('li')].map((member) => member.textContent!),
    ),
  );
  expect(groups.flat().toSorted()).toEqual(people.toSorted());
  expect(new Set(groups.flat()).size).toBe(people.length);
  const sizes = groups.map((group) => group.length);
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  expect(Math.min(...sizes)).toBeGreaterThan(0);
  const report =
    `隨機分組結果（共 ${people.length} 人，${groupCount} 組）\n\n` +
    groups
      .map(
        (group, index) =>
          `第 ${index + 1} 組（${group.length} 人）\n${group.map((name) => `- ${name}`).join('\n')}`,
      )
      .join('\n\n') +
    '\n';
  await expect(page.locator('#random-groups-report')).toHaveValue(report);
  return report;
}

async function verifyExport(page: Page, report: string, info: TestInfo, suffix = '') {
  await page.getByRole('button', { name: '複製完整分組', exact: true }).click();
  await expect(page.locator('.random-groups .copy-action [role="status"]')).toHaveText('已複製。');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(report);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載分組 TXT', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('隨機分組結果.txt');
  const file = info.outputPath(`random-groups${suffix}.txt`);
  await download.saveAs(file);
  expect(await readFile(file)).toEqual(Buffer.from(report, 'utf8'));
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  (page as Page & { appErrors: string[] }).appErrors = errors;
  await page.goto('random-groups/');
  await expect(page).toHaveTitle(/隨機分組器/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('隨機分組器');
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { appErrors: string[] }).appErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('explicit grouping produces a stable, balanced complete result and real clipboard/TXT', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(page.getByRole('button', { name: '產生分組', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '複製完整分組', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('random-groups-initial.png') });
  const people = ['小安', 'Cafe\u0301', '😀', 'Alice Smith', 'alice smith', '小岑', '阿哲'];
  await page.getByLabel('參與者名單', { exact: true }).fill(` ${people.join(' \n ')} \n\n`);
  await page.getByLabel('組數', { exact: true }).fill('3');
  await expect(page.locator('.random-groups-card')).toHaveCount(0);
  await expect(page.locator('.random-groups-summary')).toContainText('7 人已就緒，略過 2 個空白行');
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  const report = await verifyResult(page, people, 3);
  await verifyExport(page, report, info);
  await page.screenshot({ path: info.outputPath('random-groups-result.png'), fullPage: true });
  await page.locator('.random-groups').getByText('查看可選取的完整文字', { exact: true }).click();
  await expect(page.locator('#random-groups-report')).toHaveValue(report);
  await page.getByRole('button', { name: '重新分組', exact: true }).click();
  await expect(page.locator('.random-groups-summary')).toContainText('第 2 次分組');
  await verifyResult(page, people, 3); // Repeated random draws may produce identical groups.
  await expect(page.locator('.random-groups .copy-action [role="status"]')).toHaveText('');
  await expect(page.locator('.random-groups-download-status')).toHaveText('');
  await page.getByLabel('組數', { exact: true }).fill('2');
  await expect(page.locator('.random-groups-card')).toHaveCount(0);
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await expect(page.getByRole('button', { name: '下載分組 TXT', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyExport(page, await verifyResult(page, people, 2), info, '-changed-count');
  await page.getByLabel('參與者名單', { exact: true }).fill(people.slice(0, 2).join('\n'));
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await expect(page.locator('.random-groups .copy-action [role="status"]')).toHaveText('');
  await expect(page.locator('.random-groups-download-status')).toHaveText('');
});

test('all 500 participants appear once across 100 groups and export without truncation', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const people = names(500);
  people[499] = '😀'.repeat(80);
  await page.evaluate((text) => navigator.clipboard.writeText(text), people.join('\n'));
  await page.getByLabel('參與者名單', { exact: true }).press('ControlOrMeta+V');
  await page.getByLabel('組數', { exact: true }).fill('100');
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyExport(page, await verifyResult(page, people, 100), info, '-500');
  await page.getByLabel('參與者名單', { exact: true }).fill([...people, '第 501 人'].join('\n'));
  await expect(page.locator('#random-groups-errors')).toContainText('2–500');
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await expect(page.getByRole('button', { name: '產生分組', exact: true })).toBeDisabled();
});

test('duplicates, controls and limits preserve raw input and stop the whole result', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const input = page.getByLabel('參與者名單', { exact: true });
  const cases: [string, string][] = [
    ['甲\n\n Café \n乙\nCafe\u0301', '第 5 行：與第 3 行'],
    ['甲\n\t\n乙', '第 2 行：不可含控制字元'],
    [`${'😀'.repeat(81)}\n乙`, '80 個 Unicode'],
    [`甲\n乙${' '.repeat(99_998)}`, '100,000'],
  ];
  for (const [raw, error] of cases) {
    await input.fill(raw);
    await expect(input).toHaveValue(raw);
    await expect(page.locator('#random-groups-errors')).toContainText(error);
    await expect(page.getByRole('button', { name: '產生分組', exact: true })).toBeDisabled();
    await expect(page.locator('#random-groups-report')).toHaveValue('');
  }
  for (const raw of ['A\n'.repeat(999) + 'A', '\t\n'.repeat(999) + '\t']) {
    // Exercise consecutive native replacement at the complete 1,000-line input limit.
    await page.evaluate((text) => navigator.clipboard.writeText(text), raw);
    await input.press('ControlOrMeta+A');
    await input.press('ControlOrMeta+V');
    await expect(input).toHaveValue(raw);
    await expect(page.locator('#random-groups-errors li')).toHaveCount(20);
    await expect(page.locator('#random-groups-errors')).toContainText('項輸入問題未逐一列出');
    await expect(page.getByRole('button', { name: '產生分組', exact: true })).toBeDisabled();
  }
  await input.fill('甲\n乙');
  await page.getByLabel('組數', { exact: true }).fill('3');
  await expect(page.locator('#random-groups-errors')).toContainText('組數不可超過');
  await page.getByLabel('組數', { exact: true }).fill('2.0');
  await expect(page.locator('#random-groups-errors')).toContainText('整數');
  await page.screenshot({ path: info.outputPath('random-groups-errors.png'), fullPage: true });
  await page.getByLabel('組數', { exact: true }).fill('2');
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyResult(page, ['甲', '乙'], 2);
});

test('excessive native paste is rejected as a whole, preserves the draft and recovers', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const input = page.getByLabel('參與者名單', { exact: true });
  const original = '甲\n乙';
  await input.fill(original);
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyExport(
    page,
    await verifyResult(page, ['甲', '乙'], 2),
    info,
    '-before-rejected-paste',
  );
  for (const raw of [
    'A\n'.repeat(50_000),
    '\t\n'.repeat(50_000),
    `甲\n乙${'\n'.repeat(999)}`,
    `甲\n乙${' '.repeat(99_998)}`,
  ]) {
    await page.evaluate((text) => navigator.clipboard.writeText(text), raw);
    await input.press('ControlOrMeta+A');
    await input.press('ControlOrMeta+V');
    await expect(input).toHaveValue(original);
    await expect(page.locator('#random-groups-paste-error')).toContainText('未套用');
    await expect(page.locator('#random-groups-report')).toHaveValue('');
    await expect(page.locator('.random-groups .copy-action [role="status"]')).toHaveText('');
    await expect(page.locator('.random-groups-download-status')).toHaveText('');
    await expect(page.getByRole('button', { name: '複製完整分組', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '下載分組 TXT', exact: true })).toBeDisabled();
  }
  await page.screenshot({
    path: info.outputPath('random-groups-paste-rejected.png'),
    fullPage: true,
  });
  // Exactly 1,000 total lines is accepted, including 998 blank lines.
  const boundary = `甲\n乙${'\n'.repeat(998)}`;
  await page.evaluate((text) => navigator.clipboard.writeText(text), boundary);
  await input.press('ControlOrMeta+A');
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue(boundary);
  await expect(page.locator('#random-groups-paste-error')).toHaveCount(0);
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyResult(page, ['甲', '乙'], 2);
  // Inserting at the start must count the retained suffix, not only clipboard text.
  await page.evaluate(() => navigator.clipboard.writeText('丙\n'));
  await input.press('ControlOrMeta+A');
  await input.press('ArrowLeft');
  expect(await input.evaluate((element) => element.selectionStart)).toBe(0);
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue(boundary);
  await expect(page.locator('#random-groups-paste-error')).toContainText('未套用');
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await page.evaluate(() => navigator.clipboard.writeText('丙\n丁\n戊'));
  await input.press('ControlOrMeta+A');
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue('丙\n丁\n戊');
  await expect(page.locator('#random-groups-paste-error')).toHaveCount(0);
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyExport(
    page,
    await verifyResult(page, ['丙', '丁', '戊'], 2),
    info,
    '-paste-recovery',
  );
});

test('random failure clears an earlier result and retry recovers without losing input', async ({
  page,
}) => {
  const people = names(7);
  await page.getByLabel('參與者名單', { exact: true }).fill(people.join('\n'));
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyResult(page, people, 2);
  await page.evaluate(() => {
    const original = crypto.getRandomValues;
    (window as Window & { restoreRandom?: () => void }).restoreRandom = () =>
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: original });
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: () => {
        throw new Error('simulated unavailable random');
      },
    });
  });
  await page.getByRole('button', { name: '重新分組', exact: true }).click();
  await expect(page.locator('.random-groups [role="alert"]')).toContainText('這次沒有產生結果');
  await expect(page.locator('.random-groups-card')).toHaveCount(0);
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await expect(page.getByRole('button', { name: '複製完整分組', exact: true })).toBeDisabled();
  await expect(page.getByLabel('參與者名單', { exact: true })).toHaveValue(people.join('\n'));
  await page.evaluate(() => (window as Window & { restoreRandom?: () => void }).restoreRandom!());
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await verifyResult(page, people, 2);
  await expect(page.locator('.random-groups [role="alert"]')).toHaveCount(0);
});

test('copy and download failures report recovery options while retaining the valid result', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('參與者名單', { exact: true }).fill('甲\n乙');
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  const report = await verifyResult(page, ['甲', '乙'], 2);
  await page.evaluate(() => {
    const write = navigator.clipboard.writeText;
    const create = URL.createObjectURL;
    (window as Window & { restoreExports?: () => void }).restoreExports = () => {
      Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: write });
      URL.createObjectURL = create;
    };
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('clipboard denied')),
    });
    URL.createObjectURL = () => {
      throw new Error('download denied');
    };
  });
  await page.getByRole('button', { name: '複製完整分組', exact: true }).click();
  await expect(page.locator('.random-groups .copy-action [role="status"]')).toContainText(
    '無法存取剪貼簿',
  );
  await page.getByRole('button', { name: '下載分組 TXT', exact: true }).click();
  await expect(page.locator('.random-groups-download-status')).toContainText('無法產生 TXT');
  await expect(page.locator('#random-groups-report')).toHaveValue(report);
  await page.evaluate(() => (window as Window & { restoreExports?: () => void }).restoreExports!());
  await verifyExport(page, report, info, '-recovered');
});

test('confirmations protect inputs, navigation retains results and reload clears them', async ({
  page,
}, info) => {
  const input = page.getByLabel('參與者名單', { exact: true });
  const people = names(4);
  await input.fill(people.join('\n'));
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  const report = await verifyResult(page, people, 2);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(page.locator('#random-groups-report')).toHaveValue(report);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(input).toHaveValue(people.join('\n'));
  await page.getByRole('link', { name: '全部工具', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜尋全部工具' }).fill('工作坊分組');
  await page.locator('.directory-tool').filter({ hasText: '隨機分組器' }).click();
  await expect(page).toHaveURL(/\/invoice\/random-groups\/$/);
  await expect(page.locator('#random-groups-report')).toHaveValue(report);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    '測試參與者',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '載入範例', exact: true }).click();
  await expect(input).not.toHaveValue(people.join('\n'));
  await expect(page.getByLabel('組數', { exact: true })).toHaveValue('3');
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await page.screenshot({ path: info.outputPath('random-groups-example.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByLabel('組數', { exact: true })).toHaveValue('2');
  await expect(page.locator('#random-groups-report')).toHaveValue('');
  await input.fill(people.join('\n'));
  await page.getByRole('button', { name: '產生分組', exact: true }).click();
  await page.reload();
  await expect(input).toHaveValue('');
  await expect(page.locator('#random-groups-report')).toHaveValue('');
});

test('legacy hash, category and reference task link to the public random grouping page', async ({
  page,
}) => {
  await page.goto('./#random-groups');
  await expect(page).toHaveURL(/\/invoice\/random-groups\/$/);
  for (const path of ['category/conversions/', 'task/reference/']) {
    await page.goto(path);
    await page.locator('.directory-tool').filter({ hasText: '隨機分組器' }).click();
    await expect(page).toHaveURL(/\/invoice\/random-groups\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('隨機分組器');
  }
});
