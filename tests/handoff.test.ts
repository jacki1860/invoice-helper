import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentToReceipt, paymentToReceivable } from '../src/features/tools/handoff.ts';
import type { BusinessDocumentDraft } from '../src/features/tools/documents.ts';
import { resolvePage, tools } from '../src/features/tools/catalog.ts';

const payment: BusinessDocumentDraft = {
  kind: 'payment',
  logo: null,
  issuer: '測試工作室',
  issuerNumber: '',
  issuerPhone: '',
  issuerEmail: '',
  customFields: [],
  customer: '測試客戶',
  customerNumber: '',
  number: 'PAY-42',
  date: '2026-09-30',
  dueDate: '2026-10-30',
  paymentDetails: '轉帳',
  notes: '',
  priceMode: 'total',
  taxType: 'regular',
  lines: [{ id: 'line1', name: '服務', quantity: '1', unitPrice: '1050' }],
};

test('payment handoff preserves full tax-inclusive amount without asserting a receipt date or payment method', () => {
  const receipt = paymentToReceipt(payment);
  assert.equal(receipt?.amount, '1050');
  assert.equal(receipt?.payer, '測試客戶');
  assert.equal(receipt?.date, '');
  assert.equal(receipt?.method, undefined);
  const receivable = paymentToReceivable(payment);
  assert.equal(receivable?.total, '1050');
  assert.equal(receivable?.dueDate, '2026-10-30');
  assert.equal(receivable?.reference, 'PAY-42');
});

test('quotes, incomplete forms and zero totals cannot become payment handoffs', () => {
  for (const draft of [
    { ...payment, kind: 'quote' as const },
    { ...payment, customer: '' },
    { ...payment, lines: [{ ...payment.lines[0], unitPrice: '0' }] },
  ]) {
    assert.equal(paymentToReceipt(draft), null);
    assert.equal(paymentToReceivable(draft), null);
  }
});

test('twenty-five tools have unique routes and the legacy invoice entry still works', () => {
  assert.equal(tools.length, 25);
  assert.equal(new Set(tools.map((tool) => tool.id)).size, 25);
  for (const id of [
    'receipt',
    'purchase',
    'delivery',
    'receivables',
    'workdays',
    'expense',
    'profit',
    'acceptance',
    'compare',
    'equipment',
    'list-cleanup',
    'list-compare',
    'meeting-agenda',
    'text-diff',
    'filename-plan',
  ])
    assert.equal(resolvePage(`#${id}`), id);
  assert.equal(resolvePage('', '?uniformNumber=22099131'), 'invoice');
  assert.equal(resolvePage('#unknown'), 'tools');
});
