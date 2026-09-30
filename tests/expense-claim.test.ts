import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyExpenseClaim,
  expenseClaimResult,
  expenseClaimText,
  exportExpenseClaim,
  formatExpenseCents,
  hasExpenseClaimContent,
  importExpenseClaim,
  parseExpenseCents,
  EXPENSE_BACKUP_LIMIT,
  MAX_EXPENSE_CENTS,
  type ExpenseClaimDraft,
} from '../src/features/tools/expenseClaim.ts';

const today = '2026-09-30';
const base: ExpenseClaimDraft = {
  applicant: '申請人',
  unit: '工作室',
  project: '展場',
  reference: 'EX-1',
  date: today,
  advance: '0',
  notes: '',
  lines: [
    { id: 'a', date: today, category: '材料', purpose: '螺絲', voucher: '', amount: '0.10' },
    { id: 'b', date: today, category: '材料', purpose: '墊片', voucher: 'V-1', amount: '0.20' },
  ],
};

test('expense cents sum exactly and distinguish reimbursement, repayment, and no difference', () => {
  assert.equal(expenseClaimResult(base, today).total, 30);
  assert.equal(expenseClaimResult({ ...base, advance: '0.05' }, today).difference, 25);
  assert.equal(expenseClaimResult({ ...base, advance: '1.00' }, today).difference, -70);
  assert.equal(formatExpenseCents(30), '0.30');
  assert.equal(formatExpenseCents(-70), '-0.70');
  assert.ok(expenseClaimText(base, today).includes('應補付申請人：NT$ 0.30'));
  assert.ok(expenseClaimText({ ...base, advance: '1' }, today).includes('申請人應繳回：NT$ 0.70'));
  const text = expenseClaimText({ ...base, advance: '0.30' }, today);
  assert.ok(text.includes('無應補／應繳回差額'));
  assert.ok(!text.includes('已結清'));
});

test('money accepts only decimal cents within supported limits, with zero only for advance', () => {
  for (const input of [
    '',
    ' ',
    '0',
    '-1',
    '.5',
    '1.',
    '0.001',
    '1e2',
    '1,000',
    'NaN',
    'Infinity',
    '0x10',
    '999999999.01',
    '9007199254740992',
  ]) {
    assert.equal(parseExpenseCents(input), null, input);
  }
  assert.equal(parseExpenseCents('0', true), 0);
  assert.equal(parseExpenseCents(' 1.2 '), 120);
  assert.equal(parseExpenseCents('0001.09'), 109);
  assert.equal(parseExpenseCents('999999999.00'), MAX_EXPENSE_CENTS);
  assert.equal(formatExpenseCents(MAX_EXPENSE_CENTS), '999,999,999.00');
  assert.equal(expenseClaimResult({ ...base, advance: '' }, today).valid, false);
});

test('aggregate cap and 50-line boundary never silently clamp or round expense totals', () => {
  const max = { ...base, lines: [{ ...base.lines[0], amount: '999999999' }] };
  assert.equal(expenseClaimResult(max, today).valid, true);
  const overflow = { ...base, lines: [...max.lines, { ...base.lines[1], amount: '0.01' }] };
  assert.equal(expenseClaimResult(overflow, today).valid, false);
  assert.equal(expenseClaimResult(overflow, today).total, null);
  assert.equal(expenseClaimText(overflow, today), '');
  const lines = Array.from({ length: 50 }, (_, index) => ({
    ...base.lines[0],
    id: `id-${index}`,
    amount: '0.01',
  }));
  assert.equal(expenseClaimResult({ ...base, lines }, today).total, 50);
  assert.equal(expenseClaimResult({ ...base, lines }, today).valid, true);
  assert.equal(
    expenseClaimResult({ ...base, lines: [...lines, { ...lines[0], id: 'extra' }] }, today).valid,
    false,
  );
});

test('expense dates and required text reject contradictions while voucher numbers stay optional', () => {
  assert.equal(expenseClaimResult(base, today).valid, true);
  for (const patch of [
    { applicant: '' },
    { unit: ' ' },
    { date: '2026-02-29' },
    { date: '2026-09-29' },
    { project: 'a'.repeat(201) },
    { notes: 'a'.repeat(1001) },
    { lines: [] },
  ]) {
    assert.equal(expenseClaimResult({ ...base, ...patch }, today).valid, false);
  }
  for (const patch of [
    { date: '2026-10-01' },
    { date: '2026-02-29' },
    { category: '' },
    { purpose: ' ' },
    { voucher: 'v'.repeat(101) },
    { id: '../path' },
    { amount: '1.001' },
  ]) {
    assert.equal(
      expenseClaimResult({ ...base, lines: [{ ...base.lines[0], ...patch }] }, today).valid,
      false,
    );
  }
  assert.equal(
    expenseClaimResult(
      { ...base, date: '2024-02-29', lines: [{ ...base.lines[0], date: '2024-02-29' }] },
      '2024-02-29',
    ).valid,
    true,
  );
});

test('sample overwrite detection covers headers, dates, advance and every line field', () => {
  const blank = emptyExpenseClaim(today);
  assert.equal(hasExpenseClaimContent(blank, today), false);
  for (const field of ['applicant', 'unit', 'project', 'reference', 'date', 'advance', 'notes']) {
    assert.equal(hasExpenseClaimContent({ ...blank, [field]: 'changed' }, today), true, field);
  }
  for (const field of ['date', 'category', 'purpose', 'voucher', 'amount']) {
    assert.equal(
      hasExpenseClaimContent(
        { ...blank, lines: [{ ...blank.lines[0], [field]: 'changed' }] },
        today,
      ),
      true,
      field,
    );
  }
  assert.equal(hasExpenseClaimContent({ ...blank, lines: [] }, today), true);
});

test('expense JSON roundtrip is exact and retains foreign text as plain strings', () => {
  const foreign = { ...base, project: '<script>alert(1)</script>', notes: '__proto__ & "quotes"' };
  assert.deepEqual(importExpenseClaim(exportExpenseClaim(foreign, today), today), foreign);
  assert.throws(() => exportExpenseClaim(emptyExpenseClaim(today), today));
});

test('expense JSON rejects corrupt, unsupported, oversized, duplicate and hostile envelopes', () => {
  const backup = JSON.parse(exportExpenseClaim(base, today));
  for (const text of [
    '{',
    'null',
    '[]',
    JSON.stringify({ ...backup, version: 2 }),
    JSON.stringify({ ...backup, schema: 'wrong' }),
    JSON.stringify({ ...backup, extra: true }),
    JSON.stringify({ ...backup, draft: { ...base, lines: [base.lines[0], base.lines[0]] } }),
    '{"schema":"xiaoshiwu-expense-claim","version":1,"draft":{},"__proto__":{"polluted":true}}',
  ]) {
    assert.throws(() => importExpenseClaim(text, today));
  }
  assert.throws(() => importExpenseClaim(' '.repeat(EXPENSE_BACKUP_LIMIT + 1), today), /5 MB/);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('expense JSON validates every string and business rule before returning any replacement', () => {
  const backup = JSON.parse(exportExpenseClaim(base, today));
  for (const field of ['applicant', 'unit', 'project', 'reference', 'date', 'advance', 'notes']) {
    assert.throws(
      () =>
        importExpenseClaim(JSON.stringify({ ...backup, draft: { ...base, [field]: 123 } }), today),
      field,
    );
  }
  for (const field of ['id', 'date', 'category', 'purpose', 'voucher', 'amount']) {
    assert.throws(
      () =>
        importExpenseClaim(
          JSON.stringify({
            ...backup,
            draft: { ...base, lines: [{ ...base.lines[0], [field]: {} }] },
          }),
          today,
        ),
      field,
    );
  }
  for (const patch of [
    { lines: null },
    { lines: [] },
    { advance: '-1' },
    { date: '0000-01-01' },
    { unit: 'x'.repeat(101) },
    { unexpected: true },
    { lines: [{ ...base.lines[0], amount: '0.001' }] },
    { lines: [{ ...base.lines[0], extra: true }] },
    { lines: Array.from({ length: 51 }, (_, i) => ({ ...base.lines[0], id: `id-${i}` })) },
  ]) {
    assert.throws(() =>
      importExpenseClaim(JSON.stringify({ ...backup, draft: { ...base, ...patch } }), today),
    );
  }
  assert.equal(base.lines[0].amount, '0.10');
});
