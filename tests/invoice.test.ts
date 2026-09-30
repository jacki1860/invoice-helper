import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateInvoice,
  MAX_AMOUNT,
  MAX_QUANTITY,
  validateAmount,
} from '../src/domain/invoice.ts';
import type { InvoiceLineInput, PriceMode, TaxType } from '../src/domain/invoice.ts';

const line = (unitPrice: string, quantity = '1', id = 'a'): InvoiceLineInput => ({
  id,
  name: `品項 ${id}`,
  unitPrice,
  quantity,
});

test('inclusive prices 10, 100 and 105 preserve the entered total', () => {
  for (const [price, expectedSubtotal, expectedTax] of [
    [10, 10, 0],
    [100, 95, 5],
    [105, 100, 5],
  ]) {
    const result = calculateInvoice([line(String(price))], 'total', 'regular');
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
    assert.equal(result.amount, price);
    assert.equal(result.subtotal, expectedSubtotal);
    assert.equal(result.tax, expectedTax);
    assert.equal(result.lines[0].inputAmount, price);
    assert.equal(result.lines[0].unitPrice, price);
  }
});

test('two inclusive 10-dollar lines total 20 and share the 19-dollar subtotal deterministically', () => {
  const input = [line('10'), line('10', '1', 'b')];
  const result = calculateInvoice(input, 'total', 'regular');
  assert.equal(result.amount, 20);
  assert.equal(result.tax, 1);
  assert.equal(result.subtotal, 19);
  assert.deepEqual(
    result.lines.map((item) => item.subtotal),
    [10, 9],
  );
  assert.deepEqual(calculateInvoice(input, 'total', 'regular'), result);
  assert.deepEqual(
    input.map((item) => item.unitPrice),
    ['10', '10'],
  );
});

test('decimal prices round at the line boundary without binary floating-point drift', () => {
  for (const [price, quantity, expected] of [
    ['0.29', '50', 15],
    ['1.15', '10', 12],
    ['0.10', '5', 1],
    ['0.49', '1', 0],
    ['0.50', '1', 1],
  ] as const) {
    const result = calculateInvoice([line(price, quantity)], 'total', 'regular');
    assert.equal(result.valid, true);
    assert.equal(result.amount, expected);
  }
});

test('exclusive prices round each line first, then round the combined tax once', () => {
  const result = calculateInvoice([line('10'), line('10', '1', 'b')], 'subtotal', 'regular');
  assert.equal(result.subtotal, 20);
  assert.equal(result.tax, 1);
  assert.equal(result.amount, 21);
  const pennies = calculateInvoice([line('0.49'), line('0.49', '1', 'b')], 'subtotal', 'regular');
  assert.equal(pennies.amount, 0);
});

test('zero-rate and exempt invoices have no tax in either price mode', () => {
  for (const priceMode of ['total', 'subtotal'] as const) {
    for (const taxType of ['zero-rate', 'exempt'] as const) {
      const result = calculateInvoice([line('10'), line('100', '2', 'b')], priceMode, taxType);
      assert.equal(result.valid, true);
      assert.equal(result.subtotal, 210);
      assert.equal(result.tax, 0);
      assert.equal(result.amount, 210);
    }
  }
});

test('whole invoice and line subtotals stay consistent across prices, quantities and tax modes', () => {
  const prices = ['0', '0.01', '0.49', '0.50', '1.15', '10', '100', '105', '99999.99'];
  const modes: PriceMode[] = ['total', 'subtotal'];
  const taxes: TaxType[] = ['regular', 'zero-rate', 'exempt'];
  for (const price of prices) {
    for (const quantity of ['1', '2', '7']) {
      for (const mode of modes) {
        for (const taxType of taxes) {
          const result = calculateInvoice(
            [line(price, quantity), line('10', '3', 'b'), line('105', '1', 'c')],
            mode,
            taxType,
          );
          assert.equal(result.valid, true);
          assert.equal(result.subtotal + result.tax, result.amount);
          assert.equal(
            result.lines.reduce((sum, item) => sum + item.subtotal, 0),
            result.subtotal,
          );
          assert.ok(
            result.lines.every((item) => Number.isInteger(item.subtotal) && item.subtotal >= 0),
          );
          if (mode === 'total') {
            assert.equal(
              result.lines.reduce((sum, item) => sum + item.inputAmount, 0),
              result.amount,
            );
            assert.ok(result.lines.every((item) => item.subtotal <= item.inputAmount));
          }
        }
      }
    }
  }
});

test('amount validation accepts zero and up to two decimal places', () => {
  for (const amount of ['0', '0.00', '0.01', '1', '1.2', '1.23', '001.00', String(MAX_AMOUNT)]) {
    assert.equal(validateAmount(amount), null, amount);
  }
});

test('amount validation rejects empty, negative, non-finite, exponent, malformed and excessive values', () => {
  for (const amount of [
    '',
    ' ',
    '-1',
    'Infinity',
    'NaN',
    '1e2',
    '0x10',
    '1.234',
    '1,000',
    '12x',
    '1.',
  ]) {
    assert.ok(validateAmount(amount), amount);
  }
  assert.ok(validateAmount(`${MAX_AMOUNT}.01`));
  assert.ok(validateAmount(String(MAX_AMOUNT + 1)));
});

test('quantity must be a positive integer no greater than MAX_QUANTITY', () => {
  for (const quantity of [
    '',
    '0',
    '-1',
    '1.5',
    '1e2',
    'Infinity',
    '1x',
    String(MAX_QUANTITY + 1),
  ]) {
    const result = calculateInvoice([line('10', quantity)], 'total', 'regular');
    assert.equal(result.valid, false, quantity);
    assert.ok(result.errors['a.quantity']);
    assert.equal(result.lines.length, 0);
  }
  assert.equal(calculateInvoice([line('0', String(MAX_QUANTITY))], 'total', 'regular').valid, true);
});

test('blank rows and an empty invoice report errors instead of being valid zero-dollar invoices', () => {
  const blank = calculateInvoice(
    [{ id: 'a', name: ' ', quantity: '', unitPrice: '' }],
    'total',
    'regular',
  );
  assert.equal(blank.valid, false);
  assert.deepEqual(
    new Set(Object.keys(blank.errors)),
    new Set(['a.name', 'a.quantity', 'a.unitPrice']),
  );
  const empty = calculateInvoice([], 'total', 'regular');
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.total);
  const freeItem = calculateInvoice([line('0')], 'total', 'regular');
  assert.equal(freeItem.valid, true);
  assert.equal(freeItem.amount, 0);
});

test('missing names keep a numeric preview but prevent a valid invoice', () => {
  const result = calculateInvoice([{ ...line('105'), name: '' }], 'total', 'regular');
  assert.equal(result.valid, false);
  assert.equal(result.amount, 105);
  assert.ok(result.errors['a.name']);
});

test('unit prices retain their input precision when no tax conversion is needed', () => {
  for (const [mode, taxType] of [
    ['subtotal', 'regular'],
    ['total', 'zero-rate'],
    ['total', 'exempt'],
  ] as const) {
    const result = calculateInvoice([line('1.15', '10')], mode, taxType);
    assert.equal(result.lines[0].unitPrice, 1.15);
    assert.equal(result.lines[0].unitPriceExcl, 1.15);
    assert.equal(result.lines[0].subtotal, 12);
  }
});

test('the amount cap applies to quantity, combined lines and tax-inclusive final totals', () => {
  const atLimit = calculateInvoice([line(String(MAX_AMOUNT))], 'total', 'regular');
  assert.equal(atLimit.valid, true);
  assert.equal(atLimit.amount, MAX_AMOUNT);
  const exclusiveAtLimit = calculateInvoice([line('952380951')], 'subtotal', 'regular');
  assert.equal(exclusiveAtLimit.valid, true);
  assert.equal(exclusiveAtLimit.amount, MAX_AMOUNT);
  for (const [items, mode] of [
    [[line(String(MAX_AMOUNT), '2')], 'total'],
    [[line(String(MAX_AMOUNT)), line('1', '1', 'b')], 'total'],
    [[line('952380952')], 'subtotal'],
  ] as const) {
    const result = calculateInvoice([...items], mode, 'regular');
    assert.equal(result.valid, false);
    assert.ok(result.errors.total);
    assert.equal(result.amount, 0);
    assert.equal(result.lines.length, 0);
  }
});
