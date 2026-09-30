import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AMOUNT, MAX_QUANTITY } from '../src/domain/invoice.ts';
import {
  receiptFromSeed,
  receiptResult,
  receiptText,
  purchaseOrderResult,
  purchaseOrderText,
  deliveryNoteResult,
  deliveryNoteText,
  hasReceiptContent,
  hasPurchaseOrderContent,
  hasDeliveryNoteContent,
  type ReceiptDraft,
  type PurchaseOrderDraft,
  type DeliveryNoteDraft,
} from '../src/features/tools/tradeDocuments.ts';

const date = '2026-09-30';
const receipt: ReceiptDraft = {
  payer: '付款人',
  payee: '收款人',
  amount: '12600',
  purpose: '製作尾款',
  reference: 'RC-001',
  date,
  method: '銀行轉帳',
  notes: '備註',
};
const purchase: PurchaseOrderDraft = {
  buyer: '工作室',
  supplier: '材料行',
  buyerContact: '採購窗口',
  supplierContact: '供應窗口',
  reference: 'PO-001',
  date,
  deliveryDate: '2026-10-02',
  deliveryPlace: '收貨處',
  notes: '到貨前聯繫',
  priceMode: 'subtotal',
  taxType: 'regular',
  lines: [
    { id: 'one', name: '層板', quantity: '6', unitPrice: '1200' },
    { id: 'two', name: '五金', quantity: '12', unitPrice: '85.5' },
  ],
};
const delivery: DeliveryNoteDraft = {
  sender: '出貨方',
  recipient: '收貨方',
  senderContact: '出貨窗口',
  recipientContact: '收貨窗口',
  reference: 'DN-001',
  date,
  address: '展場收貨處',
  notes: '請點收',
  showPrices: false,
  priceMode: 'subtotal',
  taxType: 'regular',
  lines: [{ id: 'one', name: '展架', quantity: '3', unitPrice: '' }],
};

test('receipt uses the actual received whole-dollar amount and leaves a signature blank', () => {
  assert.deepEqual(receiptResult(receipt), { amount: 12600, errors: [], valid: true });
  const text = receiptText(receipt);
  for (const expected of [
    '實收金額：新臺幣 12600 元',
    '壹萬貳仟陸佰元整',
    '付款人：付款人',
    '收款人：收款人',
    '銀行轉帳',
    '製作尾款',
    'RC-001',
    '收款人簽章：________________',
    '非統一發票',
  ]) {
    assert.ok(text.includes(expected), expected);
  }
  assert.equal(receiptResult({ ...receipt, amount: String(MAX_AMOUNT) }).valid, true);
  assert.equal(receiptResult({ ...receipt, amount: '1' }).valid, true);
});

test('receipt blocks malformed, zero, fractional, negative and out-of-range received amounts', () => {
  for (const amount of [
    '',
    ' ',
    '0',
    '-1',
    '+1',
    '1.1',
    '1e3',
    'NaN',
    'Infinity',
    '1,000',
    String(MAX_AMOUNT + 1),
    '9'.repeat(400),
  ]) {
    const draft = { ...receipt, amount };
    assert.equal(receiptResult(draft).valid, false, amount);
    assert.equal(receiptResult(draft).amount, null, amount);
    assert.equal(receiptText(draft), '', amount);
  }
  for (const patch of [
    { payer: ' ' },
    { payee: '' },
    { purpose: '\n' },
    { method: '' },
    { date: '2026-02-29' },
    { date: '0000-01-01' },
  ]) {
    const draft = { ...receipt, ...patch };
    assert.equal(receiptResult(draft).valid, false);
    assert.equal(receiptText(draft), '');
  }
});

test('receipt handoff preserves supplied data without inventing a payment method or normalizing an invalid amount', () => {
  const { notes: _notes, ...seed } = receipt;
  const original = { ...seed };
  assert.deepEqual(receiptFromSeed(seed), { ...seed, notes: '' });
  assert.deepEqual(seed, original);
  const imported = receiptFromSeed({ ...seed, method: undefined, amount: 'invalid' });
  assert.equal(imported.method, '');
  assert.equal(imported.amount, 'invalid');
  assert.equal(receiptResult(imported).valid, false);
  const fromRequest = receiptFromSeed({ ...seed, date: '', method: undefined });
  assert.equal(fromRequest.date, '');
  assert.equal(receiptResult(fromRequest).valid, false);
  assert.equal(receiptText(fromRequest), '');
});

test('purchase uses shared integer-cent rounding and labels both tax and price modes', () => {
  const { calculation, valid } = purchaseOrderResult(purchase);
  assert.equal(valid, true);
  assert.equal(calculation.subtotal, 8226);
  assert.equal(calculation.tax, 411);
  assert.equal(calculation.amount, 8637);
  const text = purchaseOrderText(purchase);
  for (const expected of [
    '單價（未稅）',
    '預定交貨日期：2026-10-02',
    '交貨地點：收貨處',
    '採購聯絡資訊：採購窗口',
    '供應商聯絡資訊：供應窗口',
    '稅額（應稅 5%）：411',
    '總計：新臺幣 8637 元',
    '採購方確認：________________',
    '供應商確認：________________',
  ]) {
    assert.ok(text.includes(expected), expected);
  }
  const gross = {
    ...purchase,
    priceMode: 'total' as const,
    lines: [{ id: 'one', name: '服務', quantity: '1', unitPrice: '10' }],
  };
  assert.equal(purchaseOrderResult(gross).calculation.amount, 10);
  assert.ok(purchaseOrderText(gross).includes('單價（含稅）'));
  for (const taxType of ['exempt', 'zero-rate'] as const) {
    const result = purchaseOrderResult({ ...purchase, taxType });
    assert.equal(result.calculation.tax, 0);
    assert.equal(result.calculation.amount, 8226);
  }
});

test('purchase blocks invalid parties, dates, quantities, prices and monetary overflow', () => {
  for (const patch of [
    { buyer: '' },
    { supplier: ' ' },
    { date: '2026-04-31' },
    { deliveryDate: '2026-09-29' },
    { deliveryDate: '2026-02-29' },
    { lines: [] },
  ]) {
    const draft = { ...purchase, ...patch };
    assert.equal(purchaseOrderResult(draft).valid, false);
    assert.equal(purchaseOrderText(draft), '');
  }
  for (const patch of [
    { name: '' },
    { quantity: '0' },
    { quantity: '1.5' },
    { quantity: String(MAX_QUANTITY + 1) },
    { unitPrice: '-1' },
    { unitPrice: '1.999' },
    { unitPrice: String(MAX_AMOUNT) },
  ]) {
    const draft = { ...purchase, lines: [{ ...purchase.lines[0], ...patch }] };
    assert.equal(purchaseOrderResult(draft).valid, false, JSON.stringify(patch));
    assert.equal(purchaseOrderText(draft), '');
  }
  assert.equal(purchaseOrderResult({ ...purchase, deliveryDate: '' }).valid, true);
});

test('unpriced delivery accepts no price and completely omits retained prices and totals', () => {
  const baseText = deliveryNoteText(delivery);
  assert.equal(deliveryNoteResult(delivery).valid, true);
  assert.ok(baseText.includes('品項\t數量\n展架\t3'));
  for (const expected of [
    '出貨方：出貨方',
    '收貨方：收貨方',
    '送達地址：展場收貨處',
    '收貨人簽章：________________',
    '簽收日期／時間：________________',
    '點收情形／差異：________________',
  ])
    assert.ok(baseText.includes(expected), expected);
  for (const unitPrice of ['876543.21', 'not a price', '9'.repeat(400), '-1', '']) {
    const draft = { ...delivery, lines: [{ ...delivery.lines[0], unitPrice }] };
    assert.equal(deliveryNoteResult(draft).valid, true);
    assert.equal(deliveryNoteText(draft), baseText);
    assert.equal(deliveryNoteResult(draft).calculation.lines[0].unitPrice, 0);
    assert.equal(deliveryNoteResult(draft).calculation.amount, 0);
    assert.equal(draft.lines[0].unitPrice, unitPrice, 'retained editor price must not mutate');
  }
  assert.doesNotMatch(baseText, /單價|金額|稅額|總計|中文大寫|NT\$|新臺幣|876543/);
});

test('priced delivery validates and calculates prices only when requested', () => {
  assert.equal(deliveryNoteResult({ ...delivery, showPrices: true }).valid, false);
  assert.equal(deliveryNoteText({ ...delivery, showPrices: true }), '');
  const priced = {
    ...delivery,
    showPrices: true,
    lines: [{ ...delivery.lines[0], unitPrice: '100.5' }],
  };
  assert.equal(deliveryNoteResult(priced).calculation.subtotal, 302);
  assert.equal(deliveryNoteResult(priced).calculation.tax, 15);
  assert.equal(deliveryNoteResult(priced).calculation.amount, 317);
  assert.ok(deliveryNoteText(priced).includes('總計：新臺幣 317 元'));
  for (const patch of [
    { sender: '' },
    { recipient: ' ' },
    { date: '2026-09-31' },
    { lines: [] },
    { lines: [{ ...delivery.lines[0], quantity: '0' }] },
    { lines: [{ ...delivery.lines[0], name: '' }] },
  ]) {
    const draft = { ...delivery, ...patch };
    assert.equal(deliveryNoteResult(draft).valid, false);
    assert.equal(deliveryNoteText(draft), '');
  }
  assert.equal(
    deliveryNoteResult({
      ...delivery,
      lines: [{ ...delivery.lines[0], quantity: String(MAX_QUANTITY) }],
    }).valid,
    true,
  );
});

test('replacement guards protect every receipt field and changes to document settings or line items', () => {
  const blankReceipt: ReceiptDraft = {
    payer: '',
    payee: '',
    amount: '',
    purpose: '',
    reference: '',
    date,
    method: '現金',
    notes: '',
  };
  const blankPurchase: PurchaseOrderDraft = {
    buyer: '',
    supplier: '',
    buyerContact: '',
    supplierContact: '',
    reference: '',
    date,
    deliveryDate: '',
    deliveryPlace: '',
    notes: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [{ id: 'one', name: '', quantity: '1', unitPrice: '' }],
  };
  const blankDelivery: DeliveryNoteDraft = {
    sender: '',
    recipient: '',
    senderContact: '',
    recipientContact: '',
    reference: '',
    date,
    address: '',
    notes: '',
    showPrices: false,
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: blankPurchase.lines,
  };
  assert.equal(hasReceiptContent(blankReceipt, date), false);
  for (const field of Object.keys(blankReceipt))
    assert.equal(hasReceiptContent({ ...blankReceipt, [field]: 'entered' }, date), true, field);
  assert.equal(hasPurchaseOrderContent(blankPurchase, date), false);
  assert.equal(hasDeliveryNoteContent(blankDelivery, date), false);
  for (const field of [
    'buyer',
    'supplier',
    'buyerContact',
    'supplierContact',
    'reference',
    'date',
    'deliveryDate',
    'deliveryPlace',
    'notes',
  ])
    assert.equal(
      hasPurchaseOrderContent({ ...blankPurchase, [field]: 'entered' }, date),
      true,
      field,
    );
  for (const field of [
    'sender',
    'recipient',
    'senderContact',
    'recipientContact',
    'reference',
    'date',
    'address',
    'notes',
  ])
    assert.equal(
      hasDeliveryNoteContent({ ...blankDelivery, [field]: 'entered' }, date),
      true,
      field,
    );
  for (const patch of [
    { priceMode: 'total' as const },
    { taxType: 'exempt' as const },
    { lines: [] },
    { lines: [{ ...blankPurchase.lines[0], unitPrice: '0' }] },
    { lines: [{ ...blankPurchase.lines[0], quantity: '2' }] },
    { lines: [{ ...blankPurchase.lines[0], name: 'entered' }] },
  ]) {
    assert.equal(hasPurchaseOrderContent({ ...blankPurchase, ...patch }, date), true);
    assert.equal(hasDeliveryNoteContent({ ...blankDelivery, ...patch }, date), true);
  }
  assert.equal(hasDeliveryNoteContent({ ...blankDelivery, showPrices: true }, date), true);
});
