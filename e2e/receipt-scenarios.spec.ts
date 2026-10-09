import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('scenario selection and canceled replacement preserve every receipt field', async ({
  page,
}, info) => {
  await page.goto('receipt/');
  const receipt = page.getByRole('region', { name: '收據產生器', exact: true });
  const fields = [
    ['付款人 *', '原付款人'],
    ['收款人 *', '原收款人'],
    ['收款日期 *', '2026-10-08'],
    ['收據／對應文件編號（選填）', 'MY-RECEIPT'],
    ['實收金額（新臺幣）*', '9876'],
    ['付款方式 *', '原付款方式'],
    ['收款事由 *', '原收款事由'],
    ['備註（選填）', '原備註'],
  ] as const;
  for (const [label, value] of fields) await receipt.getByLabel(label).fill(value);
  await receipt.getByRole('combobox', { name: /收據範本/ }).selectOption('deposit');
  for (const [label, value] of fields) await expect(receipt.getByLabel(label)).toHaveValue(value);
  page.once('dialog', (dialog) => dialog.dismiss());
  const load = receipt.getByRole('button', { name: '載入文件範例', exact: true });
  await load.focus();
  await load.press('Enter');
  for (const [label, value] of fields) await expect(receipt.getByLabel(label)).toHaveValue(value);
  page.once('dialog', (dialog) => dialog.accept());
  await load.press('Enter');
  await expect(receipt.getByLabel('實收金額（新臺幣）*')).toHaveValue('6000');
  await expect(receipt.getByRole('textbox', { name: '收款事由 *', exact: true })).toHaveValue(
    '設計專案訂金',
  );
  await expect(receipt.locator('.trade-receipt')).toContainText('陸仟元整');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await receipt
    .locator('.receipt-samples')
    .screenshot({ path: info.outputPath('receipt-scenario-controls.png') });
});

for (const [id, amount, chinese, purpose, method, reference] of [
  ['general', '12600', '壹萬貳仟陸佰元整', '展場道具製作尾款', '銀行轉帳', 'RC-001'],
  ['deposit', '6000', '陸仟元整', '設計專案訂金', '銀行轉帳', 'RC-DEPOSIT-001'],
  ['balance', '14000', '壹萬肆仟元整', '設計專案尾款', '支票', 'RC-BALANCE-001'],
  ['service', '3500', '參仟伍佰元整', '單次設備維護服務費', '現金', 'RC-SERVICE-001'],
] as const) {
  test(`${id} scenario exports matching text, PNG and print PDF`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const state = window as Window & { copiedReceipt: string; receiptPrintCalls: number };
      state.copiedReceipt = '';
      state.receiptPrintCalls = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            state.copiedReceipt = text;
          },
        },
      });
      window.print = () => {
        state.receiptPrintCalls++;
      };
    });
    await page.goto('receipt/');
    const receipt = page.getByRole('region', { name: '收據產生器', exact: true });
    await receipt.getByRole('combobox', { name: /收據範本/ }).selectOption(id);
    await receipt.getByRole('button', { name: '載入文件範例', exact: true }).click();
    await expect(receipt.getByLabel('實收金額（新臺幣）*')).toHaveValue(amount);
    const paper = receipt.locator('.trade-receipt');
    for (const field of [chinese, purpose, method, reference, '此為示範內容'])
      await expect(paper).toContainText(field);
    await receipt.getByRole('button', { name: '複製文件文字', exact: true }).click();
    const copied = await page.evaluate(
      () => (window as Window & { copiedReceipt: string }).copiedReceipt,
    );
    for (const field of [chinese, purpose, method, reference, '此為示範內容'])
      expect(copied).toContain(field);
    const downloadEvent = page.waitForEvent('download');
    await receipt.getByRole('button', { name: '下載文件 PNG', exact: true }).click();
    const download = await downloadEvent;
    const pngPath = info.outputPath(`receipt-${id}.png`);
    await download.saveAs(pngPath);
    const bytes = await readFile(pngPath);
    expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(500);
    expect(bytes.readUInt32BE(20)).toBeGreaterThan(500);
    await expect(receipt.getByRole('button', { name: '下載文件 PNG', exact: true })).toBeEnabled();
    await receipt.getByRole('button', { name: '列印／另存 PDF', exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as Window & { receiptPrintCalls: number }).receiptPrintCalls,
      ),
    ).toBe(1);
    const pdfPath = info.outputPath(`receipt-${id}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    const pdfText = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
    }).replace(/\s+/gu, '');
    for (const field of [chinese, purpose, method, reference, '此為示範內容'])
      expect(pdfText).toContain(field.replace(/\s+/gu, ''));
    expect(pdfText).not.toContain('常見問題');
    expect(pdfText).not.toContain('從收款情境開始');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await paper.screenshot({ path: info.outputPath('receipt-preview.png') });
  });
}
