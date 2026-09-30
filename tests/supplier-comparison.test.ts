import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSuppliers,
  comparisonText,
  supplierToPurchase,
  type ComparisonItem,
  type SupplierOffer,
} from '../src/domain/supplierComparison.ts';
import { calculateInvoice, MAX_AMOUNT } from '../src/domain/invoice.ts';

const items: ComparisonItem[] = [{ id: 'one', name: '共用品項', quantity: '2' }];
const offer = (id: string, patch: Partial<SupplierOffer> = {}): SupplierOffer => ({
  id,
  name: `廠商 ${id}`,
  contact: '',
  prices: { one: '100.00' },
  priceMode: 'subtotal',
  taxType: 'regular',
  shipping: '0',
  deliveryDate: '',
  leadTime: '',
  warranty: '',
  paymentTerms: '',
  ...patch,
});
test('mixed inclusive/exclusive supplier inputs normalize to the same payable total with shipping', () => {
  const result = compareSuppliers(items, [
    offer('a', { shipping: '10' }),
    offer('b', { priceMode: 'total', prices: { one: '105.00' }, shipping: '10' }),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.lowestGross, 220);
  for (const row of result.suppliers) {
    assert.equal(row.productsGross, 210);
    assert.equal(row.shippingGross, 10);
    assert.equal(row.calculation?.amount, 220);
    assert.equal(row.calculation?.subtotal, 210);
    assert.equal(row.calculation?.tax, 10);
    assert.equal(row.difference, 0);
  }
});
test('zero rate and exempt inputs add no tax, shipping remains inclusive and rounded once', () => {
  for (const taxType of ['zero-rate', 'exempt'] as const) {
    const result = compareSuppliers(items, [
      offer('a', { taxType, shipping: '10.50' }),
      offer('b', { shipping: '0' }),
    ]);
    assert.equal(result.suppliers[0].calculation?.amount, 211);
    assert.equal(result.suppliers[0].calculation?.tax, 0);
    assert.equal(result.lowestGross, 210);
    assert.equal(result.suppliers[0].difference, 1);
  }
});
test('invalid vendor never becomes cheapest or produces a purchase seed', () => {
  for (const patch of [
    { prices: { one: '' } },
    { prices: { one: '-1' } },
    { shipping: '-1' },
    { shipping: '1.001' },
    { name: '' },
    { deliveryDate: '2026-02-30' },
  ]) {
    const offers = [offer('bad', patch), offer('good')];
    const result = compareSuppliers(items, offers);
    assert.equal(result.valid, false);
    assert.equal(result.lowestGross, 210);
    assert.equal(result.suppliers[0].calculation, null);
    assert.equal(result.suppliers[0].difference, null);
    assert.equal(result.suppliers[1].difference, 0);
    assert.equal(supplierToPurchase(items, offers, 'bad'), null);
    assert.ok(supplierToPurchase(items, offers, 'good'));
    assert.equal(comparisonText(items, offers), '');
  }
});
test('common count, quantity, identifiers and amount limits cannot be bypassed', () => {
  const offers = [offer('a'), offer('b')];
  for (const quantity of ['0', '-1', '1.5', '10000', 'NaN', ''])
    assert.equal(compareSuppliers([{ ...items[0], quantity }], offers).lowestGross, null, quantity);
  assert.equal(compareSuppliers([{ ...items[0], name: '' }], offers).valid, false);
  assert.equal(compareSuppliers([], offers).valid, false);
  assert.equal(
    compareSuppliers(
      Array.from({ length: 21 }, (_, i) => ({ ...items[0], id: String(i) })),
      offers,
    ).valid,
    false,
  );
  assert.equal(compareSuppliers(items, [offer('a')]).valid, false);
  assert.equal(
    compareSuppliers(
      items,
      Array.from({ length: 6 }, (_, i) => offer(String(i))),
    ).valid,
    false,
  );
  assert.equal(compareSuppliers(items, [offer('a'), offer('a')]).valid, false);
  assert.equal(compareSuppliers([items[0], items[0]], offers).valid, false);
  const over = compareSuppliers(
    [{ ...items[0], quantity: '1' }],
    [
      offer('a', { priceMode: 'total', prices: { one: String(MAX_AMOUNT) }, shipping: '1' }),
      offer('b'),
    ],
  );
  assert.equal(over.suppliers[0].valid, false);
  assert.equal(over.suppliers[0].calculation, null);
});
test('purchase handoff preserves total, original quantities and two-decimal prices including NT$10 cases', () => {
  for (const quantity of ['1', '3', '7', '101', '9999']) {
    for (const unitPrice of ['0.01', '0.10', '1.23', '10.00', '100.01']) {
      for (const priceMode of ['total', 'subtotal'] as const) {
        for (const taxType of ['regular', 'zero-rate', 'exempt'] as const) {
          const common = [
            { ...items[0], quantity },
            { id: 'two', name: '第二品項', quantity: '7' },
          ];
          const offers = [
            offer('a', {
              priceMode,
              taxType,
              prices: { one: unitPrice, two: '0.70' },
              shipping: '10.01',
              leadTime: '七天',
              warranty: '一年',
              paymentTerms: '到貨付款',
            }),
            offer('b', { prices: { one: '10', two: '0.5' } }),
          ];
          const before = JSON.stringify({ common, offers });
          const result = compareSuppliers(common, offers).suppliers[0];
          const seed = supplierToPurchase(common, offers, 'a');
          assert.ok(seed);
          const transferred = calculateInvoice(seed.lines, seed.priceMode, seed.taxType);
          assert.equal(transferred.valid, true);
          assert.equal(transferred.amount, result.calculation?.amount);
          assert.equal(transferred.subtotal, result.calculation?.subtotal);
          assert.equal(transferred.tax, result.calculation?.tax);
          assert.equal(seed.lines.length, 3);
          assert.equal(seed.lines[0].quantity, '1');
          assert.ok(seed.lines[0].name.includes(`原數量 ${quantity}；批次`));
          assert.ok(seed.notes.includes(`單價 NT$ ${unitPrice}`));
          assert.ok(seed.notes.includes('原含稅運費 NT$ 10.01'));
          assert.ok(
            seed.notes.includes('七天') &&
              seed.notes.includes('一年') &&
              seed.notes.includes('到貨付款'),
          );
          assert.equal(seed.lines.at(-1)?.name, '運費（含稅）');
          assert.equal(seed.lines.at(-1)?.unitPrice, '10');
          assert.equal(JSON.stringify({ common, offers }), before);
        }
      }
    }
  }
});
test('large non-divisible inclusive quantities transfer via batches rather than losing whole dollars', () => {
  const common = [{ ...items[0], quantity: '9999' }];
  const offers = [
    offer('a', { prices: { one: '0.01' }, priceMode: 'subtotal', shipping: '10' }),
    offer('b'),
  ];
  const result = compareSuppliers(common, offers).suppliers[0];
  assert.equal(result.productsGross, 105);
  const seed = supplierToPurchase(common, offers, 'a');
  assert.ok(seed);
  assert.equal(seed.lines[0].unitPrice, '105');
  assert.equal(calculateInvoice(seed.lines, seed.priceMode, seed.taxType).amount, 115);
});
test('zero-priced valid suppliers tie without division by zero or automatic selection', () => {
  const offers = [offer('a', { prices: { one: '0' } }), offer('b', { prices: { one: '0' } })];
  const result = compareSuppliers(items, offers);
  assert.equal(result.valid, true);
  assert.equal(result.lowestGross, 0);
  assert.equal(result.suppliers[0].difference, 0);
  assert.equal(result.suppliers[1].difference, 0);
  assert.equal(supplierToPurchase(items, offers, 'missing'), null);
  assert.doesNotMatch(comparisonText(items, offers), /NaN|Infinity/);
});
