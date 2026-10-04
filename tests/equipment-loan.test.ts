import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyEquipmentLoan,
  equipmentLoanResult,
  equipmentLoanText,
  equipmentReminderText,
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

test('reminders list only outstanding quantities while omitting fully returned equipment and private fields', () => {
  const mixed: EquipmentLoanDraft = {
    ...base,
    lenderContact: 'PRIVATE_LENDER_CONTACT',
    borrowerContact: 'PRIVATE_BORROWER_CONTACT',
    purpose: 'PRIVATE_PURPOSE',
    notes: 'PRIVATE_NOTES',
    lines: [
      {
        ...base.lines[0],
        quantity: '5',
        returnedQuantity: '2',
        returnDate: today,
        returnCondition: 'PRIVATE_RETURN_CONDITION',
        outCondition: 'PRIVATE_OUT_CONDITION',
        accessories: 'PRIVATE_ACCESSORIES',
      },
      {
        ...base.lines[0],
        id: 'returned',
        name: '已還相機',
        assetId: 'RETURNED-ASSET',
        returnedQuantity: '2',
        returnDate: today,
        returnCondition: '正常',
      },
      { ...base.lines[0], id: 'pending', name: '延長線', assetId: '' },
    ],
  };
  const text = equipmentReminderText(mixed, today);
  assert.match(text, /^器材待還提醒\n借用人：活動團隊\n出借人：工作室\n借用編號：EQ-1\n/);
  assert.match(text, /預定歸還日期：2026-09-30\n核對日期：2026-09-30（臺北時間）/);
  assert.deepEqual(
    text.split('\n').filter((line) => /^\d+\./.test(line)),
    ['1. 投影機（器材編號：EQ-001）｜待還 3 件', '2. 延長線｜待還 2 件'],
  );
  assert.doesNotMatch(text, /已還相機|RETURNED-ASSET|PRIVATE_/);
  assert.match(text, /配件與歸還狀況請由雙方另行核對；本提醒不判定配件待還數量。/);
  assert.doesNotMatch(text, /電源線 2 條|借出 5|累計已還/);
});

test('reminders omit optional identifiers and use the existing Taipei due-day boundary', () => {
  const withoutIds = { ...base, reference: '', lines: [{ ...base.lines[0], assetId: '' }] };
  const text = equipmentReminderText(withoutIds, today);
  assert.doesNotMatch(text, /借用編號：|器材編號：|（）/);
  assert.match(text, /1\. 投影機｜待還 2 件/);
  const whitespaceIds = {
    ...withoutIds,
    reference: ' ',
    lines: [{ ...withoutIds.lines[0], assetId: ' ' }],
  };
  assert.equal(equipmentReminderText(whitespaceIds, today), text);
  const dueDay = getTaiwanDate(new Date('2026-09-30T15:59:59Z'));
  const followingDay = getTaiwanDate(new Date('2026-09-30T16:00:00Z'));
  assert.doesNotMatch(equipmentReminderText(base, dueDay), /已過|逾期/);
  assert.match(equipmentReminderText(base, followingDay), /預定歸還日期已過，請協助核對/);
  assert.match(equipmentReminderText(base, followingDay), /核對日期：2026-10-01（臺北時間）/);
  assert.doesNotMatch(
    equipmentReminderText({ ...base, dueDate: '2026-10-02' }, today),
    /已過|逾期/,
  );
});

test('reminders are empty for fully returned, invalid drafts, contradictory quantities and invalid check dates', () => {
  const full = {
    ...base,
    lines: [
      { ...base.lines[0], returnedQuantity: '2', returnDate: today, returnCondition: '正常' },
    ],
  };
  assert.equal(equipmentReminderText(full, today), '');
  assert.equal(equipmentReminderText(full, '2026-10-01'), '');
  for (const draft of [
    emptyEquipmentLoan(today),
    { ...base, lines: [] },
    { ...base, borrower: '' },
    { ...base, dueDate: '2026-09-28' },
    { ...base, lines: [{ ...base.lines[0], quantity: '0' }] },
    {
      ...base,
      lines: [
        { ...base.lines[0], returnedQuantity: '3', returnDate: today, returnCondition: '正常' },
      ],
    },
    { ...base, lines: [{ ...base.lines[0], returnedQuantity: '1' }] },
    { ...base, lines: [{ ...base.lines[0], name: '' }] },
  ]) {
    assert.equal(equipmentLoanResult(draft, today).valid, false);
    assert.equal(equipmentReminderText(draft, today), '');
  }
  for (const invalidDate of ['', '2026-02-29', '2026-9-30', '0000-01-01', 'not-a-date'])
    assert.equal(equipmentReminderText(base, invalidDate), '', invalidDate);
});

test('building reminders does not mutate drafts or change complete document and version-1 backup exports', () => {
  const draft = structuredClone(base);
  const original = structuredClone(draft);
  const documentBefore = equipmentLoanText(draft, today);
  const backupBefore = exportEquipmentLoan(draft, today);
  for (const line of draft.lines) Object.freeze(line);
  Object.freeze(draft.lines);
  Object.freeze(draft);
  assert.match(equipmentReminderText(draft, today), /待還 2 件/);
  assert.deepEqual(draft, original);
  assert.equal(equipmentLoanText(draft, today), documentBefore);
  assert.equal(exportEquipmentLoan(draft, today), backupBefore);
  assert.match(documentBefore, /出借聯絡資訊：出借窗口/);
  assert.match(documentBefore, /配件：電源線 2 條/);
  assert.doesNotMatch(documentBefore, /器材待還提醒/);
  assert.deepEqual(JSON.parse(backupBefore), {
    schema: 'xiaoshiwu-equipment-loan',
    version: 1,
    draft: original,
  });
  assert.deepEqual(importEquipmentLoan(backupBefore, today), original);
});
