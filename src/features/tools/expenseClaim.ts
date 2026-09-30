import { MAX_AMOUNT } from '../../domain/invoice.ts';
import { getTaiwanDate, isValidInvoiceDate } from '../../utils/dateUtils.ts';

export const MAX_EXPENSE_LINES = 50;
export const EXPENSE_BACKUP_LIMIT = 5 * 1024 * 1024;
export const MAX_EXPENSE_CENTS = MAX_AMOUNT * 100;

export interface ExpenseLine {
  id: string;
  date: string;
  category: string;
  purpose: string;
  voucher: string;
  amount: string;
}

export interface ExpenseClaimDraft {
  applicant: string;
  unit: string;
  project: string;
  reference: string;
  date: string;
  advance: string;
  notes: string;
  lines: ExpenseLine[];
}

export function emptyExpenseLine(date = getTaiwanDate()): ExpenseLine {
  return { id: crypto.randomUUID(), date, category: '', purpose: '', voucher: '', amount: '' };
}

export function emptyExpenseClaim(date = getTaiwanDate()): ExpenseClaimDraft {
  return {
    applicant: '',
    unit: '',
    project: '',
    reference: '',
    date,
    advance: '0',
    notes: '',
    lines: [emptyExpenseLine(date)],
  };
}

/** Convert decimal text to integer cents without floating-point multiplication. */
export function parseExpenseCents(value: string, allowZero = false): number | null {
  const text = value.trim();
  if (text.length > 15 || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(MAX_EXPENSE_CENTS) || cents < (allowZero ? 0n : 1n)) return null;
  return Number(cents);
}

export function formatExpenseCents(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100).toLocaleString('zh-TW');
  const fraction = String(Math.abs(cents) % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole}.${fraction}`;
}

const textValid = (value: string, max: number, required = false) =>
  value.length <= max && (!required || Boolean(value.trim()));
const idValid = (value: string) => /^[A-Za-z0-9_-]{1,100}$/.test(value);

export function expenseClaimResult(draft: ExpenseClaimDraft, today = getTaiwanDate()) {
  const errors: string[] = [];
  if (!textValid(draft.applicant, 100, true)) errors.push('申請人必填，且最多 100 字。');
  if (!textValid(draft.unit, 100, true)) errors.push('報支單位必填，且最多 100 字。');
  if (!textValid(draft.project, 200)) errors.push('專案名稱最多 200 字。');
  if (!textValid(draft.reference, 80)) errors.push('報支編號最多 80 字。');
  if (!textValid(draft.notes, 1000)) errors.push('備註最多 1,000 字。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的申請日期。');
  if (!draft.lines.length || draft.lines.length > MAX_EXPENSE_LINES)
    errors.push('請填寫 1 至 50 筆支出。');
  const ids = new Set<string>();
  const amounts = draft.lines.map((line, index) => {
    const prefix = `支出 ${index + 1}：`;
    if (!idValid(line.id) || ids.has(line.id)) errors.push(`${prefix}識別碼不正確或重複。`);
    ids.add(line.id);
    if (!isValidInvoiceDate(line.date) || line.date > draft.date || line.date > today)
      errors.push(`${prefix}支出日期須有效，且不可晚於申請日期或今天。`);
    if (!textValid(line.category, 80, true)) errors.push(`${prefix}請填寫分類，最多 80 字。`);
    if (!textValid(line.purpose, 300, true)) errors.push(`${prefix}請填寫用途，最多 300 字。`);
    if (!textValid(line.voucher, 100)) errors.push(`${prefix}憑證編號最多 100 字。`);
    const amount = parseExpenseCents(line.amount);
    if (amount === null) errors.push(`${prefix}金額須為 0.01 至 999,999,999.00 元，最多兩位小數。`);
    return amount;
  });
  const advance = parseExpenseCents(draft.advance, true);
  if (advance === null)
    errors.push('預支金額須為 0 至 999,999,999.00 元，最多兩位小數；無預支請填 0。');
  const rawTotal = amounts.every((amount) => amount !== null)
    ? amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
    : null;
  if (rawTotal !== null && rawTotal > MAX_EXPENSE_CENTS)
    errors.push('支出合計不可超過 999,999,999.00 元。');
  const total = rawTotal !== null && rawTotal <= MAX_EXPENSE_CENTS ? rawTotal : null;
  const difference = total !== null && advance !== null ? total - advance : null;
  return { valid: errors.length === 0, errors, amounts, total, advance, difference };
}

export function hasExpenseClaimContent(draft: ExpenseClaimDraft, initialDate: string): boolean {
  return (
    [draft.applicant, draft.unit, draft.project, draft.reference, draft.notes].some(Boolean) ||
    draft.date !== initialDate ||
    draft.advance !== '0' ||
    draft.lines.length !== 1 ||
    draft.lines.some(
      (line) =>
        line.date !== initialDate || line.category || line.purpose || line.voucher || line.amount,
    )
  );
}

export function expenseClaimText(draft: ExpenseClaimDraft, today = getTaiwanDate()): string {
  const result = expenseClaimResult(draft, today);
  if (
    !result.valid ||
    result.total === null ||
    result.advance === null ||
    result.difference === null
  )
    return '';
  const differenceLabel =
    result.difference > 0
      ? '應補付申請人'
      : result.difference < 0
        ? '申請人應繳回'
        : '無應補／應繳回差額';
  return [
    '費用報支單',
    `申請日期：${draft.date}`,
    `申請人：${draft.applicant}`,
    `報支單位：${draft.unit}`,
    draft.project ? `專案：${draft.project}` : '',
    draft.reference ? `報支編號：${draft.reference}` : '',
    '日期｜分類｜用途｜憑證編號｜金額（新臺幣）',
    ...draft.lines.map(
      (line, index) =>
        `${line.date}｜${line.category}｜${line.purpose}｜${line.voucher || '未填'}｜${formatExpenseCents(result.amounts[index]!)}`,
    ),
    `支出合計：NT$ ${formatExpenseCents(result.total)}`,
    `已預支金額：NT$ ${formatExpenseCents(result.advance)}`,
    `${differenceLabel}：NT$ ${formatExpenseCents(Math.abs(result.difference))}`,
    draft.notes ? `備註：${draft.notes}` : '',
    '申請人簽章：________________',
    '審核／付款確認：________________',
    '本單彙整支出及預支差額；請另附實際憑證，依收件單位規定審核。',
  ]
    .filter(Boolean)
    .join('\n');
}

function objectFields(value: unknown, fields: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => Object.prototype.hasOwnProperty.call(value, field))
  )
    throw new Error('備份欄位缺漏或含有未知欄位。');
  return value as Record<string, unknown>;
}

function stringField(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error('備份文字欄位格式或長度不正確。');
  return value;
}

export function exportExpenseClaim(draft: ExpenseClaimDraft, today = getTaiwanDate()): string {
  const result = expenseClaimResult(draft, today);
  if (!result.valid) throw new Error(result.errors.join(' '));
  const text = JSON.stringify({ schema: 'xiaoshiwu-expense-claim', version: 1, draft }, null, 2);
  if (new TextEncoder().encode(text).byteLength > EXPENSE_BACKUP_LIMIT)
    throw new Error('備份超過 5 MB。');
  return text;
}

export function importExpenseClaim(text: string, today = getTaiwanDate()): ExpenseClaimDraft {
  if (new TextEncoder().encode(text).byteLength > EXPENSE_BACKUP_LIMIT)
    throw new Error('備份超過 5 MB。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('不是有效的 JSON 備份。');
  }
  const backup = objectFields(parsed, ['schema', 'version', 'draft']);
  if (backup.schema !== 'xiaoshiwu-expense-claim' || backup.version !== 1)
    throw new Error('不支援此報支備份格式或版本。');
  const raw = objectFields(backup.draft, [
    'applicant',
    'unit',
    'project',
    'reference',
    'date',
    'advance',
    'notes',
    'lines',
  ]);
  if (!Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > MAX_EXPENSE_LINES)
    throw new Error('備份須含 1 至 50 筆支出。');
  const draft: ExpenseClaimDraft = {
    applicant: stringField(raw.applicant, 100),
    unit: stringField(raw.unit, 100),
    project: stringField(raw.project, 200),
    reference: stringField(raw.reference, 80),
    date: stringField(raw.date, 10),
    advance: stringField(raw.advance, 15),
    notes: stringField(raw.notes, 1000),
    lines: raw.lines.map((entry) => {
      const line = objectFields(entry, ['id', 'date', 'category', 'purpose', 'voucher', 'amount']);
      return {
        id: stringField(line.id, 100),
        date: stringField(line.date, 10),
        category: stringField(line.category, 80),
        purpose: stringField(line.purpose, 300),
        voucher: stringField(line.voucher, 100),
        amount: stringField(line.amount, 15),
      };
    }),
  };
  const result = expenseClaimResult(draft, today);
  if (!result.valid) throw new Error(result.errors.join(' '));
  return draft;
}
