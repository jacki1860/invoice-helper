import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkdaysCsv,
  countWorkdays,
  getWorkdaysCsvFilename,
  shiftWorkdays,
  defaultWorkdayOptions,
  workdaySummary,
  type WorkdayOptions,
  type WorkdayResult,
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

function parseCsv(csv: string): string[][] {
  assert.equal(csv.charCodeAt(0), 0xfeff, 'UTF-8 BOM is required');
  assert.deepEqual(new TextEncoder().encode(csv).slice(0, 3), new Uint8Array([0xef, 0xbb, 0xbf]));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 1; index < csv.length; index++) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && character === '\r') {
      assert.equal(csv[++index], '\n', 'Each CSV record must end in CRLF');
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      assert.ok(quoted || character !== '\n', 'An unquoted bare newline is invalid');
      field += character;
    }
  }
  assert.equal(quoted, false, 'Quoted fields must be closed');
  assert.equal(field, '', 'The last record must end in CRLF');
  assert.deepEqual(row, []);
  assert.ok(rows.every((columns) => columns.length === 4));
  return rows;
}

function expectCsvEntries(result: WorkdayResult): string[][] {
  const rows = parseCsv(buildWorkdaysCsv(result));
  assert.deepEqual(rows[0], ['日期', '星期', '是否工作日', '計算依據']);
  assert.deepEqual(
    rows.slice(1),
    result.entries.map((day) => [
      day.date,
      `星期${'日一二三四五六'[day.weekday]}`,
      day.working ? '是' : '否',
      day.label,
    ]),
  );
  return rows.slice(1);
}

test('CSV includes all 365 entries beyond the 31-row display page without changing calculation or copy output', () => {
  const result = countWorkdays('2026-01-01', '2026-12-31', true, government);
  const before = structuredClone(result);
  const summary = workdaySummary(result, government, '包含開始日、包含結束日');
  const rows = expectCsvEntries(result);
  assert.equal(rows.length, 365);
  assert.deepEqual(rows[0], ['2026-01-01', '星期四', '否', '開國紀念日']);
  assert.deepEqual(rows[1], ['2026-01-02', '星期五', '是', '工作日']);
  assert.equal(rows[31][0], '2026-02-01');
  assert.equal(rows.at(-1)?.[0], '2026-12-31');
  assert.equal(rows.filter((row) => row[2] === '是').length, 245);
  assert.equal(getWorkdaysCsvFilename(result), 'workdays-2026-01-01-to-2026-12-31.csv');
  assert.deepEqual(result, before);
  assert.equal(workdaySummary(result, government, '包含開始日、包含結束日'), summary);
  assert.ok(rows.flat().every((cell) => !/^\s*[=+@-]/u.test(cell)));
});

test('CSV preserves forward and backward cross-year traversal and the original calculation boundaries', () => {
  const forward = shiftWorkdays('2026-12-31', '1', 'forward', government);
  const backward = shiftWorkdays('2027-01-04', '1', 'backward', government);
  assert.deepEqual(
    expectCsvEntries(forward).map((row) => row[0]),
    ['2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04'],
  );
  assert.deepEqual(
    expectCsvEntries(backward).map((row) => row[0]),
    ['2027-01-03', '2027-01-02', '2027-01-01', '2026-12-31'],
  );
  assert.deepEqual(
    expectCsvEntries(forward).map((row) => row[2]),
    ['否', '否', '否', '是'],
  );
  assert.deepEqual(
    expectCsvEntries(backward).map((row) => row[2]),
    ['否', '否', '否', '是'],
  );
  assert.equal(getWorkdaysCsvFilename(forward), 'workdays-2026-12-31-to-2027-01-04.csv');
  assert.equal(getWorkdaysCsvFilename(backward), 'workdays-2027-01-04-to-2026-12-31.csv');
  const excluded = countWorkdays('2026-09-30', '2026-10-02', false, government);
  assert.equal(expectCsvEntries(excluded)[0][0], '2026-10-01');
  assert.equal(getWorkdaysCsvFilename(excluded), 'workdays-2026-09-30-to-2026-10-02.csv');
});

test('CSV reflects custom workweeks and leap days without substituting government rules', () => {
  const customWeek = { ...custom, restWeekdays: [1] };
  const result = countWorkdays('2028-02-28', '2028-03-01', true, customWeek);
  assert.deepEqual(expectCsvEntries(result), [
    ['2028-02-28', '星期一', '否', '例行休息日'],
    ['2028-02-29', '星期二', '是', '工作日'],
    ['2028-03-01', '星期三', '是', '工作日'],
  ]);
  const allRest = countWorkdays('2028-02-28', '2028-03-01', true, {
    ...custom,
    restWeekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.deepEqual(
    expectCsvEntries(allRest).map((row) => row[2]),
    ['否', '否', '否'],
  );
});

test('CSV uses standard quote escaping and rejects invalid, empty or formula-like records', () => {
  const result = countWorkdays('2026-01-02', '2026-01-02', true, government);
  const escaped = structuredClone(result);
  escaped.entries[0].label = '測試,"引號"\r\n第二行';
  assert.deepEqual(expectCsvEntries(escaped), [
    ['2026-01-02', '星期五', '是', '測試,"引號"\r\n第二行'],
  ]);
  for (const invalid of [
    countWorkdays('', '', true, government),
    countWorkdays('2026-09-30', '2026-09-30', false, government),
    shiftWorkdays('2026-09-30', '0', 'forward', government),
    shiftWorkdays('2026-09-30', '-1', 'backward', government),
  ]) {
    assert.throws(() => buildWorkdaysCsv(invalid), /沒有有效的逐日明細/);
    assert.throws(() => getWorkdaysCsvFilename(invalid), /沒有有效的逐日明細/);
  }
  for (const label of ['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1:A2)', '\t=1', ' \r\n=1']) {
    const unsafe = { ...result, entries: [{ ...result.entries[0], label }] };
    assert.throws(() => buildWorkdaysCsv(unsafe), /不支援的試算表內容/);
  }
  for (const patch of [{ date: '=1+1' }, { weekday: 7 }, { weekday: NaN }]) {
    assert.throws(
      () => buildWorkdaysCsv({ ...result, entries: [{ ...result.entries[0], ...patch }] }),
      /明細資料無效/,
    );
  }
});
