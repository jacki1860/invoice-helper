import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_AMOUNT } from '../src/domain/invoice.ts';
import {
  formatTaiwanDate,
  getInvoicePeriod,
  getTaiwanDate,
  isValidInvoiceDate,
} from '../src/utils/dateUtils.ts';
import { formatChineseAmount, formatChineseAmountText } from '../src/utils/numberUtils.ts';

test('invoice dates validate real calendar days rather than rolling over', () => {
  for (const date of ['2026-09-30', '2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) {
    assert.equal(isValidInvoiceDate(date), true, date);
  }
  for (const date of [
    '',
    '2026-02-29',
    '1900-02-29',
    '2026-02-30',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '2026-1-01',
    '0000-01-01',
    'not-a-date',
    '2026-09-30T00:00:00Z',
  ]) {
    assert.equal(isValidInvoiceDate(date), false, date);
    assert.deepEqual(formatTaiwanDate(date), []);
    assert.equal(getInvoicePeriod(date), '');
  }
});

test('Taiwan today changes at Taipei midnight, independently of the host timezone', () => {
  assert.equal(getTaiwanDate(new Date('2026-09-30T15:59:59Z')), '2026-09-30');
  assert.equal(getTaiwanDate(new Date('2026-09-30T16:00:00Z')), '2026-10-01');
  assert.equal(getTaiwanDate(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(getTaiwanDate(new Date('invalid')), '');
});

test('invoice dates preserve the selected day and correct ROC year and two-month period', () => {
  assert.equal(
    formatTaiwanDate('2026-09-30')
      .map((part) => part.text)
      .join(''),
    '中華民國 115 年 09 月 30 日',
  );
  assert.equal(getInvoicePeriod('2026-09-30'), '一一五年九、十月份');
  assert.equal(getInvoicePeriod('2026-10-31'), '一一五年九、十月份');
  assert.equal(getInvoicePeriod('2026-11-01'), '一一五年十一、十二月份');
  assert.equal(getInvoicePeriod('2027-01-01'), '一一六年一、二月份');
});

test('Chinese amount text uses financial numerals, zero bridges and whole-dollar suffixes', () => {
  const cases = new Map([
    [0, '零元整'],
    [10, '壹拾元整'],
    [1001, '壹仟零壹元整'],
    [11550, '壹萬壹仟伍佰伍拾元整'],
    [10001, '壹萬零壹元整'],
    [100000001, '壹億零壹元整'],
    [100010001, '壹億零壹萬零壹元整'],
    [MAX_AMOUNT, '玖億玖仟玖佰玖拾玖萬玖仟玖佰玖拾玖元整'],
  ]);
  for (const [amount, expected] of cases) {
    assert.equal(formatChineseAmountText(amount), expected, String(amount));
  }
});

test('legacy Chinese digit slots keep valid units and show zero instead of a blank amount', () => {
  const zero = formatChineseAmount(0);
  assert.equal(zero.length, 9);
  assert.deepEqual(
    zero.filter((part) => part.show),
    [{ digit: '零', unit: '', show: true }],
  );
  const maximum = formatChineseAmount(MAX_AMOUNT);
  assert.equal(maximum.length, 9);
  assert.ok(maximum.every((part) => part.digit === '玖' && typeof part.unit === 'string'));
});

test('Chinese amount formatting safely rejects non-integer, negative, non-finite and excessive amounts', () => {
  for (const amount of [-1, 1.5, NaN, Infinity, -Infinity, MAX_AMOUNT + 1]) {
    assert.deepEqual(formatChineseAmount(amount), []);
    assert.equal(formatChineseAmountText(amount), '');
  }
});
