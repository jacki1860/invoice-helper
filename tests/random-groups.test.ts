import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRandomGroups,
  emptyRandomGroups,
  exampleRandomGroups,
  randomGroupIndex,
  validateRandomGroups,
  type RandomGroupsDraft,
} from '../src/features/tools/randomGroups.ts';

const draft = (names = '甲\n乙', groupCountRaw = '2'): RandomGroupsDraft => ({
  names,
  groupCountRaw,
});
const people = (count: number) =>
  Array.from({ length: count }, (_, index) => `參與者 ${index + 1}`);
const invalid = (input: RandomGroupsDraft, expected: RegExp) => {
  const before = structuredClone(input);
  const result = validateRandomGroups(input);
  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.message).join('\n'), expected);
  assert.deepEqual(result.names, []);
  assert.equal(result.groupCount, 0);
  assert.deepEqual(input, before);
  assert.throws(
    () =>
      createRandomGroups(input, () => {
        throw new Error('should not sample');
      }),
    /Invalid participant/,
  );
};

test('blank initial input stays invalid and the editable example is valid', () => {
  invalid(emptyRandomGroups(), /2–500/);
  assert.equal(validateRandomGroups(exampleRandomGroups()).valid, true);
  assert.notEqual(exampleRandomGroups(), exampleRandomGroups());
});

test('trims edges, preserves internal spaces and original Unicode, and counts blank lines', () => {
  const result = validateRandomGroups(draft('  Alice Smith  \r\n　\rCafe\u0301\n😀\n', '3'));
  assert.equal(result.valid, true);
  assert.deepEqual(result.names, ['Alice Smith', 'Cafe\u0301', '😀']);
  assert.equal(result.blankLines, 2);
});

test('NFC duplicates block the entire list and identify both original line numbers', () => {
  const result = validateRandomGroups(draft('甲\n\n Café \n乙\nCafe\u0301'));
  assert.equal(result.valid, false);
  assert.deepEqual(result.names, []);
  const duplicate = result.errors.find((error) => /重複/.test(error.message));
  assert.equal(duplicate?.line, 5);
  assert.match(duplicate!.message, /第 3 行/);
  invalid(draft('甲\n 甲 '), /識別/);
  assert.equal(validateRandomGroups(draft('Alice\nalice')).valid, true);
});

test('participant bounds accept 2 and 500, reject 0, 1 and 501 without partial groups', () => {
  for (const count of [2, 500])
    assert.equal(validateRandomGroups(draft(people(count).join('\n'))).valid, true);
  for (const count of [0, 1, 501]) invalid(draft(people(count).join('\n')), /2–500/);
});

test('group counts are strict integers in 2–100 and never exceed the participant count', () => {
  for (const value of [
    '',
    ' ',
    '1',
    '101',
    '-2',
    '2.0',
    '2e0',
    '+2',
    '２',
    ' 2',
    '2 ',
    'Infinity',
  ]) {
    invalid(draft(people(100).join('\n'), value), /2–100/);
  }
  for (const value of ['2', '100', '002'])
    assert.equal(validateRandomGroups(draft(people(100).join('\n'), value)).valid, true);
  invalid(draft('甲\n乙', '3'), /不可超過參與者/);
});

test('name limit counts Unicode code points after trim without splitting astral characters', () => {
  assert.equal(validateRandomGroups(draft(` ${'😀'.repeat(80)} \n乙`)).valid, true);
  invalid(draft(`${'😀'.repeat(81)}\n乙`), /80 個 Unicode/);
});

test('full input limit counts raw Unicode code points including whitespace and newlines', () => {
  const exact = `甲\n乙${' '.repeat(99_997)}`;
  assert.equal(Array.from(exact).length, 100_000);
  assert.equal(validateRandomGroups(draft(exact)).valid, true);
  invalid(draft(exact + ' '), /100,000/);
  const astral = `😀\n乙${' '.repeat(99_997)}`;
  assert.equal(validateRandomGroups(draft(astral)).valid, true);
  invalid(draft(astral + '😀'), /100,000/);
});

test('the 1000-line limit counts blank and terminal lines with LF, CRLF and CR', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const exact = `甲${newline}乙${newline.repeat(998)}`;
    const result = validateRandomGroups(draft(exact));
    assert.equal(result.valid, true);
    assert.deepEqual(result.names, ['甲', '乙']);
    assert.equal(result.blankLines, 998);
    invalid(draft(exact + newline), /1,000 行/);
  }
  invalid(draft(`甲\r\n乙${'\r\n\r\n'.repeat(499)}\r`), /1,000 行/);
});

test('very large multiline input is rejected whole before participant diagnostics', () => {
  for (const names of ['A\n'.repeat(50_000), '\t\n'.repeat(50_000)]) {
    invalid(draft(names), /1,000 行/);
    assert.equal(validateRandomGroups(draft(names)).errorCount, 1);
  }
});

test('control characters are rejected before trimming even on otherwise blank lines', () => {
  for (const control of ['\t', '\0', '\x1b', '\x7f', '\x85', '\u2028', '\u2029']) {
    invalid(draft(`甲\n ${control} \n乙`), /控制字元/);
  }
  invalid(draft('甲\n\ud800'), /不完整的 Unicode/);
});

test('rejection sampling discards the incomplete high bucket before applying modulo', () => {
  const values = [0xffffffff, 0xfffffffe];
  let calls = 0;
  assert.equal(
    randomGroupIndex(3, () => values[calls++]),
    2,
  );
  assert.equal(calls, 2);
  assert.equal(
    randomGroupIndex(2, () => 0xffffffff),
    1,
  );
  assert.equal(
    randomGroupIndex(500, () => 4_294_966_999),
    499,
  );
});

test('bad random sources fail visibly rather than hanging or returning partial output', () => {
  for (const value of [NaN, Infinity, -1, 2 ** 32, 1.5])
    assert.throws(() => randomGroupIndex(3, () => value), /Invalid random value/);
  for (const upper of [0, -1, 1.5, 501, NaN])
    assert.throws(() => randomGroupIndex(upper, () => 0), /Invalid random index bound/);
  let calls = 0;
  assert.throws(
    () =>
      randomGroupIndex(3, () => {
        calls += 1;
        return 0xffffffff;
      }),
    /rejected values/,
  );
  assert.equal(calls, 128);
  assert.throws(
    () =>
      createRandomGroups(draft('甲\n乙\n丙'), () => {
        throw new Error('crypto unavailable');
      }),
    /crypto unavailable/,
  );
});

test('Fisher–Yates selects all six permutations of three names exactly once', () => {
  const permutations = new Set<string>();
  for (let first = 0; first < 3; first += 1) {
    for (let second = 0; second < 2; second += 1) {
      const values = [first, second];
      permutations.add(
        createRandomGroups(draft('甲\n乙\n丙'), () => values.shift()!)
          .groups.flat()
          .join(''),
      );
    }
  }
  assert.deepEqual(
    [...permutations].toSorted(),
    ['甲乙丙', '甲丙乙', '乙甲丙', '乙丙甲', '丙甲乙', '丙乙甲'].toSorted(),
  );
});

test('every supported group count preserves every person exactly once and balances sizes', () => {
  let seed = 17;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (const count of [2, 3, 7, 99, 100, 101, 499, 500]) {
    const names = people(count);
    for (let groupCount = 2; groupCount <= Math.min(count, 100); groupCount += 1) {
      const input = Object.freeze(draft(names.join('\n'), String(groupCount)));
      const output = createRandomGroups(input, random);
      assert.equal(output.groups.length, groupCount);
      assert.equal(output.participantCount, count);
      assert.deepEqual(output.groups.flat().toSorted(), names.toSorted());
      const sizes = output.groups.map((group) => group.length);
      assert.ok(Math.min(...sizes) >= 1);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
      assert.equal(new Set(output.groups.flat()).size, count);
    }
  }
});

test('output is immutable relative to the input and another draw; TXT contains all groups and terminal LF', () => {
  const input = Object.freeze(draft('甲\n乙\n丙\n丁'));
  const output = createRandomGroups(input, () => 0);
  assert.deepEqual(output.groups, [
    ['乙', '丙'],
    ['丁', '甲'],
  ]);
  const expected =
    '隨機分組結果（共 4 人，2 組）\n\n第 1 組（2 人）\n- 乙\n- 丙\n\n第 2 組（2 人）\n- 丁\n- 甲\n';
  assert.equal(output.text, expected);
  const repeated = createRandomGroups(input, () => 0);
  assert.deepEqual(repeated, output); // A new draw is allowed to have the same result.
  repeated.groups[0][0] = 'changed';
  assert.equal(output.groups[0][0], '乙');
  assert.equal(input.names, '甲\n乙\n丙\n丁');
});

test('default generator can use real Web Crypto without asserting a particular permutation', () => {
  const output = createRandomGroups(exampleRandomGroups());
  assert.equal(output.groups.length, 3);
  assert.equal(new Set(output.groups.flat()).size, 8);
});

test('1000-line duplicate or control-character lists remain invalid with bounded diagnostics', () => {
  for (const names of ['A\n'.repeat(999) + 'A', '\t\n'.repeat(999) + '\t']) {
    const input = draft(names);
    const result = validateRandomGroups(input);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 20);
    assert.ok(result.errorCount >= 1_000);
    assert.deepEqual(result.names, []);
    assert.equal(input.names, names);
  }
});
