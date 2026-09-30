import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitPayment,
  calculateHourly,
  rocToGregorian,
  gregorianToRoc,
} from '../src/domain/adminTools.ts';
import { resolvePage } from '../src/features/tools/catalog.ts';

test('installments and equal shares preserve every dollar with deterministic remainder', () => {
  assert.deepEqual(splitPayment('10001', ['30', '40', '30']).amounts, [3000, 4001, 3000]);
  assert.deepEqual(splitPayment('100', 3).amounts, [34, 33, 33]);
  assert.deepEqual(splitPayment('3', ['0', '50', '50']).amounts, [0, 2, 1]);
  for (let amount = 0; amount <= 100; amount++) {
    for (let count = 2; count <= 12; count++) {
      const result = splitPayment(String(amount), count);
      assert.equal(result.valid, true);
      assert.equal(
        result.amounts.reduce((sum, value) => sum + value, 0),
        amount,
      );
      assert.ok(Math.max(...result.amounts) - Math.min(...result.amounts) <= 1);
    }
  }
});

test('split rejects missing, negative, decimal totals, invalid percentages and counts', () => {
  for (const input of ['', '-1', '1.5', '1e3', '1000000000', 'NaN'])
    assert.equal(splitPayment(input, 3).valid, false);
  for (const shares of [
    1,
    101,
    2.5,
    NaN,
    ['30', '30'],
    ['-1', '101'],
    ['', '100'],
    ['99.999', '0.001'],
  ])
    assert.equal(splitPayment('100', shares).valid, false);
  assert.deepEqual(splitPayment('10000', ['33.33', '33.33', '33.34']).amounts, [3333, 3333, 3334]);
});

const work = (overrides = {}) => ({
  id: 'a',
  name: '工作',
  hours: '1',
  minutes: '30',
  rate: '1200',
  ...overrides,
});
test('hourly calculation handles minutes and rounds individual line cents before summing', () => {
  const result = calculateHourly([work(), work({ id: 'b', hours: '0', minutes: '1', rate: '1' })]);
  assert.equal(result.valid, true);
  assert.equal(result.minutes, 91);
  assert.equal(result.cents, 180002);
  assert.equal(calculateHourly([work({ hours: '0', minutes: '30', rate: '0.01' })]).cents, 1);
});

test('hourly calculation rejects invalid inputs, zero time and excessive totals', () => {
  for (const input of [
    work({ hours: '-1' }),
    work({ hours: '' }),
    work({ minutes: '60' }),
    work({ minutes: '1.5' }),
    work({ rate: '-1' }),
    work({ rate: '1e3' }),
    work({ name: ' ' }),
    work({ hours: '0', minutes: '0' }),
    work({ hours: '2', rate: '999999999' }),
  ])
    assert.equal(calculateHourly([input]).valid, false);
  assert.equal(calculateHourly([]).valid, false);
});

test('ROC date conversions cover leap days and no-year-zero boundary', () => {
  assert.equal(rocToGregorian('113', '2', '29'), '2024-02-29');
  assert.equal(rocToGregorian('114', '2', '29'), null);
  assert.equal(rocToGregorian('0', '1', '1'), null);
  assert.equal(rocToGregorian('1', '1', '1', true), '1911-01-01');
  assert.equal(rocToGregorian('1911', '1', '1', true), '0001-01-01');
  assert.equal(rocToGregorian('1912', '1', '1', true), null);
  assert.deepEqual(gregorianToRoc('1912-01-01'), { year: 1, month: 1, day: 1, before: false });
  assert.deepEqual(gregorianToRoc('1911-12-31'), { year: 1, month: 12, day: 31, before: true });
  assert.equal(gregorianToRoc('2026-02-29'), null);
  assert.equal(gregorianToRoc('0000-01-01'), null);
});

test('new tool routes preserve old invoice deep links and query prefill', () => {
  assert.equal(resolvePage('#calendar'), 'calendar');
  assert.equal(resolvePage('#category-reference'), 'category-reference');
  assert.equal(resolvePage('#invoice'), 'invoice');
  assert.equal(resolvePage('', '?amount=100&itemName=test'), 'invoice');
  assert.equal(resolvePage(''), 'tools');
  assert.equal(resolvePage('#unknown'), 'tools');
});
