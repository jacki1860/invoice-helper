import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProfit,
  centsText,
  formatPercent,
  profitText,
  profitToQuote,
  type ProfitInput,
} from '../src/domain/profit.ts';
import { calculateInvoice, MAX_AMOUNT } from '../src/domain/invoice.ts';

const input = (cost = '80.00', sale = '100.00'): ProfitInput => ({
  lines: [{ id: 'one', name: '材料', category: 'material', amount: cost }],
  mode: 'price',
  salePrice: sale,
  targetMargin: '20',
});
test('profit uses exact cents and distinguishes revenue margin from cost markup', () => {
  const result = calculateProfit(input());
  assert.equal(result.valid, true);
  assert.equal(result.costCents, 8000);
  assert.equal(result.saleCents, 10000);
  assert.equal(result.profitCents, 2000);
  assert.equal(result.marginBasisPoints, 2000);
  assert.equal(result.markupBasisPoints, 2500);
  const decimals = input('0.10', '0.30');
  decimals.lines.push({ id: 'two', name: '工時', category: 'labor', amount: '0.20' });
  assert.equal(calculateProfit(decimals).profitCents, 0);
  assert.equal(centsText(10001), '100.01');
  assert.equal(centsText(-1), '-0.01');
});
test('target margin rounds price upward to a cent, never below the requested target', () => {
  const result = calculateProfit({ ...input('1.00'), mode: 'margin', targetMargin: '1' });
  assert.equal(result.saleCents, 102);
  assert.equal(result.marginBasisPoints, 196);
  for (const cost of [1, 3, 100, 2999, 100001, 9999999]) {
    for (const target of [0, 1, 125, 2000, 3333, 9999]) {
      const calculated = calculateProfit({
        ...input(centsText(cost)),
        mode: 'margin',
        targetMargin: centsText(target),
      });
      assert.equal(calculated.valid, true);
      assert.ok(
        BigInt(calculated.saleCents - cost) * 10_000n >=
          BigInt(calculated.saleCents) * BigInt(target),
      );
      if (calculated.saleCents > 0)
        assert.ok(
          BigInt(calculated.saleCents - 1) * BigInt(10_000 - target) < BigInt(cost) * 10_000n,
        );
    }
  }
});
test('zero denominators are undefined, while positive sales with zero costs yield 100% margin', () => {
  const bothZero = calculateProfit(input('0', '0'));
  assert.equal(bothZero.valid, true);
  assert.equal(bothZero.marginBasisPoints, null);
  assert.equal(bothZero.markupBasisPoints, null);
  assert.equal(formatPercent(bothZero.marginBasisPoints), '未定義');
  assert.doesNotMatch(profitText(input('0', '0'), ''), /NaN|Infinity/);
  assert.equal(calculateProfit(input('1', '0')).valid, false);
  const freeCost = calculateProfit(input('0', '10'));
  assert.equal(freeCost.marginBasisPoints, 10000);
  assert.equal(freeCost.markupBasisPoints, null);
  assert.equal(calculateProfit({ ...input('0'), mode: 'margin', targetMargin: '20' }).valid, false);
});
test('losses are displayed as negative profit and margin instead of rejected costs', () => {
  const result = calculateProfit(input('100', '80'));
  assert.equal(result.valid, true);
  assert.equal(result.profitCents, -2000);
  assert.equal(formatPercent(result.marginBasisPoints), '-25.00%');
  assert.equal(formatPercent(result.markupBasisPoints), '-20.00%');
});
test('invalid prices, margins, counts and overflows fail without partial totals', () => {
  for (const value of ['', '-1', 'NaN', 'Infinity', '1.001', '1e3', String(MAX_AMOUNT + 1)]) {
    assert.equal(calculateProfit(input(value)).valid, false, `cost ${value}`);
    assert.equal(calculateProfit(input('1', value)).valid, false, `sale ${value}`);
  }
  for (const targetMargin of ['', '-1', '100', '100.01', 'Infinity', '1.001'])
    assert.equal(
      calculateProfit({ ...input(), mode: 'margin', targetMargin }).valid,
      false,
      targetMargin,
    );
  const over = input(String(MAX_AMOUNT));
  over.lines.push({ ...over.lines[0], id: 'two', amount: '0.01' });
  assert.equal(calculateProfit(over).valid, false);
  assert.equal(calculateProfit(over).costCents, 0);
  assert.equal(
    calculateProfit({ ...input(String(MAX_AMOUNT)), mode: 'margin', targetMargin: '1' }).valid,
    false,
  );
  assert.equal(calculateProfit({ ...input(), lines: [] }).valid, false);
  assert.equal(
    calculateProfit({
      ...input(),
      lines: Array.from({ length: 51 }, (_, i) => ({ ...input().lines[0], id: String(i) })),
    }).valid,
    false,
  );
  assert.equal(
    calculateProfit({ ...input(), lines: [input().lines[0], input().lines[0]] }).valid,
    false,
  );
  assert.equal(calculateProfit(input(String(MAX_AMOUNT), String(MAX_AMOUNT))).valid, true);
});
test('quote carries only one selling-price line and exposes existing invoice rounding', () => {
  const draft = input('0.80', '1.01');
  draft.lines[0].name = 'SECRET INTERNAL COST';
  const seed = profitToQuote(draft, '客戶專案');
  assert.ok(seed);
  assert.equal(seed.lines.length, 1);
  assert.deepEqual(seed.lines[0], {
    id: 'profit-project',
    name: '客戶專案',
    quantity: '1',
    unitPrice: '1.01',
  });
  assert.equal(seed.priceMode, 'subtotal');
  assert.equal(calculateInvoice(seed.lines, seed.priceMode, seed.taxType).subtotal, 1);
  assert.doesNotMatch(JSON.stringify(seed), /SECRET|成本|毛利|0\.80/);
  assert.equal(profitToQuote(input(), ''), null);
  assert.equal(profitToQuote(input('0', '0'), '專案'), null);
  assert.equal(profitToQuote(input('0', '0.49'), '專案'), null);
  assert.equal(profitToQuote(input('1', String(MAX_AMOUNT)), '專案'), null);
});
