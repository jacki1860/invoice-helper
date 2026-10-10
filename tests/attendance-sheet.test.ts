import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attendanceRawLimitError,
  attendanceSheetResult,
  attendanceSheetText,
  emptyAttendanceSheet,
  exampleAttendanceSheet,
  type AttendanceSheetDraft,
} from '../src/features/tools/attendanceSheet.ts';

const draft = (patch: Partial<AttendanceSheetDraft> = {}): AttendanceSheetDraft => ({
  title: '交流工作坊',
  date: '2026-10-09',
  venue: '',
  organizer: '',
  totalRowsRaw: '20',
  namesRaw: '',
  ...patch,
});
const validSheet = (input: AttendanceSheetDraft) => {
  const result = attendanceSheetResult(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.sheet);
  return result.sheet;
};
const invalidSheet = (input: AttendanceSheetDraft) => {
  const copy = structuredClone(input);
  Object.freeze(input);
  const result = attendanceSheetResult(input);
  assert.equal(result.valid, false);
  assert.equal(result.sheet, null);
  assert.ok(result.errors.length);
  assert.equal(attendanceSheetText(result), '');
  assert.deepEqual(input, copy);
};

test('21 names retain order and duplicates, skip blank lines, trim display and cross pages at row 21', () => {
  const names = ['林小青', '林小青', ...Array.from({ length: 19 }, (_, i) => `姓名${i + 3}`)];
  const input = draft({
    totalRowsRaw: '21',
    namesRaw: `  ${names[0]}  \r\n\r\n${names.slice(1).join('\r')}`,
  });
  const original = structuredClone(input);
  const sheet = validSheet(input);
  assert.equal(sheet.namedRows, 21);
  assert.deepEqual(
    sheet.pages.map((page) => page.length),
    [20, 1],
  );
  assert.deepEqual(
    sheet.pages.flat().map((row) => row.name),
    names,
  );
  assert.deepEqual(
    sheet.pages.flat().map((row) => row.number),
    Array.from({ length: 21 }, (_, i) => i + 1),
  );
  assert.deepEqual(input, original);
});

test('1 to 100 rows are partitioned into at most five pages, with blank handwriting rows after names', () => {
  for (const totalRows of [1, 20, 21, 40, 41, 99, 100]) {
    const sheet = validSheet(draft({ totalRowsRaw: String(totalRows), namesRaw: '第一位' }));
    assert.equal(sheet.pages.length, Math.ceil(totalRows / 20));
    assert.equal(sheet.pages.flat().length, totalRows);
    assert.equal(sheet.pages.flat().at(-1)?.number, totalRows);
    assert.deepEqual(
      sheet.pages
        .flat()
        .slice(1)
        .map((row) => row.name),
      Array(totalRows - 1).fill(''),
    );
  }
  assert.equal(validSheet(draft()).namedRows, 0);
});

test('invalid row syntax, name counts, title and date reject every output without changing raw text', () => {
  for (const totalRowsRaw of [
    '',
    '0',
    '101',
    '1.5',
    '-1',
    '+1',
    '1e2',
    '１',
    '20\n',
    ' 20',
    '99999999999999999',
  ])
    invalidSheet(draft({ totalRowsRaw }));
  for (const title of ['', ' ', '活動\n名稱', '活動\t名稱', '長'.repeat(81), '😀'.repeat(81)])
    invalidSheet(draft({ title }));
  for (const date of [
    '',
    '2026-02-29',
    '1900-02-29',
    '0000-01-01',
    '10000-01-01',
    '2026-04-31',
    '2026-1-01',
    '2026-10-09\n',
  ])
    invalidSheet(draft({ date }));
  invalidSheet(draft({ totalRowsRaw: '1', namesRaw: '甲\n甲' }));
  invalidSheet(draft({ totalRowsRaw: '100', namesRaw: Array(101).fill('甲').join('\n') }));
  for (const date of ['0001-01-01', '9999-12-31', '2000-02-29'])
    assert.equal(validSheet(draft({ date })).date, date);
});

test('raw limits include empty lines and code points without silently truncating content', () => {
  assert.equal(attendanceRawLimitError('😀'.repeat(10_000)), '');
  assert.match(attendanceRawLimitError('😀'.repeat(10_001)), /10,000/);
  assert.equal(attendanceRawLimitError('\n'.repeat(999)), '');
  assert.equal(attendanceRawLimitError('\r\n'.repeat(999)), '');
  assert.match(attendanceRawLimitError('\n'.repeat(1000)), /1,000/);
  invalidSheet(draft({ namesRaw: ' '.repeat(10_001) }));
  invalidSheet(draft({ namesRaw: '\n'.repeat(1000) }));
  assert.equal(validSheet(draft({ namesRaw: '\n'.repeat(999) })).namedRows, 0);
});

test('field and name limits count original Unicode points, and controls are not trimmed away', () => {
  const sheet = validSheet(
    draft({
      title: '😀'.repeat(80),
      venue: '地'.repeat(80),
      organizer: '組'.repeat(80),
      namesRaw: '😀'.repeat(24),
    }),
  );
  assert.equal(sheet.pages[0][0].name, '😀'.repeat(24));
  for (const namesRaw of [
    '😀'.repeat(25),
    ` ${'名'.repeat(23)} `,
    '王\t明',
    '王\u0000明',
    '王\u2028明',
    '\t王明',
  ])
    invalidSheet(draft({ namesRaw }));
  for (const field of ['title', 'venue', 'organizer'] as const) {
    invalidSheet(draft({ [field]: '字'.repeat(81) }));
    for (const control of ['\n', '\r', '\t', '\u0000', '\u0085', '\u2028', '\u2029'])
      invalidSheet(draft({ [field]: `前${control}後` }));
  }
});

test('full text repeats metadata and page numbers, includes every row, and keeps handwriting columns blank', () => {
  const result = attendanceSheetResult(
    draft({
      totalRowsRaw: '100',
      namesRaw: '林小青\n林小青',
      venue: '一樓',
      organizer: '交流小組',
    }),
  );
  const text = attendanceSheetText(result);
  assert.equal(text.split('活動名稱：交流工作坊').length - 1, 5);
  assert.equal(text.split('活動日期：2026-10-09').length - 1, 5);
  assert.equal(text.split('主辦單位：交流小組').length - 1, 5);
  assert.equal(text.split('活動地點：一樓').length - 1, 5);
  assert.ok(text.includes('第 5 / 5 頁'));
  assert.ok(text.includes('1\t林小青\t\t\t\n2\t林小青\t\t\t'));
  assert.ok(text.endsWith('100\t\t\t\t'));
  assert.equal(text.split('\n').filter((line) => /^\d+\t/.test(line)).length, 100);
});

test('defaults and example produce expected blank and filled states without storage', () => {
  const empty = emptyAttendanceSheet();
  assert.equal(empty.title, '');
  assert.equal(empty.namesRaw, '');
  assert.equal(empty.totalRowsRaw, '20');
  assert.equal(attendanceSheetResult(empty).valid, false);
  assert.equal(attendanceSheetResult(exampleAttendanceSheet()).valid, true);
});
