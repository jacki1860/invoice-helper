import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_QUANTITY } from '../src/domain/invoice.ts';
import type { AcceptanceSeed } from '../src/features/tools/workflowHandoff.ts';
import {
  acceptanceFromSeed,
  acceptanceResult,
  acceptanceSummary,
  acceptanceText,
  acceptanceToPayment,
  emptyAcceptance,
  hasAcceptanceContent,
  newAcceptanceLine,
  type AcceptanceDraft,
  type AcceptanceStatus,
} from '../src/features/tools/acceptance.ts';

const source: AcceptanceSeed = {
  issuer: '交付工作室',
  customer: '驗收客戶',
  reference: 'QT-026',
  lines: [
    { name: '展示層板', quantity: '6' },
    { name: '五金組', quantity: '12' },
  ],
  pricing: {
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [
      { id: 'price-one', name: '展示層板', quantity: '6', unitPrice: '1200' },
      { id: 'price-two', name: '五金組', quantity: '12', unitPrice: '85.5' },
    ],
  },
};

function draftWith(status: AcceptanceStatus = 'pending'): AcceptanceDraft {
  const draft = acceptanceFromSeed(source);
  return {
    ...draft,
    title: '展場交付',
    date: '2026-09-30',
    deliveryDate: '2026-09-29',
    lines: draft.lines.map((line) => ({ ...line, status })),
  };
}

test('incoming delivery data never becomes evidence of acceptance and is cloned independently', () => {
  const withExtraFields = {
    ...source,
    lines: source.lines.map((line) => ({
      ...line,
      status: 'accepted',
      improvement: 'auto approved',
    })),
  };
  const draft = acceptanceFromSeed(withExtraFields);
  assert.equal(draft.date, '');
  assert.equal(draft.deliveryDate, '');
  assert.ok(draft.lines.every((line) => line.status === 'pending' && line.improvement === ''));
  assert.equal(new Set(draft.lines.map((line) => line.id)).size, 2);
  assert.equal(acceptanceResult(draft).valid, false);
  assert.equal(acceptanceToPayment(draft), null);
  draft.lines[0].name = 'edited';
  draft.pricing!.lines[0].unitPrice = '1';
  assert.equal(source.lines[0].name, '展示層板');
  assert.equal(source.pricing!.lines[0].unitPrice, '1200');
});

test('summary distinguishes pending, needs-fix and all accepted; empty is never accepted', () => {
  assert.equal(acceptanceSummary([]).status, 'pending');
  const lines = draftWith().lines;
  assert.deepEqual(acceptanceSummary(lines), {
    accepted: 0,
    needsFix: 0,
    pending: 2,
    status: 'pending',
    label: '待驗收',
  });
  const partial = [{ ...lines[0], status: 'accepted' as const }, lines[1]];
  assert.equal(acceptanceSummary(partial).label, '待驗收');
  const fixAndPending = [{ ...lines[0], status: 'needs-fix' as const }, lines[1]];
  assert.deepEqual(acceptanceSummary(fixAndPending), {
    accepted: 0,
    needsFix: 1,
    pending: 1,
    status: 'needs-fix',
    label: '待改善',
  });
  assert.equal(acceptanceSummary(draftWith('accepted').lines).label, '全部通過');
});

test('pending records may export a clearly pending document but cannot create a payment request', () => {
  const draft = draftWith();
  const result = acceptanceResult(draft);
  assert.equal(result.valid, true);
  assert.equal(result.canCreatePayment, false);
  assert.equal(acceptanceToPayment(draft), null);
  assert.ok(acceptanceText(draft).includes('整體結果：待驗收'));
  assert.ok(acceptanceText(draft).includes('待驗收 2 項'));
  assert.doesNotMatch(acceptanceText(draft), /全部通過/);
});

test('needs-fix requires a description and remains ineligible for payment after description is supplied', () => {
  const draft = draftWith('needs-fix');
  assert.equal(acceptanceResult(draft).valid, false);
  assert.equal(acceptanceText(draft), '');
  assert.ok(
    acceptanceResult(draft).lineErrors[draft.lines[0].id].some((error) =>
      error.includes('改善說明'),
    ),
  );
  const described = {
    ...draft,
    lines: draft.lines.map((line) => ({ ...line, improvement: '修整邊角後再次確認' })),
  };
  assert.equal(acceptanceResult(described).valid, true);
  assert.equal(acceptanceToPayment(described), null);
  assert.ok(acceptanceText(described).includes('整體結果：待改善'));
  assert.ok(acceptanceText(described).includes('修整邊角後再次確認'));
  assert.equal(
    acceptanceResult({ ...described, lines: [{ ...described.lines[0], improvement: ' \n' }] })
      .valid,
    false,
  );
});

test('acceptance rejects missing parties, malformed dates, later delivery dates and invalid item values', () => {
  const draft = draftWith('accepted');
  for (const patch of [
    { issuer: '' },
    { customer: ' ' },
    { date: '' },
    { date: '2026-02-29' },
    { date: '0000-01-01' },
    { deliveryDate: '2026-09-31' },
    { deliveryDate: '2026-10-01' },
    { lines: [] },
  ]) {
    const invalid = { ...draft, ...patch };
    assert.equal(acceptanceResult(invalid).valid, false, JSON.stringify(patch));
    assert.equal(acceptanceText(invalid), '');
    assert.equal(acceptanceToPayment(invalid), null);
  }
  for (const patch of [
    { name: ' ' },
    { quantity: '' },
    { quantity: '0' },
    { quantity: '1.5' },
    { quantity: '-1' },
    { quantity: String(MAX_QUANTITY + 1) },
    { quantity: '1e3' },
    { status: 'unknown' as AcceptanceStatus },
  ]) {
    const invalid = { ...draft, lines: [{ ...draft.lines[0], ...patch }] };
    assert.equal(acceptanceResult(invalid).valid, false, JSON.stringify(patch));
    assert.equal(acceptanceText(invalid), '');
    assert.equal(acceptanceToPayment(invalid), null);
  }
  assert.equal(acceptanceResult({ ...draft, deliveryDate: '' }).valid, true);
  assert.equal(
    acceptanceResult({ ...draft, date: '2028-02-29', deliveryDate: '2028-02-28' }).valid,
    true,
  );
  assert.equal(
    acceptanceResult({ ...draft, lines: [{ ...draft.lines[0], quantity: String(MAX_QUANTITY) }] })
      .valid,
    true,
  );
});

test('only fully accepted documents with matching valid source prices create fresh payment requests', () => {
  const draft = draftWith('accepted');
  const result = acceptanceResult(draft);
  assert.equal(result.canCreatePayment, true);
  assert.equal(result.sourceCalculation?.amount, 8637);
  const payment = acceptanceToPayment(draft)!;
  assert.equal(payment.kind, 'payment');
  assert.equal(payment.issuer, draft.issuer);
  assert.equal(payment.customer, draft.customer);
  assert.equal(payment.reference, '');
  assert.equal('dueDate' in payment, false);
  assert.equal('date' in payment, false);
  assert.equal(payment.priceMode, 'subtotal');
  assert.equal(payment.taxType, 'regular');
  assert.deepEqual(payment.lines, draft.pricing!.lines);
  assert.ok(payment.notes.includes('QT-026'));
  assert.ok(payment.notes.includes('2026-09-30'));
  assert.ok(payment.notes.includes('不表示款項已收'));
  payment.lines[0].unitPrice = '1';
  assert.equal(draft.pricing!.lines[0].unitPrice, '1200');
  assert.equal(
    acceptanceResult({
      ...draft,
      pricing: { ...draft.pricing!, priceMode: 'total', taxType: 'exempt' },
    }).canCreatePayment,
    true,
  );
});

test('edited, removed, added, reordered or invalidly priced source items cannot silently become a payment request', () => {
  const draft = draftWith('accepted');
  for (const lines of [
    [{ ...draft.lines[0], name: 'different' }, draft.lines[1]],
    [{ ...draft.lines[0], quantity: '7' }, draft.lines[1]],
    [draft.lines[0]],
    [...draft.lines, { ...newAcceptanceLine(), name: 'extra', status: 'accepted' as const }],
    [draft.lines[1], draft.lines[0]],
  ]) {
    const changed = { ...draft, lines };
    assert.equal(acceptanceResult(changed).valid, true);
    assert.equal(acceptanceResult(changed).pricingMatches, false);
    assert.equal(acceptanceToPayment(changed), null);
  }
  const invalidPricing = {
    ...draft,
    pricing: {
      ...draft.pricing!,
      lines: [{ ...draft.pricing!.lines[0], unitPrice: '' }, draft.pricing!.lines[1]],
    },
  };
  assert.equal(
    acceptanceResult(invalidPricing).valid,
    true,
    'acceptance itself does not require prices',
  );
  assert.equal(acceptanceToPayment(invalidPricing), null);
  const noPricing = { ...draft, pricing: undefined };
  assert.equal(acceptanceResult(noPricing).valid, true);
  assert.equal(acceptanceToPayment(noPricing), null);
});

test('an explicit zero price can be preserved, while an absent price is never invented', () => {
  const imported = acceptanceFromSeed({
    issuer: '交付方',
    customer: '驗收方',
    reference: '',
    lines: [{ name: '附贈品', quantity: '1' }],
    pricing: {
      priceMode: 'total',
      taxType: 'exempt',
      lines: [{ id: 'free', name: '附贈品', quantity: '1', unitPrice: '0' }],
    },
  });
  const draft = {
    ...imported,
    date: '2026-09-30',
    lines: imported.lines.map((line) => ({ ...line, status: 'accepted' as const })),
  };
  assert.equal(acceptanceToPayment(draft)?.lines[0].unitPrice, '0');
  assert.equal(acceptanceToPayment({ ...draft, pricing: undefined }), null);
});

test('acceptance text records results and blank signatures without exposing retained source prices', () => {
  const draft = draftWith('accepted');
  const text = acceptanceText(draft);
  for (const expected of [
    '專案／交付名稱：展場交付',
    '對應文件編號：QT-026',
    '整體結果：全部通過',
    '展示層板\t6\t通過',
    '交付方確認：________________',
    '驗收方確認：________________',
    '不表示款項已收',
  ])
    assert.ok(text.includes(expected), expected);
  assert.doesNotMatch(text, /1200|85\.5|8637|8,637|NT\$|單價|稅額|總計/);
  assert.equal(acceptanceText({ ...draft, pricing: undefined }), text);
});

test('replacement detection covers every user field, line result, description and retained pricing', () => {
  const blank = emptyAcceptance();
  assert.equal(hasAcceptanceContent(blank), false);
  for (const field of ['issuer', 'customer', 'title', 'reference', 'date', 'deliveryDate', 'notes'])
    assert.equal(hasAcceptanceContent({ ...blank, [field]: 'entered' }), true, field);
  for (const patch of [
    { name: 'entered' },
    { quantity: '2' },
    { status: 'accepted' as const },
    { improvement: 'entered' },
  ])
    assert.equal(
      hasAcceptanceContent({ ...blank, lines: [{ ...blank.lines[0], ...patch }] }),
      true,
    );
  assert.equal(hasAcceptanceContent({ ...blank, lines: [] }), true);
  assert.equal(
    hasAcceptanceContent({ ...blank, lines: [...blank.lines, newAcceptanceLine()] }),
    true,
  );
  assert.equal(hasAcceptanceContent({ ...blank, pricing: source.pricing }), true);
});
