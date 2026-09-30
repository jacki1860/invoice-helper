import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvoice } from '../src/domain/invoice.ts';
import { createInitialDraft, exampleDraft } from '../src/features/invoice/draft.ts';
import { invoiceText } from '../src/utils/exportInvoice.ts';

test('legacy links preserve valid company, line, amount and leap-day values', () => {
  const { draft, notice } = createInitialDraft(
    '?uniformNumber=22099131&amount=10&itemName=設計&date=2024-02-29',
  );
  assert.equal(notice, '');
  assert.equal(draft.uniformNumber, '22099131');
  assert.equal(draft.date, '2024-02-29');
  assert.equal(draft.lines[0].name, '設計');
  const result = calculateInvoice(draft.lines, draft.priceMode, draft.taxType);
  assert.equal(result.valid, true);
  assert.equal(result.amount, 10);
  assert.equal(result.subtotal + result.tax, 10);
});

test('invalid URL fields remain blank and explain why instead of entering calculations', () => {
  const { draft, notice } = createInitialDraft('?uniformNumber=abc&amount=-10&date=2026-02-30');
  assert.equal(draft.uniformNumber, '');
  assert.equal(draft.lines[0].unitPrice, '');
  assert.notEqual(draft.date, '2026-02-30');
  assert.match(notice, /統編無效/);
  assert.match(notice, /金額無效/);
  assert.match(notice, /日期無效/);
  assert.equal(calculateInvoice(draft.lines, draft.priceMode, draft.taxType).valid, false);
});

test('sample export includes every line and the shared calculation totals', () => {
  const draft = exampleDraft();
  const calculation = calculateInvoice(draft.lines, draft.priceMode, draft.taxType);
  const text = invoiceText(draft, calculation);
  assert.match(text, /視覺設計服務\t1\t10500\t10500/);
  assert.match(text, /印刷製作\t2\t525\t1050/);
  assert.match(text, /銷售額：11000\n稅額：550\n總計：11550/);
});
