import { getTaiwanDate, isValidInvoiceDate } from '../../utils/dateUtils.ts';

export const MAX_EQUIPMENT_LINES = 50;
export const EQUIPMENT_BACKUP_LIMIT = 5 * 1024 * 1024;
export const MAX_EQUIPMENT_QUANTITY = 9999;
export type EquipmentLoanStatus = 'unreturned' | 'partial' | 'returned';
export const equipmentLoanStatusLabel: Record<EquipmentLoanStatus, string> = {
  unreturned: '未歸還',
  partial: '部分歸還',
  returned: '已歸還',
};

export interface EquipmentLoanLine {
  id: string;
  assetId: string;
  name: string;
  accessories: string;
  quantity: string;
  outCondition: string;
  returnedQuantity: string;
  returnDate: string;
  returnCondition: string;
}

export interface EquipmentLoanDraft {
  reference: string;
  lender: string;
  lenderContact: string;
  borrower: string;
  borrowerContact: string;
  purpose: string;
  loanDate: string;
  dueDate: string;
  notes: string;
  lines: EquipmentLoanLine[];
}

export function emptyEquipmentLine(): EquipmentLoanLine {
  return {
    id: crypto.randomUUID(),
    assetId: '',
    name: '',
    accessories: '',
    quantity: '1',
    outCondition: '',
    returnedQuantity: '0',
    returnDate: '',
    returnCondition: '',
  };
}

export function emptyEquipmentLoan(date = getTaiwanDate()): EquipmentLoanDraft {
  return {
    reference: '',
    lender: '',
    lenderContact: '',
    borrower: '',
    borrowerContact: '',
    purpose: '',
    loanDate: date,
    dueDate: '',
    notes: '',
    lines: [emptyEquipmentLine()],
  };
}

export function parseEquipmentQuantity(value: string, allowZero = false): number | null {
  if (!/^\d{1,4}$/.test(value)) return null;
  const quantity = Number(value);
  return quantity >= (allowZero ? 0 : 1) && quantity <= MAX_EQUIPMENT_QUANTITY ? quantity : null;
}

const textValid = (value: string, max: number, required = false) =>
  value.length <= max && (!required || Boolean(value.trim()));
const statusFor = (quantity: number, returned: number): EquipmentLoanStatus =>
  quantity > 0 && returned === quantity ? 'returned' : returned > 0 ? 'partial' : 'unreturned';

export function equipmentLoanResult(draft: EquipmentLoanDraft, today = getTaiwanDate()) {
  const errors: string[] = [];
  if (!textValid(draft.lender, 100, true)) errors.push('出借人必填，且最多 100 字。');
  if (!textValid(draft.borrower, 100, true)) errors.push('借用人必填，且最多 100 字。');
  if (!textValid(draft.lenderContact, 200) || !textValid(draft.borrowerContact, 200))
    errors.push('聯絡資訊各最多 200 字。');
  if (!textValid(draft.reference, 80)) errors.push('借用編號最多 80 字。');
  if (!textValid(draft.purpose, 500)) errors.push('借用用途最多 500 字。');
  if (!textValid(draft.notes, 1000)) errors.push('備註最多 1,000 字。');
  if (!isValidInvoiceDate(draft.loanDate) || draft.loanDate > today)
    errors.push('借出日期須有效，且不可晚於今天。');
  if (!isValidInvoiceDate(draft.dueDate) || draft.dueDate < draft.loanDate)
    errors.push('預定歸還日期須有效，且不可早於借出日期。');
  if (!draft.lines.length || draft.lines.length > MAX_EQUIPMENT_LINES)
    errors.push('請填寫 1 至 50 筆器材。');
  const ids = new Set<string>();
  const lines = draft.lines.map((line, index) => {
    const prefix = `器材 ${index + 1}：`;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(line.id) || ids.has(line.id))
      errors.push(`${prefix}識別碼不正確或重複。`);
    ids.add(line.id);
    if (!textValid(line.assetId, 80)) errors.push(`${prefix}器材編號最多 80 字。`);
    if (!textValid(line.name, 100, true)) errors.push(`${prefix}請填寫器材名稱，最多 100 字。`);
    if (!textValid(line.accessories, 300)) errors.push(`${prefix}配件說明最多 300 字。`);
    if (!textValid(line.outCondition, 300, true))
      errors.push(`${prefix}請填寫借出狀況，最多 300 字。`);
    const quantity = parseEquipmentQuantity(line.quantity);
    const returnedQuantity = parseEquipmentQuantity(line.returnedQuantity, true);
    if (quantity === null) errors.push(`${prefix}借出數量須為 1 至 9,999 的整數。`);
    if (returnedQuantity === null || (quantity !== null && returnedQuantity > quantity))
      errors.push(`${prefix}已還數量須為 0 至借出數量的整數。`);
    if (!textValid(line.returnCondition, 300)) errors.push(`${prefix}歸還狀況最多 300 字。`);
    if (returnedQuantity === 0 && (line.returnDate || line.returnCondition))
      errors.push(`${prefix}尚未歸還時，請清空實際歸還日期與歸還狀況。`);
    if (returnedQuantity !== null && returnedQuantity > 0) {
      if (
        !isValidInvoiceDate(line.returnDate) ||
        line.returnDate < draft.loanDate ||
        line.returnDate > today
      )
        errors.push(`${prefix}實際歸還日期須介於借出日期與今天之間。`);
      if (!line.returnCondition.trim()) errors.push(`${prefix}已歸還時請填寫歸還狀況。`);
    }
    const outstanding =
      quantity !== null && returnedQuantity !== null && returnedQuantity <= quantity
        ? quantity - returnedQuantity
        : null;
    const status = statusFor(quantity ?? 0, returnedQuantity ?? 0);
    const overdue =
      outstanding !== null &&
      outstanding > 0 &&
      isValidInvoiceDate(draft.dueDate) &&
      draft.dueDate < today;
    return { id: line.id, quantity, returnedQuantity, outstanding, status, overdue };
  });
  const borrowed = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
  const returned = lines.reduce((sum, line) => sum + (line.returnedQuantity ?? 0), 0);
  const outstanding = lines.reduce((sum, line) => sum + (line.outstanding ?? 0), 0);
  const status = statusFor(borrowed, returned);
  return {
    valid: errors.length === 0,
    errors,
    borrowed,
    returned,
    outstanding,
    status,
    overdue: lines.some((line) => line.overdue),
    lines,
  };
}

export function hasEquipmentLoanContent(draft: EquipmentLoanDraft, initialDate: string): boolean {
  return (
    [
      draft.reference,
      draft.lender,
      draft.lenderContact,
      draft.borrower,
      draft.borrowerContact,
      draft.purpose,
      draft.dueDate,
      draft.notes,
    ].some(Boolean) ||
    draft.loanDate !== initialDate ||
    draft.lines.length !== 1 ||
    draft.lines.some(
      (line) =>
        line.assetId ||
        line.name ||
        line.accessories ||
        line.outCondition ||
        line.returnDate ||
        line.returnCondition ||
        line.quantity !== '1' ||
        line.returnedQuantity !== '0',
    )
  );
}

export function equipmentLoanText(draft: EquipmentLoanDraft, today = getTaiwanDate()): string {
  const result = equipmentLoanResult(draft, today);
  if (!result.valid) return '';
  return [
    '器材借還單',
    draft.reference ? `借用編號：${draft.reference}` : '',
    `出借人：${draft.lender}`,
    draft.lenderContact ? `出借聯絡資訊：${draft.lenderContact}` : '',
    `借用人：${draft.borrower}`,
    draft.borrowerContact ? `借用聯絡資訊：${draft.borrowerContact}` : '',
    `借出日期：${draft.loanDate}`,
    `預定歸還日期：${draft.dueDate}`,
    draft.purpose ? `借用用途：${draft.purpose}` : '',
    `狀態：${equipmentLoanStatusLabel[result.status]}${result.overdue ? '（已逾期）' : ''}；待還 ${result.outstanding} 件`,
    ...draft.lines.flatMap((line, index) => [
      `${index + 1}. ${line.name}${line.assetId ? `（${line.assetId}）` : ''}｜借出 ${line.quantity}｜累計已還 ${line.returnedQuantity}｜待還 ${result.lines[index].outstanding}`,
      line.accessories ? `配件：${line.accessories}` : '',
      `借出狀況：${line.outCondition}`,
      line.returnDate
        ? `最近實際歸還日期：${line.returnDate}｜歸還狀況：${line.returnCondition}`
        : '尚未歸還',
    ]),
    draft.notes ? `備註：${draft.notes}` : '',
    `狀態核對：${today}（臺北時間）`,
    '出借人確認：________________',
    '借用人確認：________________',
    '歸還點收確認：________________',
    '歸還狀況與配件請由雙方現場核對；部分歸還記錄最近一次點收日期與狀況。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function equipmentReminderText(draft: EquipmentLoanDraft, today = getTaiwanDate()): string {
  if (!isValidInvoiceDate(today)) return '';
  const result = equipmentLoanResult(draft, today);
  if (!result.valid || result.outstanding === 0) return '';
  const outstandingLines = result.lines.flatMap((line, index) => {
    if (line.outstanding === null || line.outstanding <= 0) return [];
    const item = draft.lines[index];
    return [
      `${item.name}${item.assetId.trim() ? `（器材編號：${item.assetId}）` : ''}｜待還 ${line.outstanding} 件`,
    ];
  });
  return [
    '器材待還提醒',
    `借用人：${draft.borrower}`,
    `出借人：${draft.lender}`,
    draft.reference.trim() ? `借用編號：${draft.reference}` : '',
    `預定歸還日期：${draft.dueDate}`,
    `核對日期：${today}（臺北時間）`,
    result.overdue
      ? '預定歸還日期已過，請協助核對以下待還器材與歸還安排。'
      : '請協助核對以下待還器材與歸還安排。',
    ...outstandingLines.map((line, index) => `${index + 1}. ${line}`),
    '配件與歸還狀況請由雙方另行核對；本提醒不判定配件待還數量。',
    '如已完成歸還，請雙方核對並更新借還紀錄。',
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

export function exportEquipmentLoan(draft: EquipmentLoanDraft, today = getTaiwanDate()): string {
  const result = equipmentLoanResult(draft, today);
  if (!result.valid) throw new Error(result.errors.join(' '));
  const text = JSON.stringify({ schema: 'xiaoshiwu-equipment-loan', version: 1, draft }, null, 2);
  if (new TextEncoder().encode(text).byteLength > EQUIPMENT_BACKUP_LIMIT)
    throw new Error('備份超過 5 MB。');
  return text;
}

export function importEquipmentLoan(text: string, today = getTaiwanDate()): EquipmentLoanDraft {
  if (new TextEncoder().encode(text).byteLength > EQUIPMENT_BACKUP_LIMIT)
    throw new Error('備份超過 5 MB。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('不是有效的 JSON 備份。');
  }
  const backup = objectFields(parsed, ['schema', 'version', 'draft']);
  if (backup.schema !== 'xiaoshiwu-equipment-loan' || backup.version !== 1)
    throw new Error('不支援此器材借還備份格式或版本。');
  const raw = objectFields(backup.draft, [
    'reference',
    'lender',
    'lenderContact',
    'borrower',
    'borrowerContact',
    'purpose',
    'loanDate',
    'dueDate',
    'notes',
    'lines',
  ]);
  if (!Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > MAX_EQUIPMENT_LINES)
    throw new Error('備份須含 1 至 50 筆器材。');
  const draft: EquipmentLoanDraft = {
    reference: stringField(raw.reference, 80),
    lender: stringField(raw.lender, 100),
    lenderContact: stringField(raw.lenderContact, 200),
    borrower: stringField(raw.borrower, 100),
    borrowerContact: stringField(raw.borrowerContact, 200),
    purpose: stringField(raw.purpose, 500),
    loanDate: stringField(raw.loanDate, 10),
    dueDate: stringField(raw.dueDate, 10),
    notes: stringField(raw.notes, 1000),
    lines: raw.lines.map((entry) => {
      const line = objectFields(entry, [
        'id',
        'assetId',
        'name',
        'accessories',
        'quantity',
        'outCondition',
        'returnedQuantity',
        'returnDate',
        'returnCondition',
      ]);
      return {
        id: stringField(line.id, 100),
        assetId: stringField(line.assetId, 80),
        name: stringField(line.name, 100),
        accessories: stringField(line.accessories, 300),
        quantity: stringField(line.quantity, 4),
        outCondition: stringField(line.outCondition, 300),
        returnedQuantity: stringField(line.returnedQuantity, 4),
        returnDate: stringField(line.returnDate, 10),
        returnCondition: stringField(line.returnCondition, 300),
      };
    }),
  };
  const result = equipmentLoanResult(draft, today);
  if (!result.valid) throw new Error(result.errors.join(' '));
  return draft;
}
