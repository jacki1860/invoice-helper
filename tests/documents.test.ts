import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessDocumentText,
  documentResult,
  hasBusinessDocumentContent,
  type BusinessDocumentDraft,
} from '../src/features/tools/documents.ts';

const draft: BusinessDocumentDraft = {
  kind: 'quote',
  issuer: '工作室',
  issuerNumber: '',
  issuerContact: '',
  customer: '客戶',
  customerNumber: '',
  number: 'Q1',
  date: '2026-09-30',
  dueDate: '2026-10-31',
  paymentDetails: '分期付款',
  notes: '',
  priceMode: 'total',
  taxType: 'regular',
  lines: [{ id: 'one', name: '服務', quantity: '1', unitPrice: '10' }],
};
test('business documents share gross-preserving calculation and safe output gating', () => {
  assert.equal(documentResult(draft).valid, true);
  const text = businessDocumentText(draft);
  assert.ok(text.includes('總計：10'));
  assert.ok(text.includes('報價有效期限：2026-10-31'));
  assert.ok(text.includes('本文件非統一發票。'));
  assert.ok(businessDocumentText({ ...draft, kind: 'payment' }).includes('付款期限：2026-10-31'));
  for (const patch of [
    { issuer: '' },
    { customer: '' },
    { date: '2026-02-29' },
    { dueDate: '2026-09-29' },
    { issuerNumber: '123' },
    { customerNumber: 'ABCDEFGH' },
    { lines: [] },
  ]) {
    const result = { ...draft, ...patch };
    assert.equal(documentResult(result).valid, false);
    assert.equal(businessDocumentText(result), '');
  }
});

test('loading a sample protects every field that can hold user work', () => {
  const blank: BusinessDocumentDraft = {
    kind: 'quote',
    issuer: '',
    issuerNumber: '',
    issuerContact: '',
    customer: '',
    customerNumber: '',
    number: '',
    date: '2026-09-30',
    dueDate: '',
    paymentDetails: '',
    notes: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [{ id: 'one', name: '', quantity: '1', unitPrice: '' }],
  };
  assert.equal(hasBusinessDocumentContent(blank, blank.date), false);
  assert.equal(hasBusinessDocumentContent({ ...blank, kind: 'payment' }, blank.date), false);
  for (const field of [
    'issuer',
    'issuerNumber',
    'issuerContact',
    'customer',
    'customerNumber',
    'number',
    'dueDate',
    'paymentDetails',
    'notes',
    'date',
  ]) {
    assert.equal(
      hasBusinessDocumentContent({ ...blank, [field]: 'entered' }, blank.date),
      true,
      field,
    );
  }
  for (const patch of [
    { priceMode: 'total' as const },
    { taxType: 'exempt' as const },
    { lines: [{ ...blank.lines[0], quantity: '2' }] },
    { lines: [{ ...blank.lines[0], name: 'x' }] },
    { lines: [{ ...blank.lines[0], unitPrice: '0' }] },
    { lines: [...blank.lines, { ...blank.lines[0], id: 'two' }] },
  ]) {
    assert.equal(hasBusinessDocumentContent({ ...blank, ...patch }, blank.date), true);
  }
});
