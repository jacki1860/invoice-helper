import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiptSample, receiptSamples } from '../src/features/tools/receiptSamples.ts';
import { receiptResult, receiptText } from '../src/features/tools/tradeDocuments.ts';

for (const [id, amount, chinese, purpose, method] of [
  ['general', 12600, '壹萬貳仟陸佰元整', '展場道具製作尾款', '銀行轉帳'],
  ['deposit', 6000, '陸仟元整', '設計專案訂金', '銀行轉帳'],
  ['balance', 14000, '壹萬肆仟元整', '設計專案尾款', '支票'],
  ['service', 3500, '參仟伍佰元整', '單次設備維護服務費', '現金'],
] as const) {
  test(`${id} example uses a valid actual-amount draft and complete document text`, () => {
    const draft = createReceiptSample(id, '2026-10-09');
    const result = receiptResult(draft);
    assert.equal(result.valid, true);
    assert.equal(result.amount, amount);
    assert.equal(draft.date, '2026-10-09');
    const text = receiptText(draft);
    for (const field of [
      chinese,
      purpose,
      method,
      draft.reference,
      draft.notes,
      '此為示範內容',
      '收款人簽章：________________',
      '非統一發票',
    ])
      assert.ok(text.includes(field), field);
  });
}

test('sample drafts own every value and do not contaminate future loads or other scenarios', () => {
  assert.deepEqual(
    receiptSamples.map((item) => item.id),
    ['general', 'deposit', 'balance', 'service'],
  );
  const first = createReceiptSample('deposit', '2026-10-09');
  first.amount = '99';
  first.payer = '我的客戶';
  first.notes = '私密備註';
  const next = createReceiptSample('deposit', '2027-01-04');
  assert.notEqual(first, next);
  assert.equal(next.amount, '6000');
  assert.equal(next.payer, '範例客戶');
  assert.ok(!receiptText(next).includes('私密備註'));
  assert.equal(next.date, '2027-01-04');
  assert.equal(createReceiptSample('service', '2026-10-09').amount, '3500');
});

test('sample metadata never silently fills or normalizes an invalid received date', () => {
  const invalid = createReceiptSample('balance', '2026-02-29');
  assert.equal(invalid.date, '2026-02-29');
  assert.equal(receiptResult(invalid).valid, false);
  assert.equal(receiptText(invalid), '');
});
