import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyEquipmentLoan,
  equipmentLoanResult,
  equipmentLoanText,
  exportEquipmentLoan,
  hasEquipmentLoanContent,
  importEquipmentLoan,
  parseEquipmentQuantity,
  EQUIPMENT_BACKUP_LIMIT,
  type EquipmentLoanDraft,
} from '../src/features/tools/equipmentLoan.ts';
import { getTaiwanDate } from '../src/utils/dateUtils.ts';

const today = '2026-09-30';
const base: EquipmentLoanDraft = {
  reference: 'EQ-1',
  lender: '工作室',
  lenderContact: '出借窗口',
  borrower: '活動團隊',
  borrowerContact: '借用窗口',
  purpose: '測試',
  loanDate: '2026-09-29',
  dueDate: today,
  notes: '',
  lines: [
    {
      id: 'one',
      assetId: 'EQ-001',
      name: '投影機',
      accessories: '電源線 2 條',
      quantity: '2',
      outCondition: '功能正常',
      returnedQuantity: '0',
      returnDate: '',
      returnCondition: '',
    },
  ],
};

test('equipment progress distinguishes unreturned, partial and full with overdue only for outstanding', () => {
  assert.equal(equipmentLoanResult(base, today).status, 'unreturned');
  assert.equal(equipmentLoanResult(base, today).overdue, false);
  const partial = {
    ...base,
    lines: [
      { ...base.lines[0], returnedQuantity: '1', returnDate: today, returnCondition: '1 台完整' },
    ],
  };
  const result = equipmentLoanResult(partial, '2026-10-01');
  assert.equal(result.valid, true);
  assert.equal(result.status, 'partial');
  assert.equal(result.overdue, true);
  assert.deepEqual([result.borrowed, result.returned, result.outstanding], [2, 1, 1]);
  const full = { ...partial, lines: [{ ...partial.lines[0], returnedQuantity: '2' }] };
  assert.equal(equipmentLoanResult(full, '2026-10-01').status, 'returned');
  assert.equal(equipmentLoanResult(full, '2026-10-01').overdue, false);
  assert.equal(equipmentLoanResult(full, '2026-10-01').outstanding, 0);
  assert.ok(equipmentLoanText(partial, today).includes('累計已還 1'));
  assert.ok(equipmentLoanText(partial, today).includes('最近實際歸還日期：2026-09-30'));
});

test('Taipei midnight changes due status without depending on the browser timezone', () => {
  const before = getTaiwanDate(new Date('2026-09-30T15:59:59Z'));
  const after = getTaiwanDate(new Date('2026-09-30T16:00:00Z'));
  assert.equal(equipmentLoanResult(base, before).overdue, false);
  assert.equal(equipmentLoanResult(base, after).overdue, true);
});

test('quantity parser rejects unsafe, decimal, negative and coercion formats', () => {
  for (const value of [
    '',
    ' ',
    '0',
    '-1',
    '1.5',
    '1e3',
    '1,000',
    '10000',
    'Infinity',
    '0x10',
    '9007199254740992',
  ])
    assert.equal(parseEquipmentQuantity(value), null, value);
  assert.equal(parseEquipmentQuantity('0', true), 0);
  assert.equal(parseEquipmentQuantity('9999'), 9999);
  assert.equal(parseEquipmentQuantity('0001'), 1);
});

test('equipment contradictions block all output, including returned quantity without a real handover', () => {
  for (const patch of [
    { quantity: '0' },
    { returnedQuantity: '3' },
    { returnedQuantity: '-1' },
    { returnDate: today },
    { returnCondition: '已還' },
    { returnedQuantity: '1' },
    { returnedQuantity: '1', returnDate: '2026-09-28', returnCondition: '正常' },
    { returnedQuantity: '1', returnDate: '2026-10-01', returnCondition: '正常' },
    { returnedQuantity: '1', returnDate: '2026-02-29', returnCondition: '正常' },
    { returnedQuantity: '1', returnDate: today, returnCondition: ' ' },
    { outCondition: '' },
    { name: '' },
    { id: '../evil' },
  ]) {
    const draft = { ...base, lines: [{ ...base.lines[0], ...patch }] };
    assert.equal(equipmentLoanResult(draft, today).valid, false, JSON.stringify(patch));
    assert.equal(equipmentLoanText(draft, today), '');
  }
  assert.equal(
    equipmentLoanResult({ ...base, lines: [{ ...base.lines[0], returnedQuantity: '3' }] }, today)
      .lines[0].outstanding,
    null,
  );
});

test('equipment date ordering, required names, strings and 50-line cap are validated', () => {
  for (const patch of [
    { lender: '' },
    { borrower: ' ' },
    { loanDate: '2026-10-01' },
    { loanDate: '0000-01-01' },
    { dueDate: '' },
    { dueDate: '2026-09-28' },
    { notes: 'x'.repeat(1001) },
    { lines: [] },
  ])
    assert.equal(equipmentLoanResult({ ...base, ...patch }, today).valid, false);
  const lines = Array.from({ length: 50 }, (_, index) => ({
    ...base.lines[0],
    id: `id-${index}`,
    quantity: '9999',
  }));
  const result = equipmentLoanResult({ ...base, lines }, today);
  assert.equal(result.valid, true);
  assert.equal(result.outstanding, 499950);
  assert.equal(
    equipmentLoanResult({ ...base, lines: [...lines, { ...lines[0], id: 'extra' }] }, today).valid,
    false,
  );
  assert.equal(
    equipmentLoanResult({ ...base, loanDate: '2024-02-29', dueDate: '2024-02-29' }, '2024-02-29')
      .valid,
    true,
  );
});

test('equipment sample replacement detection protects every editable field', () => {
  const blank = emptyEquipmentLoan(today);
  assert.equal(hasEquipmentLoanContent(blank, today), false);
  for (const field of [
    'reference',
    'lender',
    'lenderContact',
    'borrower',
    'borrowerContact',
    'purpose',
    'loanDate',
    'dueDate',
    'notes',
  ]) {
    assert.equal(hasEquipmentLoanContent({ ...blank, [field]: 'changed' }, today), true, field);
  }
  for (const field of [
    'assetId',
    'name',
    'accessories',
    'quantity',
    'outCondition',
    'returnedQuantity',
    'returnDate',
    'returnCondition',
  ]) {
    assert.equal(
      hasEquipmentLoanContent(
        { ...blank, lines: [{ ...blank.lines[0], [field]: 'changed' }] },
        today,
      ),
      true,
      field,
    );
  }
  assert.equal(hasEquipmentLoanContent({ ...blank, lines: [] }, today), true);
});

test('equipment backup roundtrip preserves text and latest partial-return details', () => {
  const partial = {
    ...base,
    notes: '<script>alert(1)</script> & __proto__',
    lines: [
      { ...base.lines[0], returnedQuantity: '1', returnDate: today, returnCondition: '正常' },
    ],
  };
  assert.deepEqual(importEquipmentLoan(exportEquipmentLoan(partial, today), today), partial);
  assert.throws(() => exportEquipmentLoan(emptyEquipmentLoan(today), today));
});

test('equipment backup rejects corrupt, unsupported, duplicate, oversized and hostile data', () => {
  const backup = JSON.parse(exportEquipmentLoan(base, today));
  for (const value of [
    'null',
    '[]',
    '{',
    JSON.stringify({ ...backup, version: 2 }),
    JSON.stringify({ ...backup, schema: 'wrong' }),
    JSON.stringify({ ...backup, extra: true }),
    JSON.stringify({ ...backup, draft: { ...base, lines: [base.lines[0], base.lines[0]] } }),
    '{"schema":"xiaoshiwu-equipment-loan","version":1,"draft":{},"__proto__":{"polluted":true}}',
  ])
    assert.throws(() => importEquipmentLoan(value, today));
  assert.throws(() => importEquipmentLoan(' '.repeat(EQUIPMENT_BACKUP_LIMIT + 1), today), /5 MB/);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('equipment backup checks every string, quantity and date before replacing the current draft', () => {
  const backup = JSON.parse(exportEquipmentLoan(base, today));
  for (const field of [
    'reference',
    'lender',
    'lenderContact',
    'borrower',
    'borrowerContact',
    'purpose',
    'loanDate',
    'dueDate',
    'notes',
  ])
    assert.throws(
      () =>
        importEquipmentLoan(
          JSON.stringify({ ...backup, draft: { ...base, [field]: null } }),
          today,
        ),
      field,
    );
  for (const field of [
    'id',
    'assetId',
    'name',
    'accessories',
    'quantity',
    'outCondition',
    'returnedQuantity',
    'returnDate',
    'returnCondition',
  ])
    assert.throws(
      () =>
        importEquipmentLoan(
          JSON.stringify({
            ...backup,
            draft: { ...base, lines: [{ ...base.lines[0], [field]: 42 }] },
          }),
          today,
        ),
      field,
    );
  for (const patch of [
    { lines: null },
    { lines: [] },
    { lenderContact: 'x'.repeat(201) },
    { extra: true },
    { lines: [{ ...base.lines[0], returnedQuantity: '3' }] },
    { lines: [{ ...base.lines[0], returnDate: today }] },
    { lines: [{ ...base.lines[0], outCondition: 'x'.repeat(301) }] },
    { lines: [{ ...base.lines[0], extra: true }] },
    { lines: Array.from({ length: 51 }, (_, index) => ({ ...base.lines[0], id: `id-${index}` })) },
  ])
    assert.throws(() =>
      importEquipmentLoan(JSON.stringify({ ...backup, draft: { ...base, ...patch } }), today),
    );
  assert.equal(base.lines[0].returnedQuantity, '0');
});
