import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarRangeError,
  calendarRangeMax,
  calendarRangeMin,
  calendarToWorkdays,
  selectCalendarDate,
} from '../src/features/tools/calendarHandoff.ts';
import { countWorkdays, defaultWorkdayOptions } from '../src/domain/workdays.ts';

test('calendar transfer accepts the snapshot boundaries, same-day and cross-month/year ranges', () => {
  assert.equal(calendarRangeMin, '2026-01-01');
  assert.equal(calendarRangeMax, '2027-12-31');
  for (const [start, end, days, workdays] of [
    ['2026-01-01', '2026-01-01', 1, 0],
    ['2027-12-31', '2027-12-31', 1, 0],
    ['2026-09-30', '2026-10-02', 3, 3],
    ['2026-12-31', '2027-01-04', 5, 2],
    ['2026-01-01', '2027-12-31', 730, 489],
  ] as const) {
    const range = { start, end };
    const seed = calendarToWorkdays(range);
    assert.deepEqual(seed, range);
    assert.notEqual(seed, range, 'Transfer owns a separate object');
    assert.equal(calendarRangeError(range), '');
    const result = countWorkdays(seed!.start, seed!.end, true, defaultWorkdayOptions);
    assert.equal(result.valid, true);
    assert.equal(result.calendarDays, days);
    assert.equal(result.workdays, workdays);
  }
});

test('calendar transfer rejects incomplete, impossible, reversed and unsupported dates', () => {
  for (const [start, end, message] of [
    ['', '2026-10-02', /有效/],
    ['2026-09-30', '', /有效/],
    ['2026-02-29', '2026-03-01', /有效/],
    ['2026-02-30', '2026-03-01', /有效/],
    ['2026-2-01', '2026-03-01', /有效/],
    ['2026-10-02', '2026-09-30', /不可早於/],
    ['2025-12-31', '2026-01-01', /已核對日曆範圍/],
    ['2027-12-31', '2028-01-01', /已核對日曆範圍/],
    ['2028-01-01', '2028-01-01', /已核對日曆範圍/],
  ] as const) {
    assert.equal(calendarToWorkdays({ start, end }), null);
    assert.match(calendarRangeError({ start, end }), message);
  }
});

test('date clicks select two boundaries without normalizing reversed dates or mutating a draft', () => {
  const blank = { start: '', end: '' };
  const first = selectCalendarDate(blank, '2026-09-30');
  assert.deepEqual(first, { start: '2026-09-30', end: '' });
  assert.deepEqual(blank, { start: '', end: '' });
  assert.deepEqual(selectCalendarDate(first, '2026-09-30'), {
    start: '2026-09-30',
    end: '2026-09-30',
  });
  const reversed = selectCalendarDate(first, '2026-09-29');
  assert.equal(calendarToWorkdays(reversed), null);
  assert.deepEqual(selectCalendarDate(reversed, '2026-12-31'), {
    start: '2026-12-31',
    end: '',
  });
  const crossYear = selectCalendarDate({ start: '2026-12-31', end: '' }, '2027-01-04');
  assert.deepEqual(calendarToWorkdays(crossYear), { start: '2026-12-31', end: '2027-01-04' });
});

test('calendar dates produce different results under preserved government and custom workweeks', () => {
  const seed = calendarToWorkdays({ start: '2026-02-14', end: '2026-02-23' })!;
  const custom = {
    calendar: 'custom' as const,
    restWeekdays: [0, 6],
    excludeHolidays: false,
    excludeSubstitutes: false,
  };
  const previous = structuredClone(custom);
  assert.equal(countWorkdays(seed.start, seed.end, true, defaultWorkdayOptions).workdays, 1);
  assert.equal(countWorkdays(seed.start, seed.end, true, custom).workdays, 6);
  assert.deepEqual(custom, previous);
  assert.deepEqual(seed, { start: '2026-02-14', end: '2026-02-23' });
});
