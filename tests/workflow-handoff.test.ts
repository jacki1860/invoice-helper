import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentToAcceptance,
  deliveryToAcceptance,
  hourlyToCosts,
} from '../src/features/tools/workflowHandoff.ts';
import type { BusinessDocumentDraft } from '../src/features/tools/documents.ts';
import type { DeliveryNoteDraft } from '../src/features/tools/tradeDocuments.ts';

const quote: BusinessDocumentDraft = {
  kind: 'quote',
  logo: null,
  issuer: '工作室',
  issuerNumber: '',
  issuerPhone: '',
  issuerEmail: '',
  customFields: [],
  customer: '客戶',
  customerNumber: '',
  number: 'QT-42',
  date: '2026-09-30',
  dueDate: '2026-10-20',
  paymentDetails: '',
  notes: '',
  priceMode: 'total',
  taxType: 'regular',
  lines: [{ id: 'item', name: '服務', quantity: '2', unitPrice: '10.50' }],
};

test('acceptance transfer retains pricing and source reference without asserting any acceptance date or result', () => {
  const result = documentToAcceptance(quote)!;
  assert.deepEqual(result.lines, [{ name: '服務', quantity: '2' }]);
  assert.equal(result.reference, 'QT-42');
  assert.equal(result.pricing?.priceMode, 'total');
  assert.deepEqual(result.pricing?.lines, quote.lines);
  assert.notEqual(result.pricing?.lines[0], quote.lines[0]);
  assert.equal('date' in result, false);
  assert.equal('status' in result, false);
  assert.equal(documentToAcceptance({ ...quote, customer: '' }), null);
});

test('delivery without visible prices does not leak retained prices to acceptance', () => {
  const draft: DeliveryNoteDraft = {
    sender: '工作室',
    recipient: '客戶',
    senderContact: '',
    recipientContact: '',
    reference: 'DN-1',
    date: '2026-09-30',
    address: '',
    notes: '',
    showPrices: false,
    priceMode: 'total',
    taxType: 'regular',
    lines: [{ id: 'a', name: '器材', quantity: '1', unitPrice: 'bad-retained-price' }],
  };
  const seed = deliveryToAcceptance(draft)!;
  assert.equal(seed.pricing, undefined);
  assert.equal(JSON.stringify(seed).includes('bad-retained-price'), false);
  assert.equal(deliveryToAcceptance({ ...draft, showPrices: true }), null);
  assert.equal(deliveryToAcceptance({ ...draft, date: '2026-02-30' }), null);
});

test('hourly transfer uses the exact rounded cent totals and rejects incomplete work', () => {
  const seed = hourlyToCosts([{ id: 'h', name: '設計', hours: '0', minutes: '1', rate: '100' }]);
  assert.deepEqual(seed, { lines: [{ name: '設計', amount: '1.67' }] });
  assert.equal(hourlyToCosts([{ id: 'h', name: '', hours: '1', minutes: '0', rate: '100' }]), null);
});
