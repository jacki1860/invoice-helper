import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareText,
  MAX_TEXT_DIFF_CODE_POINTS,
  MAX_TEXT_DIFF_LINES,
  type TextDiffResult,
} from '../src/features/tools/textDiff.ts';

function compareValid(original: string, revised: string) {
  const result = compareText(original, revised);
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error('Expected a valid comparison');
  return result;
}

function verifyReconstruction(original: string, revised: string, result: TextDiffResult) {
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const originalLines = original === '' ? [] : original.split(/\r\n|\r|\n/u);
  const revisedLines = revised === '' ? [] : revised.split(/\r\n|\r|\n/u);
  const beforeRows = result.rows.filter((row) => row.kind !== 'added');
  const afterRows = result.rows.filter((row) => row.kind !== 'removed');
  assert.deepEqual(
    beforeRows.map((row) => row.text),
    originalLines,
  );
  assert.deepEqual(
    afterRows.map((row) => row.text),
    revisedLines,
  );
  assert.deepEqual(
    beforeRows.map((row) => row.originalLine),
    originalLines.map((_, i) => i + 1),
  );
  assert.deepEqual(
    afterRows.map((row) => row.revisedLine),
    revisedLines.map((_, i) => i + 1),
  );
  assert.equal(result.originalLines, originalLines.length);
  assert.equal(result.revisedLines, revisedLines.length);
  assert.equal(result.unchangedRows + result.removedRows, originalLines.length);
  assert.equal(result.unchangedRows + result.addedRows, revisedLines.length);
  assert.equal(result.rows.length, result.unchangedRows + result.removedRows + result.addedRows);
  for (const row of result.rows) {
    if (row.kind === 'added') assert.equal(row.originalLine, null);
    if (row.kind === 'removed') assert.equal(row.revisedLine, null);
    if (row.kind === 'unchanged') {
      assert.equal(originalLines[row.originalLine! - 1], revisedLines[row.revisedLine! - 1]);
    }
  }
  if (result.rows.length === 0) {
    assert.equal(result.text, '');
  } else {
    const reportLines = result.text.split('\n');
    const records = reportLines.slice(reportLines.indexOf('--- 差異內容開始 ---') + 1);
    assert.equal(records.length, result.rows.length);
    assert.deepEqual(
      records.map((record) => record.replace(/^\[[=+-] 原:(?:\d+|—) 新:(?:\d+|—)\] /u, '')),
      result.rows.map((row) => row.text),
    );
  }
}

test('identical text retains every line with both original and revised line numbers', () => {
  const result = compareValid('第一行\n第二行', '第一行\n第二行');
  assert.deepEqual(result.rows, [
    { kind: 'unchanged', text: '第一行', originalLine: 1, revisedLine: 1 },
    { kind: 'unchanged', text: '第二行', originalLine: 2, revisedLine: 2 },
  ]);
  assert.equal(result.unchangedRows, 2);
  assert.equal(result.addedRows, 0);
  assert.equal(result.removedRows, 0);
  verifyReconstruction('第一行\n第二行', '第一行\n第二行', result);
});

test('replacements are removals followed by additions, with surrounding lines retained', () => {
  const original = '抬頭\n舊日期\n舊地址\n結尾';
  const revised = '抬頭\n新日期\n新地址\n結尾';
  const result = compareValid(original, revised);
  assert.deepEqual(
    result.rows.map((row) => row.kind),
    ['unchanged', 'removed', 'removed', 'added', 'added', 'unchanged'],
  );
  assert.equal(result.unchangedRows, 2);
  assert.equal(result.addedRows, 2);
  assert.equal(result.removedRows, 2);
  verifyReconstruction(original, revised, result);
});

test('insertions and removals at the beginning, middle and end do not hide any content', () => {
  for (const [original, revised] of [
    ['甲\n乙', '新增\n甲\n乙'],
    ['甲\n乙', '甲\n新增\n乙'],
    ['甲\n乙', '甲\n乙\n新增'],
    ['刪除\n甲\n乙', '甲\n乙'],
    ['甲\n刪除\n乙', '甲\n乙'],
    ['甲\n乙\n刪除', '甲\n乙'],
  ]) {
    const result = compareValid(original, revised);
    assert.equal(result.unchangedRows, 2);
    assert.equal(result.removedRows + result.addedRows, 1);
    verifyReconstruction(original, revised, result);
  }
});

test('repeated lines use deterministic deletion-first ties and reordering is not a move', () => {
  const original = '甲\n乙\n甲';
  const revised = '甲\n甲\n乙';
  const result = compareValid(original, revised);
  assert.deepEqual(result.rows, [
    { kind: 'unchanged', text: '甲', originalLine: 1, revisedLine: 1 },
    { kind: 'removed', text: '乙', originalLine: 2, revisedLine: null },
    { kind: 'unchanged', text: '甲', originalLine: 3, revisedLine: 2 },
    { kind: 'added', text: '乙', originalLine: null, revisedLine: 3 },
  ]);
  assert.deepEqual(compareText(original, revised), result);
  verifyReconstruction(original, revised, result);
  assert.deepEqual(
    compareValid('甲\n乙', '乙\n甲').rows.map((row) => row.kind),
    ['removed', 'unchanged', 'added'],
  );
});

test('empty strings are zero lines, both empty have no report, and one side can be empty', () => {
  const empty = compareValid('', '');
  assert.equal(empty.text, '');
  assert.equal(empty.originalLines, 0);
  assert.equal(empty.revisedLines, 0);
  assert.deepEqual(empty.rows, []);
  for (const input of ['甲', '甲\n', '\n', '  \t']) {
    const added = compareValid('', input);
    const removed = compareValid(input, '');
    assert.ok(added.rows.every((row) => row.kind === 'added'));
    assert.ok(removed.rows.every((row) => row.kind === 'removed'));
    verifyReconstruction('', input, added);
    verifyReconstruction(input, '', removed);
  }
});

test('blank and whitespace-only lines remain present and a trailing newline adds one line', () => {
  const original = '\n甲\n \t\n';
  const revised = '\n甲\n\n';
  const result = compareValid(original, revised);
  assert.equal(result.originalLines, 4);
  assert.equal(result.revisedLines, 4);
  assert.equal(result.unchangedRows, 3);
  assert.equal(result.removedRows, 1);
  assert.equal(result.addedRows, 1);
  verifyReconstruction(original, revised, result);
  assert.deepEqual(compareValid('甲', '甲\n').rows.at(-1), {
    kind: 'added',
    text: '',
    originalLine: null,
    revisedLine: 2,
  });
});

test('CRLF and CR normalize to LF without other changes or phantom CRLF lines', () => {
  const original = '甲\r\n乙\r丙\n\r\n';
  const revised = '甲\n乙\n丙\n\n';
  const result = compareValid(original, revised);
  assert.equal(result.unchangedRows, 5);
  assert.equal(result.removedRows + result.addedRows, 0);
  assert.doesNotMatch(result.text, /\r/);
  verifyReconstruction(original, revised, result);
});

test('edges, interior whitespace, case, width, leading zero and Unicode forms stay distinct', () => {
  for (const [original, revised] of [
    [' 甲', '甲'],
    ['甲 ', '甲'],
    ['甲 乙', '甲  乙'],
    ['甲\t乙', '甲 乙'],
    ['ABC', 'abc'],
    ['ABC', 'ＡＢＣ'],
    ['001', '1'],
    ['é', 'e\u0301'],
    ['甲\u00a0乙', '甲 乙'],
    ['甲\u2028乙', '甲\n乙'],
  ]) {
    const result = compareValid(original, revised);
    assert.equal(result.unchangedRows, 0);
    verifyReconstruction(original, revised, result);
  }
});

test('literal markup, commas, quotes and report-like text are preserved inside marked records', () => {
  const original =
    '<script>alert(1)</script>\n"甲,乙"\n[+ 原:— 新:3] 假標記\n  \t\n--- 差異內容開始 ---';
  const revised = original + '\n結尾';
  const result = compareValid(original, revised);
  assert.match(result.text, /\[= 原:3 新:3\] \[\+ 原:— 新:3\] 假標記/u);
  assert.match(result.text, /\[= 原:4 新:4\]   \t\n/u);
  verifyReconstruction(original, revised, result);
});

test('the exact Unicode code-point limit accepts supplementary characters and preserves all text', () => {
  const input = '😀'.repeat(MAX_TEXT_DIFF_CODE_POINTS);
  const result = compareValid(input, input);
  assert.equal(result.unchangedRows, 1);
  assert.equal(result.rows[0].text, input);
  verifyReconstruction(input, input, result);
});

test('over-limit code points reject either whole input without partial rows or report', () => {
  const tooLong = '😀'.repeat(MAX_TEXT_DIFF_CODE_POINTS + 1);
  for (const [original, revised, invalidSide] of [
    [tooLong, '有效', 'original'],
    ['有效', tooLong, 'revised'],
  ] as const) {
    const result = compareText(original, revised);
    assert.equal(result.valid, false);
    if (result.valid) return;
    assert.match(result.errors[invalidSide]!, /100,000/u);
    assert.deepEqual(result.rows, []);
    assert.equal(result.text, '');
  }
});

test('limits count original code points before CRLF normalization', () => {
  const exact = 'a'.repeat(MAX_TEXT_DIFF_CODE_POINTS - 2) + '\r\n';
  assert.equal(compareText(exact, '').valid, true);
  const result = compareText('a' + exact, '');
  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.errors.original!, /100,000/u);
});

test('the exact line limit includes trailing empty lines and accepts CRLF as one delimiter', () => {
  for (const delimiter of ['\n', '\r', '\r\n']) {
    const input = delimiter.repeat(MAX_TEXT_DIFF_LINES - 1);
    const result = compareValid(input, input);
    assert.equal(result.unchangedRows, MAX_TEXT_DIFF_LINES);
    verifyReconstruction(input, input, result);
    const invalid = compareText(input + delimiter, input);
    assert.equal(invalid.valid, false);
    if (invalid.valid) return;
    assert.match(invalid.errors.original!, /1,000 行/u);
    assert.equal(invalid.text, '');
    assert.deepEqual(invalid.rows, []);
  }
});

test('both invalid sides expose their own errors and no partial comparison', () => {
  const result = compareText(
    'x'.repeat(MAX_TEXT_DIFF_CODE_POINTS + 1),
    '\n'.repeat(MAX_TEXT_DIFF_LINES),
  );
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.match(result.errors.original!, /100,000/u);
  assert.match(result.errors.revised!, /1,000 行/u);
  assert.equal(result.text, '');
  assert.deepEqual(result.rows, []);
});

test('maximum disjoint inputs produce all 2,000 rows without truncation', () => {
  const original = Array.from({ length: MAX_TEXT_DIFF_LINES }, (_, i) => `舊${i}`).join('\n');
  const revised = Array.from({ length: MAX_TEXT_DIFF_LINES }, (_, i) => `新${i}`).join('\n');
  const result = compareValid(original, revised);
  assert.equal(result.rows.length, MAX_TEXT_DIFF_LINES * 2);
  assert.equal(result.unchangedRows, 0);
  assert.equal(result.removedRows, MAX_TEXT_DIFF_LINES);
  assert.equal(result.addedRows, MAX_TEXT_DIFF_LINES);
  assert.equal(result.rows[MAX_TEXT_DIFF_LINES - 1].kind, 'removed');
  assert.equal(result.rows[MAX_TEXT_DIFF_LINES].kind, 'added');
  verifyReconstruction(original, revised, result);
});

// Exhaustive subsequence enumeration is intentionally independent of the production DP.
function longestCommonSubsequence(before: string[], after: string[]) {
  let longest = 0;
  for (let mask = 0; mask < 2 ** before.length; mask += 1) {
    const candidate = before.filter((_, i) => mask & (1 << i));
    let j = 0;
    for (const line of after) {
      if (j < candidate.length && line === candidate[j]) j += 1;
    }
    if (j === candidate.length) longest = Math.max(longest, j);
  }
  return longest;
}

test('exhaustive short repeated/blank inputs preserve both sides and retain the maximum common lines', () => {
  const inputs = new Set(['']);
  for (const a of ['', '甲', '乙']) {
    inputs.add(a);
    for (const b of ['', '甲', '乙']) {
      inputs.add(`${a}\n${b}`);
      for (const c of ['', '甲', '乙']) inputs.add(`${a}\n${b}\n${c}`);
    }
  }
  for (const original of inputs) {
    for (const revised of inputs) {
      const result = compareValid(original, revised);
      verifyReconstruction(original, revised, result);
      assert.equal(
        result.unchangedRows,
        longestCommonSubsequence(
          original === '' ? [] : original.split('\n'),
          revised === '' ? [] : revised.split('\n'),
        ),
      );
    }
  }
});
