import { MAX_AMOUNT } from '../../domain/invoice.ts';
import { getTaiwanDate, isValidInvoiceDate } from '../../utils/dateUtils.ts';
import type { ReceivableSeed, ReceiptSeed } from './handoff.ts';

export const RECEIVABLE_STORAGE_KEY = 'xiaoshiwu.receivables.v1';
export const RECEIVABLE_BACKUP_LIMIT = 5 * 1024 * 1024;
export const MAX_RECEIVABLES = 500;
export const MAX_RECEIVABLE_PAYMENTS = 100;

export interface ReceivableStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ReceivableStorageConflict extends Error {
  readonly currentRaw: string | null;

  constructor(currentRaw: string | null) {
    super('本機資料已由另一個頁面更動，未覆寫或刪除；請先下載最新本機資料並核對。');
    this.name = 'ReceivableStorageConflict';
    this.currentRaw = currentRaw;
  }
}

function checkStorageSnapshot(storage: ReceivableStorage, expectedRaw: string | null) {
  const currentRaw = storage.getItem(RECEIVABLE_STORAGE_KEY);
  if (currentRaw !== expectedRaw) throw new ReceivableStorageConflict(currentRaw);
}

// Recheck immediately before each synchronous mutation, including opt-out and recovery.
export function writeReceivableStorage(
  storage: ReceivableStorage,
  expectedRaw: string | null,
  nextRaw: string,
) {
  checkStorageSnapshot(storage, expectedRaw);
  storage.setItem(RECEIVABLE_STORAGE_KEY, nextRaw);
}

export function removeReceivableStorage(storage: ReceivableStorage, expectedRaw: string | null) {
  checkStorageSnapshot(storage, expectedRaw);
  storage.removeItem(RECEIVABLE_STORAGE_KEY);
}

export interface ActualPayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string;
}

export interface Receivable {
  id: string;
  customer: string;
  issuer: string;
  title: string;
  reference: string;
  total: number;
  dueDate: string;
  payments: ActualPayment[];
}

export interface PaymentDraft {
  amount: string;
  date: string;
  method: string;
  note: string;
}

export type ReceivableStatus = 'unpaid' | 'partial' | 'paid';
export const receivableStatusLabel: Record<ReceivableStatus, string> = {
  unpaid: '未收',
  partial: '部分收款',
  paid: '已收',
};

export const emptyReceivableDraft = (): ReceivableSeed => ({
  customer: '',
  issuer: '',
  title: '',
  reference: '',
  total: '',
  dueDate: '',
});

export const emptyPaymentDraft = (today = getTaiwanDate()): PaymentDraft => ({
  amount: '',
  date: today,
  method: '銀行轉帳',
  note: '',
});

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fields(value: unknown, names: string[], context: string): Record<string, unknown> {
  if (
    !plainObject(value) ||
    Object.keys(value).length !== names.length ||
    !names.every((name) => Object.prototype.hasOwnProperty.call(value, name))
  )
    throw new Error(`${context}的欄位不完整或含有未知欄位。`);
  return value;
}

function textField(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new Error(`${label}${required ? '不可空白，且' : ''}最多 ${max} 個字。`);
  return value.trim();
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value))
    throw new Error('紀錄識別碼格式錯誤。');
  return value;
}

function validAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_AMOUNT)
    throw new Error(`金額須為 1 至 ${MAX_AMOUNT.toLocaleString('zh-TW')} 元的整數。`);
  return value;
}

export function parseReceivableAmount(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error('金額請填寫新臺幣正整數，不含小數或逗號。');
  return validAmount(Number(value));
}

function calendarDate(value: unknown, label: string, optional = false): string {
  if (optional && value === '') return '';
  if (typeof value !== 'string' || !isValidInvoiceDate(value))
    throw new Error(`${label}須為有效日期（YYYY-MM-DD）。`);
  return value;
}

export function receivableProgress(record: Receivable, today = getTaiwanDate()) {
  const received = record.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = record.total - received;
  const status: ReceivableStatus = balance === 0 ? 'paid' : received === 0 ? 'unpaid' : 'partial';
  const overdue = balance > 0 && Boolean(record.dueDate) && record.dueDate < today;
  return { received, balance, status, overdue };
}

export function receivableSummary(records: Receivable[], today = getTaiwanDate()) {
  return records.reduce(
    (summary, record) => {
      const { received, balance, overdue } = receivableProgress(record, today);
      return {
        received: summary.received + received,
        outstanding: summary.outstanding + balance,
        overdue: summary.overdue + (overdue ? balance : 0),
      };
    },
    { received: 0, outstanding: 0, overdue: 0 },
  );
}

export function receivableToDraft(record: Receivable): ReceivableSeed {
  return {
    customer: record.customer,
    issuer: record.issuer,
    title: record.title,
    reference: record.reference,
    total: String(record.total),
    dueDate: record.dueDate,
  };
}

export function makeReceivable(
  draft: ReceivableSeed,
  id: string,
  payments: ActualPayment[] = [],
): Receivable {
  const record: Receivable = {
    id: identifier(id),
    customer: textField(draft.customer, '客戶名稱', 150, true),
    issuer: textField(draft.issuer, '收款方', 150, true),
    title: textField(draft.title, '案件名稱', 200, true),
    reference: textField(draft.reference, '文件編號', 100),
    total: parseReceivableAmount(draft.total),
    dueDate: calendarDate(draft.dueDate, '付款期限', true),
    payments,
  };
  if (receivableProgress(record).balance < 0) throw new Error('總金額不可低於已登記的實收金額。');
  return record;
}

export function addReceivablePayment(
  record: Receivable,
  draft: PaymentDraft,
  id: string,
  today = getTaiwanDate(),
): Receivable {
  if (record.payments.length >= MAX_RECEIVABLE_PAYMENTS)
    throw new Error(`每筆案件最多登記 ${MAX_RECEIVABLE_PAYMENTS} 筆收款。`);
  const payment: ActualPayment = {
    id: identifier(id),
    amount: parseReceivableAmount(draft.amount),
    date: calendarDate(draft.date, '實收日期'),
    method: textField(draft.method, '收款方式', 80, true),
    note: textField(draft.note, '收款備註', 500),
  };
  if (payment.date > today) throw new Error('實收日期不可晚於今天；尚未收到的款項請勿登記。');
  if (payment.id === record.id || record.payments.some((entry) => entry.id === payment.id))
    throw new Error('收款識別碼重複。');
  if (payment.amount > receivableProgress(record, today).balance)
    throw new Error('本次實收金額不可超過尚待收款的餘額。');
  return { ...record, payments: [...record.payments, payment] };
}

export function receiptFromPayment(record: Receivable, paymentId: string): ReceiptSeed {
  const payment = record.payments.find((entry) => entry.id === paymentId);
  if (!payment) throw new Error('找不到這筆實收款項。');
  return {
    payer: record.customer,
    payee: record.issuer,
    amount: String(payment.amount),
    date: payment.date,
    method: payment.method,
    purpose: record.title,
    reference: record.reference,
  };
}

function parseRecords(value: unknown, today: string): Receivable[] {
  if (!Array.isArray(value) || value.length > MAX_RECEIVABLES)
    throw new Error(`備份須包含紀錄陣列，且最多 ${MAX_RECEIVABLES} 筆案件。`);
  const ids = new Set<string>();
  const takeId = (candidate: unknown): string => {
    const id = identifier(candidate);
    if (ids.has(id)) throw new Error('備份含有重複的紀錄或收款識別碼。');
    ids.add(id);
    return id;
  };
  return value.map((item) => {
    const raw = fields(
      item,
      ['id', 'customer', 'issuer', 'title', 'reference', 'total', 'dueDate', 'payments'],
      '案件',
    );
    const id = takeId(raw.id);
    if (!Array.isArray(raw.payments) || raw.payments.length > MAX_RECEIVABLE_PAYMENTS)
      throw new Error(`每筆案件的收款紀錄須為陣列，且最多 ${MAX_RECEIVABLE_PAYMENTS} 筆。`);
    let record = makeReceivable(
      {
        customer: textField(raw.customer, '客戶名稱', 150, true),
        issuer: textField(raw.issuer, '收款方', 150, true),
        title: textField(raw.title, '案件名稱', 200, true),
        reference: textField(raw.reference, '文件編號', 100),
        total: String(validAmount(raw.total)),
        dueDate: calendarDate(raw.dueDate, '付款期限', true),
      },
      id,
    );
    for (const rawPayment of raw.payments) {
      const payment = fields(rawPayment, ['id', 'amount', 'date', 'method', 'note'], '收款紀錄');
      record = addReceivablePayment(
        record,
        {
          amount: String(validAmount(payment.amount)),
          date: calendarDate(payment.date, '實收日期'),
          method: textField(payment.method, '收款方式', 80, true),
          note: textField(payment.note, '收款備註', 500),
        },
        takeId(payment.id),
        today,
      );
    }
    return record;
  });
}

export function importReceivables(text: string, today = getTaiwanDate()): Receivable[] {
  if (new TextEncoder().encode(text).byteLength > RECEIVABLE_BACKUP_LIMIT)
    throw new Error('備份超過 5 MB，未匯入任何資料。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('備份不是有效的 JSON，未匯入任何資料。');
  }
  const backup = fields(parsed, ['schema', 'version', 'records'], '備份');
  if (backup.schema !== 'xiaoshiwu-receivables' || backup.version !== 1)
    throw new Error('不支援此備份格式或版本，原有資料未變更。');
  return parseRecords(backup.records, today);
}

export function exportReceivables(records: Receivable[], today = getTaiwanDate()): string {
  const safeRecords = parseRecords(records, today);
  const text = JSON.stringify(
    { schema: 'xiaoshiwu-receivables', version: 1, records: safeRecords },
    null,
    2,
  );
  if (new TextEncoder().encode(text).byteLength > RECEIVABLE_BACKUP_LIMIT)
    throw new Error('紀錄超過 5 MB 的備份上限，請先減少資料量。');
  return text;
}

const money = (value: number) => `NT$ ${value.toLocaleString('zh-TW')}`;

export function reconciliationText(record: Receivable, today = getTaiwanDate()): string {
  const { received, balance, status, overdue } = receivableProgress(record, today);
  return [
    `${record.title}｜收款明細`,
    `客戶：${record.customer}`,
    `收款方：${record.issuer}`,
    record.reference ? `文件編號：${record.reference}` : '',
    `應收總額：${money(record.total)}`,
    `累計實收：${money(received)}`,
    `待收餘額：${money(balance)}`,
    `狀態：${receivableStatusLabel[status]}${overdue ? '（已逾期）' : ''}`,
    record.dueDate ? `付款期限：${record.dueDate}` : '',
    ...record.payments.map(
      (payment) =>
        `${payment.date}｜${money(payment.amount)}｜${payment.method}${payment.note ? `｜${payment.note}` : ''}`,
    ),
    `核對日期：${today}（臺北時間）`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function receivableReminder(record: Receivable, today = getTaiwanDate()): string {
  const { balance, received } = receivableProgress(record, today);
  if (balance <= 0) return '';
  return [
    `${record.customer} 您好：`,
    `想與您核對「${record.title}」${record.reference ? `（${record.reference}）` : ''}的付款進度。`,
    `本案總額為 NT$ ${record.total.toLocaleString('zh-TW')}，目前已登記實收 NT$ ${received.toLocaleString('zh-TW')}，尚待收款 NT$ ${balance.toLocaleString('zh-TW')}。`,
    record.dueDate ? `原訂付款期限為 ${record.dueDate}。` : '',
    '若已安排付款，再麻煩告知付款日期與核對資訊；若需要調整時程，也歡迎與我們聯繫。謝謝您。',
    record.issuer,
  ]
    .filter(Boolean)
    .join('\n');
}
