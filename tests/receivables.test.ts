import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addReceivablePayment,
  exportReceivables,
  importReceivables,
  makeReceivable,
  MAX_RECEIVABLES,
  MAX_RECEIVABLE_PAYMENTS,
  parseReceivableAmount,
  RECEIVABLE_BACKUP_LIMIT,
  RECEIVABLE_STORAGE_KEY,
  ReceivableStorageConflict,
  receivableProgress,
  receivableReminder,
  receivableSummary,
  receiptFromPayment,
  reconciliationText,
  removeReceivableStorage,
  writeReceivableStorage,
} from '../src/features/tools/receivables.ts';
import { getTaiwanDate } from '../src/utils/dateUtils.ts';
import { MAX_AMOUNT } from '../src/domain/invoice.ts';

const today = '2026-09-30';
const draft = {
  customer: '範例客戶',
  issuer: '範例工作室',
  title: '網站維護',
  reference: 'Q-123',
  total: '10000',
  dueDate: today,
};
const payment = { amount: '3000', date: today, method: '銀行轉帳', note: '第一期' };
const base = makeReceivable(draft, 'record-1');
const partial = addReceivablePayment(base, payment, 'payment-1', today);

test('unpaid, partial and fully paid status keep overdue independent and due day inclusive', () => {
  assert.deepEqual(receivableProgress(base, today), {
    received: 0,
    balance: 10000,
    status: 'unpaid',
    overdue: false,
  });
  assert.deepEqual(receivableProgress(partial, '2026-10-01'), {
    received: 3000,
    balance: 7000,
    status: 'partial',
    overdue: true,
  });
  const paid = addReceivablePayment(partial, { ...payment, amount: '7000' }, 'payment-2', today);
  assert.deepEqual(receivableProgress(paid, '2026-10-01'), {
    received: 10000,
    balance: 0,
    status: 'paid',
    overdue: false,
  });
  assert.equal(receivableProgress({ ...base, dueDate: '' }, '9999-12-31').overdue, false);
  assert.equal(receivableReminder(paid, today), '');
});

test('summary totals count only remaining overdue balance and stay exact at supported limits', () => {
  const paid = addReceivablePayment(
    { ...base, id: 'paid' },
    { ...payment, amount: '10000' },
    'p-paid',
    today,
  );
  assert.deepEqual(
    receivableSummary(
      [partial, paid, { ...base, id: 'later', dueDate: '2026-10-02' }],
      '2026-10-01',
    ),
    {
      received: 13000,
      outstanding: 17000,
      overdue: 7000,
    },
  );
  const records = Array.from({ length: MAX_RECEIVABLES }, (_, index) =>
    makeReceivable({ ...draft, total: String(MAX_AMOUNT) }, `r-${index}`),
  );
  const summary = receivableSummary(records, today);
  assert.equal(summary.outstanding, MAX_RECEIVABLES * MAX_AMOUNT);
  assert.equal(Number.isSafeInteger(summary.outstanding), true);
});

test('NTD amounts reject fractions, overflow, negative, zero and coercion formats', () => {
  for (const value of [
    '',
    ' ',
    '0',
    '-1',
    '0.1',
    '1.0',
    '1,000',
    '1e3',
    'Infinity',
    '0x10',
    String(MAX_AMOUNT + 1),
    String(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    assert.throws(() => parseReceivableAmount(value), value);
  }
  assert.equal(parseReceivableAmount(' 123 '), 123);
  assert.equal(parseReceivableAmount(String(MAX_AMOUNT)), MAX_AMOUNT);
});

test('actual payments reject overpayment, bad dates, missing method, repeated ids and future dates', () => {
  for (const patch of [
    { amount: '7001' },
    { amount: '0' },
    { amount: '2.5' },
    { date: '2026-02-29' },
    { date: '2026-10-01' },
    { method: ' ' },
    { note: 'x'.repeat(501) },
  ]) {
    assert.throws(() =>
      addReceivablePayment(partial, { ...payment, ...patch }, 'new-payment', today),
    );
  }
  assert.throws(() => addReceivablePayment(partial, payment, 'payment-1', today), /重複/);
  assert.throws(() => addReceivablePayment(partial, payment, 'record-1', today), /重複/);
  assert.throws(
    () => makeReceivable({ ...draft, total: '2999' }, base.id, partial.payments),
    /低於/,
  );
  const maxPayments = {
    ...base,
    payments: Array.from({ length: MAX_RECEIVABLE_PAYMENTS }, (_, index) => ({
      id: `p-${index}`,
      amount: 1,
      date: today,
      method: '現金',
      note: '',
    })),
  };
  assert.throws(() => addReceivablePayment(maxPayments, payment, 'new', today), /最多/);
  assert.equal(partial.payments.length, 1, 'failed operations do not mutate the original');
});

test('one receipt carries one actual payment and never changes the invoice status', () => {
  const before = structuredClone(partial);
  assert.deepEqual(receiptFromPayment(partial, 'payment-1'), {
    payer: draft.customer,
    payee: draft.issuer,
    amount: '3000',
    date: today,
    method: '銀行轉帳',
    purpose: draft.title,
    reference: 'Q-123',
  });
  assert.deepEqual(partial, before);
  assert.equal(receivableProgress(partial, today).status, 'partial');
  assert.throws(() => receiptFromPayment(partial, 'missing'), /找不到/);
});

test('backup roundtrip preserves validated records and foreign text as inert strings', () => {
  const foreign = {
    ...partial,
    title: '<script>alert(1)</script> & "hello"',
    customer: '__proto__',
  };
  const text = exportReceivables([foreign], today);
  assert.deepEqual(importReceivables(text, today), [foreign]);
  assert.deepEqual(importReceivables(exportReceivables([], today), today), []);
  assert.ok(reconciliationText(foreign, today).includes('累計實收：NT$ 3,000'));
  assert.ok(reconciliationText(foreign, today).includes('待收餘額：NT$ 7,000'));
  assert.ok(receivableReminder(foreign, today).includes('尚待收款 NT$ 7,000'));
});

test('backup rejects corrupt JSON, unsupported schema, duplicate ids and unknown or hostile fields', () => {
  const backup = JSON.parse(exportReceivables([partial], today));
  for (const invalid of [
    '{',
    'null',
    '[]',
    JSON.stringify({ ...backup, version: 2 }),
    JSON.stringify({ ...backup, schema: 'other-tool' }),
    JSON.stringify({ ...backup, extra: true }),
    JSON.stringify({ ...backup, records: [partial, partial] }),
    JSON.stringify({
      ...backup,
      records: [{ ...partial, payments: [partial.payments[0], partial.payments[0]] }],
    }),
    JSON.stringify({
      ...backup,
      records: [{ ...partial, payments: [{ ...partial.payments[0], id: partial.id }] }],
    }),
    JSON.stringify({ ...backup, records: [{ ...partial, unexpected: 'value' }] }),
    JSON.stringify({
      ...backup,
      records: [{ ...partial, payments: [{ ...partial.payments[0], extra: true }] }],
    }),
    '{"schema":"xiaoshiwu-receivables","version":1,"records":[],"__proto__":{"polluted":true}}',
  ])
    assert.throws(() => importReceivables(invalid, today), invalid);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('backup validates every field and refuses unsafe integer or string-coerced amounts', () => {
  const backup = JSON.parse(exportReceivables([partial], today));
  for (const patch of [
    { id: '../path' },
    { customer: '' },
    { issuer: null },
    { title: [] },
    { reference: 42 },
    { dueDate: '2026-13-01' },
    { total: '10000' },
    { total: 0 },
    { total: 3.5 },
    { total: Number.MAX_SAFE_INTEGER + 1 },
    { total: 2999 },
    { payments: null },
    { customer: 'x'.repeat(151) },
  ])
    assert.throws(() =>
      importReceivables(JSON.stringify({ ...backup, records: [{ ...partial, ...patch }] }), today),
    );
  for (const patch of [
    { amount: '3000' },
    { amount: -1 },
    { amount: 0 },
    { amount: 10001 },
    { date: '2026-02-29' },
    { date: '2026-10-01' },
    { method: '' },
    { method: 123 },
    { note: null },
    { id: '' },
  ])
    assert.throws(() =>
      importReceivables(
        JSON.stringify({
          ...backup,
          records: [{ ...partial, payments: [{ ...partial.payments[0], ...patch }] }],
        }),
        today,
      ),
    );
  assert.throws(
    () =>
      importReceivables(
        JSON.stringify({
          ...backup,
          records: Array.from({ length: MAX_RECEIVABLES + 1 }, (_, index) => ({
            ...base,
            id: `r-${index}`,
          })),
        }),
        today,
      ),
    /最多/,
  );
  assert.throws(() => importReceivables(' '.repeat(RECEIVABLE_BACKUP_LIMIT + 1), today), /5 MB/);
});

test('Taipei rollover changes overdue status even while UTC is still on the due date', () => {
  const before = getTaiwanDate(new Date('2026-09-30T15:59:59Z'));
  const after = getTaiwanDate(new Date('2026-09-30T16:00:00Z'));
  assert.equal(before, '2026-09-30');
  assert.equal(after, '2026-10-01');
  assert.equal(receivableProgress(partial, before).overdue, false);
  assert.equal(receivableProgress(partial, after).overdue, true);
});

test('stale writes preserve the other tab data and expose its latest backup snapshot', () => {
  const data = new Map([[RECEIVABLE_STORAGE_KEY, 'version-1']]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  writeReceivableStorage(storage, 'version-1', 'version-2-from-B');
  let latest: string | null = null;
  assert.throws(
    () => writeReceivableStorage(storage, 'version-1', 'version-2-from-A'),
    (error) => {
      assert.ok(error instanceof ReceivableStorageConflict);
      latest = error.currentRaw;
      return true;
    },
  );
  assert.equal(latest, 'version-2-from-B');
  assert.equal(data.get(RECEIVABLE_STORAGE_KEY), latest);

  // Tab A has downloaded the v2 snapshot; B writes again before A confirms recovery removal.
  writeReceivableStorage(storage, latest, 'version-3-from-B');
  assert.throws(
    () => removeReceivableStorage(storage, latest),
    (error) => {
      assert.ok(error instanceof ReceivableStorageConflict);
      assert.equal(error.currentRaw, 'version-3-from-B');
      return true;
    },
  );
  assert.equal(data.get(RECEIVABLE_STORAGE_KEY), 'version-3-from-B');
  removeReceivableStorage(storage, 'version-3-from-B');
  assert.equal(data.has(RECEIVABLE_STORAGE_KEY), false);
});

test('stale opt-out and initial opt-in cannot remove or replace an existing snapshot', () => {
  const data = new Map([[RECEIVABLE_STORAGE_KEY, 'new-data-from-other-tab']]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  assert.throws(() => removeReceivableStorage(storage, 'old-data'), ReceivableStorageConflict);
  assert.throws(
    () => writeReceivableStorage(storage, null, 'fresh-data'),
    (error) => {
      assert.ok(error instanceof ReceivableStorageConflict);
      assert.equal(error.currentRaw, 'new-data-from-other-tab');
      return true;
    },
  );
  assert.throws(() => removeReceivableStorage(storage, null), ReceivableStorageConflict);
  assert.equal(data.get(RECEIVABLE_STORAGE_KEY), 'new-data-from-other-tab');
});

test('storage access denial and quota failures surface without deleting stored records', () => {
  let removals = 0;
  const denied = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('must not write');
    },
    removeItem: () => {
      removals += 1;
    },
  };
  assert.throws(() => writeReceivableStorage(denied, null, 'new'), /SecurityError/);
  assert.throws(() => removeReceivableStorage(denied, null), /SecurityError/);
  assert.equal(removals, 0);
  const quota = {
    ...denied,
    getItem: () => 'old',
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.throws(() => writeReceivableStorage(quota, 'old', 'new'), /QuotaExceededError/);
  assert.equal(quota.getItem(), 'old');
  assert.equal(removals, 0);
});
