import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyFilenamePlan,
  exampleFilenamePlan,
  planFilenames,
  type FilenamePlanDraft,
} from '../src/features/tools/filenamePlan.ts';

const draft = (patch: Partial<FilenamePlanDraft> = {}): FilenamePlanDraft => ({
  ...emptyFilenamePlan(),
  original: '原圖.JPG\n報告.final.pdf\n.env',
  ...patch,
});

function valid(input: FilenamePlanDraft) {
  const result = planFilenames(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.errors.length, 0);
  assert.ok(result.rows.length > 0);
  return result;
}

function invalid(input: FilenamePlanDraft) {
  const result = planFilenames(input);
  assert.equal(result.valid, false, JSON.stringify(input));
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.rows, []);
  assert.equal(result.namesText, '');
  assert.equal(result.mappingText, '');
  return result;
}

test('example preserves original order and case while keeping only the last extension', () => {
  const result = valid(exampleFilenamePlan());
  assert.deepEqual(result.rows, [
    { line: 1, original: '原圖.JPG', planned: '交件_009.JPG' },
    { line: 2, original: '報告.final.pdf', planned: '交件_010.pdf' },
    { line: 3, original: '.env', planned: '交件_011' },
  ]);
  assert.equal(result.originalLines, 3);
  assert.equal(result.blankLines, 0);
  assert.equal(result.namesText, '交件_009.JPG\n交件_010.pdf\n交件_011\n');
  assert.equal(
    result.mappingText,
    '原檔名\t新檔名\n原圖.JPG\t交件_009.JPG\n報告.final.pdf\t交件_010.pdf\n.env\t交件_011\n',
  );
});

test('extension toggle and dotfiles follow the last non-leading dot rule', () => {
  const original = 'plain\n.env\n.env.local\narchive.tar.gz\na..PDF';
  assert.deepEqual(
    valid(draft({ original })).rows.map((row) => row.planned),
    ['001', '002', '003.local', '004.gz', '005.PDF'],
  );
  assert.deepEqual(
    valid(draft({ original, keepExtension: false })).rows.map((row) => row.planned),
    ['001', '002', '003', '004', '005'],
  );
});

test('blank rows count but do not consume numbers, with original line numbers and text retained', () => {
  const result = valid(
    draft({ original: '\n  原圖.JPG\r\n \r\n報告.final.pdf\r\u3000\n.env\n', prefix: ' 交件_ ' }),
  );
  assert.equal(result.originalLines, 7);
  assert.equal(result.blankLines, 4);
  assert.deepEqual(
    result.rows.map(({ line, original, planned }) => ({ line, original, planned })),
    [
      { line: 2, original: '  原圖.JPG', planned: ' 交件_ 001.JPG' },
      { line: 4, original: '報告.final.pdf', planned: ' 交件_ 002.pdf' },
      { line: 6, original: '.env', planned: ' 交件_ 003' },
    ],
  );
  for (const original of ['', '\n \n\u3000']) invalid(draft({ original }));
  assert.equal(planFilenames(emptyFilenamePlan()).originalLines, 0);
});

test('ASCII integer ranges and minimum padding reject silent coercion and number overflow', () => {
  for (const startRaw of ['1', '0009', '999997']) valid(draft({ startRaw }));
  assert.equal(
    valid(draft({ original: 'a', startRaw: '999999', paddingRaw: '1' })).namesText,
    '999999\n',
  );
  assert.equal(valid(draft({ original: 'a', startRaw: '10', paddingRaw: '1' })).namesText, '10\n');
  assert.equal(
    valid(draft({ original: 'a', startRaw: '9', paddingRaw: '6' })).namesText,
    '000009\n',
  );
  for (const startRaw of [
    '',
    '0',
    '-1',
    '+1',
    '1.2',
    '1e2',
    '0x10',
    '１',
    ' 1',
    '1 ',
    '1\n',
    'NaN',
    'Infinity',
    '1000000',
  ]) {
    assert.ok(invalid(draft({ startRaw })).errors.some((error) => error.field === 'startRaw'));
  }
  invalid(draft({ startRaw: '999998' }));
  for (const paddingRaw of ['', '0', '7', '3.0', '３', '+3', '3 ', '3\n']) {
    assert.ok(invalid(draft({ paddingRaw })).errors.some((error) => error.field === 'paddingRaw'));
  }
});

test('invalid names report original row numbers and block all output without trimming', () => {
  for (const name of [
    '.',
    '..',
    'bad ',
    'bad.',
    'folder/name',
    'folder\\name',
    'a<b',
    'a>b',
    'a:b',
    'a"b',
    'a|b',
    'a?b',
    'a*b',
  ]) {
    const result = invalid(draft({ original: `ok.jpg\n\n${name}\nlast.png` }));
    assert.ok(
      result.errors.some((error) => error.line === 3),
      name,
    );
  }
  for (const prefix of ['bad/name', 'bad\\name', 'bad:', 'bad*', 'bad?', 'bad\n', 'bad\r'])
    invalid(draft({ prefix }));
  assert.equal(
    valid(draft({ original: ' old.jpg', prefix: ' pre ' })).rows[0].original,
    ' old.jpg',
  );
});

test('controls including whitespace-only tabs are rejected rather than skipped', () => {
  const forbidden = [
    ...Array.from({ length: 32 }, (_, index) => String.fromCodePoint(index)).filter(
      (character) => character !== '\r' && character !== '\n',
    ),
    ...Array.from({ length: 33 }, (_, index) => String.fromCodePoint(0x7f + index)),
    '\u2028',
    '\u2029',
  ];
  for (const character of forbidden) {
    assert.ok(
      invalid(draft({ original: `ok\n${character}` })).errors.some((error) => error.line === 2),
    );
    invalid(draft({ prefix: character }));
  }
});

test('Windows reserved names are case insensitive including extensions and superscript ports', () => {
  const names = [
    'CON',
    'prn',
    'AUX',
    'nul',
    'CONIN$',
    'CONOUT$',
    'CLOCK$',
    'COM¹',
    'COM²',
    'COM³',
    'LPT¹',
    'LPT²',
    'LPT³',
  ];
  for (let index = 1; index <= 9; index += 1) names.push(`COM${index}`, `LPT${index}`);
  for (const name of names) {
    invalid(draft({ original: name }));
    invalid(draft({ original: `${name}.txt` }));
    invalid(draft({ original: `${name} .txt` }));
  }
  valid(draft({ original: 'COM0.txt\nCOM10\nLPT10\nCONSOLE' }));
  assert.match(
    invalid(draft({ original: 'a', prefix: 'COM', paddingRaw: '1' })).errors[0].message,
    /產生的新檔名.*Windows/,
  );
});

test('NFC and case collisions reject duplicates without silently dropping source names', () => {
  for (const original of ['A.JPG\na.jpg', 'café.txt\ncafe\u0301.txt', 'same\nsame']) {
    const result = invalid(draft({ original }));
    assert.ok(result.errors.some((error) => error.line === 2 && /第 1 行/.test(error.message)));
  }
  const result = valid(draft({ original: 'cafe\u0301.txt\nＡ.txt\nA.txt' }));
  assert.equal(result.rows[0].original, 'cafe\u0301.txt');
  assert.ok(result.mappingText.includes('cafe\u0301.txt\t001.txt'));
});

test('cross-row old/new name collisions warn but same-row unchanged names remain valid', () => {
  const result = valid(draft({ original: 'source.JPG\n001.jpg' }));
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /第 1 行.*第 2 行.*更名順序可能衝突/);
  const same = valid(draft({ original: '001.jpg' }));
  assert.equal(same.rows[0].planned, same.rows[0].original);
  assert.deepEqual(same.warnings, []);
});

test('per-name and prefix limits count original Unicode code points', () => {
  valid(draft({ original: '🧭'.repeat(200), prefix: '😀'.repeat(80) }));
  invalid(draft({ original: '🧭'.repeat(201) }));
  invalid(draft({ prefix: '😀'.repeat(81) }));
  invalid(draft({ prefix: ` ${'a'.repeat(80)}` }));
  const atLimit = valid(
    draft({ original: `a.${'x'.repeat(113)}`, prefix: 'a'.repeat(80), paddingRaw: '6' }),
  );
  assert.equal(Array.from(atLimit.rows[0].planned).length, 200);
  assert.match(
    invalid(draft({ original: `a.${'x'.repeat(114)}`, prefix: 'a'.repeat(80), paddingRaw: '6' }))
      .errors[0].message,
    /產生的新檔名.*200/,
  );
});

test('raw line limit includes a trailing newline and blank rows without truncation', () => {
  const lines = Array.from({ length: 1000 }, (_, index) => `file-${index}`);
  const result = valid(draft({ original: lines.join('\n') }));
  assert.equal(result.rows.length, 1000);
  assert.equal(result.rows[999].original, 'file-999');
  assert.equal(result.rows[999].planned, '1000');
  assert.equal(result.mappingText.split('\n').length, 1002);
  assert.equal(result.namesText.split('\n').length, 1001);
  assert.ok(result.mappingText.endsWith('file-999\t1000\n'));
  invalid(draft({ original: `${lines.join('\n')}\n` }));
  const trailing = valid(draft({ original: `${lines.slice(0, 999).join('\n')}\n` }));
  assert.equal(trailing.originalLines, 1000);
  assert.equal(trailing.blankLines, 1);
  invalid(draft({ original: '\n'.repeat(1000) }));
});

test('100000 raw code points are accepted exactly and over-limit input never leaks a partial plan', () => {
  const lines = Array.from(
    { length: 500 },
    (_, index) => `${String(index).padStart(3, '0')}${'🧭'.repeat(196)}`,
  );
  lines[0] += 'Z';
  const original = lines.join('\n');
  assert.equal(Array.from(original).length, 100000);
  assert.equal(valid(draft({ original })).rows.length, 500);
  assert.match(invalid(draft({ original: `${original}Z` })).errors[0].message, /100,000/);
});

test('invalid edits clear all export data without mutating the previous result', () => {
  const previous = valid(exampleFilenamePlan());
  const text = previous.mappingText;
  invalid({ ...exampleFilenamePlan(), startRaw: '1000000' });
  invalid({ ...exampleFilenamePlan(), original: 'ok\nCON.txt' });
  assert.equal(previous.mappingText, text);
  assert.equal(previous.rows.length, 3);
});

test('TXT mapping is UTF-8 without BOM and has exact tab fields, LF and one final newline', () => {
  const result = valid(draft({ original: '照片.JPG\r\n報告.pdf', prefix: '交件_' }));
  const encoded = Buffer.from(result.mappingText, 'utf8');
  assert.equal(encoded.toString('utf8'), result.mappingText);
  assert.notDeepEqual([...encoded.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(
    result.mappingText,
    '原檔名\t新檔名\n照片.JPG\t交件_001.JPG\n報告.pdf\t交件_002.pdf\n',
  );
  assert.equal(result.mappingText.includes('\r'), false);
  assert.equal(result.mappingText.endsWith('\n\n'), false);
});
