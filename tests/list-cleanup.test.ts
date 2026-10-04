import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupList,
  MAX_LIST_CODE_POINTS,
  MAX_LIST_ROWS,
} from '../src/features/tools/listCleanup.ts';

test('cleanup trims edges, drops blank and duplicate rows, and preserves first occurrence order', () => {
  assert.deepEqual(cleanupList('  甲公司\n乙公司\n\n甲公司\n丙公司  \n乙公司'), {
    valid: true,
    text: '甲公司\n乙公司\n丙公司',
    items: ['甲公司', '乙公司', '丙公司'],
    inputRows: 6,
    keptRows: 3,
    blankRows: 1,
    duplicateRows: 2,
  });
});

test('CRLF and CR delimit rows, with trailing newline counted and output normalized to LF', () => {
  const result = cleanupList('甲\r\n乙\r甲\n\r\n');
  assert.deepEqual(result, {
    valid: true,
    text: '甲\n乙',
    items: ['甲', '乙'],
    inputRows: 5,
    keptRows: 2,
    blankRows: 2,
    duplicateRows: 1,
  });
});

test('case, width, Unicode representation, leading zero and interior whitespace stay distinct', () => {
  const items = ['ABC', 'abc', 'ＡＢＣ', '001', '1', '甲 乙', '甲  乙', '甲\t乙', 'é', 'e\u0301'];
  const result = cleanupList(items.join('\n'));
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.items, items);
  assert.equal(result.duplicateRows, 0);
});

test('commas and quotes are ordinary text, without CSV or semantic parsing', () => {
  const result = cleanupList('"甲,乙"\n甲,乙\n乙,甲\n"甲,乙"');
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.text, '"甲,乙"\n甲,乙\n乙,甲');
  assert.equal(result.duplicateRows, 1);
});

test('empty input has zero rows and all whitespace rows have no exportable content', () => {
  assert.deepEqual(cleanupList(''), {
    valid: true,
    text: '',
    items: [],
    inputRows: 0,
    keptRows: 0,
    blankRows: 0,
    duplicateRows: 0,
  });
  assert.deepEqual(cleanupList(' \n\t\r\n\u3000\r'), {
    valid: true,
    text: '',
    items: [],
    inputRows: 4,
    keptRows: 0,
    blankRows: 4,
    duplicateRows: 0,
  });
});

test('100000 code points are accepted, including astral characters, and overflow rejects all output', () => {
  for (const character of ['甲', '😀']) {
    const input = character.repeat(MAX_LIST_CODE_POINTS);
    const boundary = cleanupList(input);
    assert.equal(boundary.valid, true);
    assert.equal(boundary.text, input);
    const overflow = cleanupList(`${input}${character}`);
    assert.equal(overflow.valid, false);
    assert.equal(overflow.text, '');
    if (!overflow.valid) assert.match(overflow.error, /100,000/);
  }
});

test('5000 raw rows are accepted for each newline style and the next row rejects all output', () => {
  for (const separator of ['\n', '\r\n', '\r']) {
    const input = Array.from({ length: MAX_LIST_ROWS }, (_, index) => `項目${index}`).join(
      separator,
    );
    const boundary = cleanupList(input);
    assert.equal(boundary.valid, true);
    if (!boundary.valid) continue;
    assert.equal(boundary.inputRows, MAX_LIST_ROWS);
    assert.equal(boundary.keptRows, MAX_LIST_ROWS);
    const overflow = cleanupList(`${input}${separator}`);
    assert.equal(overflow.valid, false);
    assert.equal(overflow.text, '');
    if (!overflow.valid) assert.match(overflow.error, /5,000/);
  }
});

test('blank and repeated input rows count toward the raw row limit', () => {
  const blanks = cleanupList('\n'.repeat(MAX_LIST_ROWS - 1));
  assert.equal(blanks.valid, true);
  if (blanks.valid) assert.equal(blanks.blankRows, MAX_LIST_ROWS);
  assert.equal(cleanupList('\n'.repeat(MAX_LIST_ROWS)).valid, false);
  assert.equal(cleanupList('甲\n'.repeat(MAX_LIST_ROWS)).valid, false);
});

test('input remains unchanged and successive runs do not share retained items', () => {
  const input = '  乙\n甲\n乙\n';
  const original = input;
  const first = cleanupList(input);
  assert.equal(input, original);
  assert.equal(first.valid, true);
  if (!first.valid) return;
  first.items.push('外部修改');
  const second = cleanupList(input);
  assert.equal(second.text, '乙\n甲');
  assert.equal(second.valid, true);
  if (second.valid) assert.deepEqual(second.items, ['乙', '甲']);
});

test('kept, blank and duplicate counts partition every accepted raw row', () => {
  const inputs = ['', '\n', '甲\n', '\r\n', ' 甲 \n甲\n \n乙\r乙\r\n丙', '甲\r\r\n乙\n\r'];
  for (const input of inputs) {
    const result = cleanupList(input);
    assert.equal(result.valid, true);
    if (!result.valid) continue;
    assert.equal(result.inputRows, result.keptRows + result.blankRows + result.duplicateRows);
    assert.equal(result.inputRows, input === '' ? 0 : input.split(/\r\n|\r|\n/u).length);
  }
});
