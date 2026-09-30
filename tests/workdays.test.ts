import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countWorkdays,
  shiftWorkdays,
  defaultWorkdayOptions,
  workdaySummary,
  type WorkdayOptions,
} from '../src/domain/workdays.ts';

const government = defaultWorkdayOptions;
const custom: WorkdayOptions = {
  calendar: 'custom',
  restWeekdays: [0, 6],
  excludeHolidays: false,
  excludeSubstitutes: false,
};

test('government mode counts every official day once, matching published full-year totals', () => {
  for (const [year, count] of [
    [2026, 245],
    [2027, 244],
  ]) {
    const result = countWorkdays(`${year}-01-01`, `${year}-12-31`, true, government);
    assert.equal(result.valid, true);
    assert.equal(result.workdays, count);
    assert.equal(result.calendarDays, 365);
    assert.equal(
      result.workdays + result.restDays + result.holidayDays + result.substituteDays,
      365,
    );
    assert.equal(new Set(result.entries.map((entry) => entry.date)).size, 365);
  }
});

test('holiday overlapping a weekend is excluded once; government and custom workweeks differ', () => {
  const result = countWorkdays('2026-02-14', '2026-02-23', true, government);
  assert.equal(result.workdays, 1);
  assert.equal(result.calendarDays, 10);
  assert.equal(result.entries.find((day) => day.date === '2026-02-15')?.reason, 'holiday');
  assert.equal(result.entries.find((day) => day.date === '2026-02-20')?.reason, 'substitute');
  assert.equal(countWorkdays('2026-02-14', '2026-02-23', true, custom).workdays, 6);
  assert.equal(
    countWorkdays('2026-02-20', '2026-02-20', true, { ...custom, excludeHolidays: true }).workdays,
    1,
  );
  assert.equal(
    countWorkdays('2026-02-20', '2026-02-20', true, { ...custom, excludeSubstitutes: true })
      .workdays,
    0,
  );
});

test('same-day and interval boundary choices are explicit', () => {
  assert.equal(countWorkdays('2026-09-30', '2026-09-30', true, government).workdays, 1);
  const excluded = countWorkdays('2026-09-30', '2026-09-30', false, government);
  assert.equal(excluded.valid, true);
  assert.equal(excluded.calendarDays, 0);
  assert.equal(countWorkdays('2026-09-30', '2026-10-02', false, government).workdays, 2);
  assert.equal(countWorkdays('2026-10-01', '2026-09-30', true, government).valid, false);
});

test('forward and backward shifts skip holidays and never include the starting date', () => {
  assert.equal(shiftWorkdays('2026-02-13', '1', 'forward', government).end, '2026-02-23');
  assert.equal(shiftWorkdays('2027-01-04', '1', 'backward', government).end, '2026-12-31');
  assert.equal(shiftWorkdays('2026-12-31', '1', 'forward', government).end, '2027-01-04');
  const zero = shiftWorkdays('2026-02-15', '0', 'backward', government);
  assert.equal(zero.end, '2026-02-15');
  assert.equal(zero.calendarDays, 0);
  const negative = shiftWorkdays('2026-10-05', '3', 'backward', custom);
  assert.equal(negative.end, '2026-09-30');
  assert.equal(negative.workdays, 3);
  assert.deepEqual(
    negative.entries.map((day) => day.date),
    ['2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01', '2026-09-30'],
  );
});

test('official dates cannot be extrapolated into unsupported years, even across a shift', () => {
  assert.equal(countWorkdays('2025-12-31', '2026-01-02', true, government).valid, false);
  assert.equal(shiftWorkdays('2027-12-30', '1', 'forward', government).valid, false);
  assert.equal(shiftWorkdays('2026-01-01', '1', 'backward', government).valid, false);
  assert.equal(
    countWorkdays('2028-01-01', '2028-01-03', true, { ...custom, excludeHolidays: true }).valid,
    false,
  );
  assert.equal(countWorkdays('2028-01-01', '2028-01-03', true, custom).valid, true);
});

test('custom weekdays handle no-rest and all-rest schedules with finite searches', () => {
  const daily = { ...custom, restWeekdays: [] };
  assert.equal(shiftWorkdays('2028-02-28', '1', 'forward', daily).end, '2028-02-29');
  const off = { ...custom, restWeekdays: [0, 1, 2, 3, 4, 5, 6] };
  assert.equal(countWorkdays('2028-02-28', '2028-03-01', true, off).workdays, 0);
  assert.equal(shiftWorkdays('2028-02-28', '1', 'forward', off).valid, false);
  assert.equal(shiftWorkdays('2028-02-28', '0', 'forward', off).valid, true);
  assert.match(shiftWorkdays('2028-01-01', '3660', 'forward', custom).error, /3,660/);
});

test('bad dates, invalid counts and out-of-bounds values fail clearly', () => {
  for (const date of ['', '2026-02-29', '2026-13-01', '0000-01-01', '2026-2-01'])
    assert.equal(countWorkdays(date, '2026-12-31', true, government).valid, false, date);
  for (const count of ['', '-1', '1.5', '1e2', 'Infinity', '999999999999999999999'])
    assert.equal(shiftWorkdays('2026-09-30', count, 'forward', custom).valid, false, count);
  assert.equal(countWorkdays('2026-01-01', '2040-01-01', true, custom).valid, false);
  assert.equal(shiftWorkdays('9999-12-31', '1', 'forward', custom).valid, false);
  assert.equal(shiftWorkdays('0001-01-01', '1', 'backward', custom).valid, false);
  assert.equal(
    countWorkdays('2026-09-30', '2026-10-01', true, { ...custom, restWeekdays: [7] }).valid,
    false,
  );
});

test('calendar-day iteration is stable through leap days and DST boundaries', () => {
  const daily = { ...custom, restWeekdays: [] };
  assert.deepEqual(
    countWorkdays('2028-02-28', '2028-03-01', true, daily).entries.map((entry) => entry.date),
    ['2028-02-28', '2028-02-29', '2028-03-01'],
  );
  assert.equal(countWorkdays('2026-03-07', '2026-03-10', true, daily).calendarDays, 4);
  assert.equal(countWorkdays('2026-10-31', '2026-11-03', true, daily).calendarDays, 4);
  assert.equal(countWorkdays('0001-01-01', '0001-01-01', true, daily).entries[0].weekday, 1);
});

test('copy output records selected rules, boundaries, complete daily evidence and scope', () => {
  const result = countWorkdays('2026-09-25', '2026-09-30', true, government);
  const text = workdaySummary(result, government, '包含開始日、包含結束日');
  assert.match(text, /包含開始日/);
  assert.match(text, /政府行政機關/);
  assert.match(text, /2026-09-25（五） 中秋節/);
  assert.match(text, /依所選規則/);
  assert.equal(workdaySummary(countWorkdays('', '', true, government), government, ''), '');
});
