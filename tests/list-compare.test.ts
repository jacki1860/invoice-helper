import assert from 'node:assert/strict';
import test from 'node:test';
import { compareLists } from '../src/features/tools/listCompare.ts';

function validComparison(a: string, b: string) {
  const result = compareLists(a, b);
  assert.equal(result.valid, true);
  return result;
}

test('compares unique membership, trims boundaries and retains source first-occurrence order', () => {
  const result = validComparison('  丙\n甲\n\n乙\n甲\n丁  ', '乙\r\n丙\r\n戊\r\n戊\r\n己');
  assert.deepEqual(result.onlyA, ['甲', '丁']);
  assert.deepEqual(result.common, ['丙', '乙']);
  assert.deepEqual(result.onlyB, ['戊', '己']);
  assert.deepEqual(
    [result.a.inputRows, result.a.keptRows, result.a.blankRows, result.a.duplicateRows],
    [6, 4, 1, 1],
  );
  assert.deepEqual(
    [result.b.inputRows, result.b.keptRows, result.b.blankRows, result.b.duplicateRows],
    [5, 4, 0, 1],
  );
});

test('reordering and repetition do not change set membership', () => {
  const result = validComparison('甲\n乙\n丙\n乙', '丙\n乙\n甲\n甲');
  assert.deepEqual(result.onlyA, []);
  assert.deepEqual(result.onlyB, []);
  assert.deepEqual(result.common, ['甲', '乙', '丙']);
});

test('case, internal whitespace, full-width, leading zeros and Unicode forms remain distinct', () => {
  const a = ['ABC', 'a b', 'A', '001', 'é', '👩‍💻', 'a\tb', 'a,b', '<script>'];
  const b = ['abc', 'a  b', 'Ａ', '1', 'e\u0301', '👩💻', 'a b', 'a,b', '<script>'];
  const result = validComparison(a.join('\n'), b.join('\n'));
  assert.deepEqual(result.common, ['a b', 'a,b', '<script>']);
  assert.deepEqual(result.onlyA, ['ABC', 'A', '001', 'é', '👩‍💻', 'a\tb']);
  assert.deepEqual(result.onlyB, ['abc', 'a  b', 'Ａ', '1', 'e\u0301', '👩💻']);
});

test('empty and blank-only lists produce no report and one-sided inputs remain valid', () => {
  for (const [a, b] of [
    ['', ''],
    [' \t\n', '\r\n　'],
  ]) {
    const result = validComparison(a, b);
    assert.equal(result.text, '');
    assert.deepEqual([result.onlyA, result.common, result.onlyB], [[], [], []]);
  }
  const aOnly = validComparison('甲\n甲\n乙', '');
  assert.deepEqual(aOnly.onlyA, ['甲', '乙']);
  assert.equal(aOnly.b.inputRows, 0);
  assert.match(aOnly.text, /【雙方都有】0 項\n\n【只在 B】0 項$/u);
  const bOnly = validComparison('', '乙\n甲');
  assert.deepEqual(bOnly.onlyB, ['乙', '甲']);
  assert.equal(bOnly.a.inputRows, 0);
});

test('full report contains exact group contents, source statistics and deterministic LF bytes', () => {
  const result = validComparison('  A\r\n共同\r\nA\r\n', '共同\r額外');
  assert.equal(
    result.text,
    [
      '雙清單比對',
      'A：預定清單；B：實際清單',
      '規則：去除每行首尾空白與空行，重複項目只計一次；忽略清單順序，精確比對文字。',
      '排序：只在 A、雙方都有依 A 首次出現順序；只在 B 依 B 首次出現順序。',
      'A：輸入 4 行／不重複 2 項／移除空行 1 行／移除重複 1 行',
      'B：輸入 2 行／不重複 2 項／移除空行 0 行／移除重複 0 行',
      '',
      '【只在 A】1 項',
      'A',
      '',
      '【雙方都有】1 項',
      '共同',
      '',
      '【只在 B】1 項',
      '額外',
    ].join('\n'),
  );
  assert.doesNotMatch(result.text, /\r/u);
});

test('each column accepts exactly 100000 Unicode code points and rejects one more before trimming', () => {
  for (const input of ['😀'.repeat(100_000), ' '.repeat(100_000)]) {
    assert.equal(compareLists(input, '').valid, true);
    assert.equal(compareLists('', input).valid, true);
    for (const [a, b, side] of [
      [`${input} `, 'ok', 'a'],
      ['ok', `${input} `, 'b'],
    ] as const) {
      const result = compareLists(a, b);
      assert.equal(result.valid, false);
      assert.match(result.errors[side] ?? '', /100,000/u);
      assert.equal(result.text, '');
      assert.ok(!('onlyA' in result));
    }
  }
});

test('each column accepts 5000 raw rows, counts empty final rows and rejects any overflow', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const input = Array(5_000).fill('重複').join(newline);
    const result = validComparison(input, input);
    assert.equal(result.a.inputRows, 5_000);
    assert.equal(result.b.duplicateRows, 4_999);
    assert.deepEqual(result.common, ['重複']);
    for (const [a, b, side] of [
      [`${input}${newline}`, 'ok', 'a'],
      ['ok', `${input}${newline}`, 'b'],
    ] as const) {
      const invalid = compareLists(a, b);
      assert.equal(invalid.valid, false);
      assert.match(invalid.errors[side] ?? '', /5,000/u);
      assert.equal(invalid.text, '');
    }
  }
  const blanks = compareLists('\n'.repeat(5_000), '\n'.repeat(5_000));
  assert.equal(blanks.valid, false);
  assert.ok(blanks.errors.a && blanks.errors.b);
});

test('generated small sets partition all unique inputs without overlap or loss', () => {
  const values = ['A', 'B', 'C', 'D', 'E'];
  for (let maskA = 0; maskA < 32; maskA += 1) {
    for (let maskB = 0; maskB < 32; maskB += 1) {
      const a = values.filter((_, index) => maskA & (1 << index));
      const b = values.toReversed().filter((value) => maskB & (1 << values.indexOf(value)));
      const result = validComparison([...a, ...a].join('\n'), [...b, ...b].join('\n'));
      assert.deepEqual(
        result.onlyA,
        a.filter((value) => !b.includes(value)),
      );
      assert.deepEqual(
        result.common,
        a.filter((value) => b.includes(value)),
      );
      assert.deepEqual(
        result.onlyB,
        b.filter((value) => !a.includes(value)),
      );
      assert.equal(
        new Set([...result.onlyA, ...result.common, ...result.onlyB]).size,
        result.onlyA.length + result.common.length + result.onlyB.length,
      );
    }
  }
});
