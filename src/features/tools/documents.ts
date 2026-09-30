import {
  calculateInvoice,
  type InvoiceLineInput,
  type PriceMode,
  type TaxType,
} from '../../domain/invoice.ts';
import { isValidInvoiceDate } from '../../utils/dateUtils.ts';

export interface BusinessDocumentDraft {
  kind: 'quote' | 'payment';
  issuer: string;
  issuerNumber: string;
  issuerContact: string;
  customer: string;
  customerNumber: string;
  number: string;
  date: string;
  dueDate: string;
  paymentDetails: string;
  notes: string;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
}

export function hasBusinessDocumentContent(
  draft: BusinessDocumentDraft,
  initialDate: string,
): boolean {
  return (
    [
      draft.issuer,
      draft.issuerNumber,
      draft.issuerContact,
      draft.customer,
      draft.customerNumber,
      draft.number,
      draft.dueDate,
      draft.paymentDetails,
      draft.notes,
    ].some(Boolean) ||
    draft.date !== initialDate ||
    draft.priceMode !== 'subtotal' ||
    draft.taxType !== 'regular' ||
    draft.lines.length !== 1 ||
    draft.lines.some((line) => line.name || line.unitPrice || line.quantity !== '1')
  );
}

export function documentResult(draft: BusinessDocumentDraft) {
  const calculation = calculateInvoice(draft.lines, draft.priceMode, draft.taxType);
  const errors: string[] = [];
  if (!draft.issuer.trim()) errors.push('請填寫開立方。');
  if (!draft.customer.trim()) errors.push('請填寫客戶名稱。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的文件日期。');
  if (draft.dueDate && (!isValidInvoiceDate(draft.dueDate) || draft.dueDate < draft.date))
    errors.push('期限須為有效日期，且不得早於文件日期。');
  if (
    [draft.issuerNumber, draft.customerNumber].some(
      (value) => value !== '' && !/^\d{8}$/.test(value),
    )
  )
    errors.push('統一編號可留空；填寫時須為 8 位數字。');
  return { calculation, errors, valid: calculation.valid && errors.length === 0 };
}

export function businessDocumentText(draft: BusinessDocumentDraft): string {
  const { calculation, valid } = documentResult(draft);
  if (!valid) return '';
  return [
    draft.kind === 'quote' ? '報價單' : '請款單',
    `文件編號：${draft.number || '未填寫'}`,
    `日期：${draft.date}`,
    draft.dueDate
      ? `${draft.kind === 'quote' ? '報價有效期限' : '付款期限'}：${draft.dueDate}`
      : '',
    `開立方：${draft.issuer}`,
    draft.issuerNumber ? `開立方統編：${draft.issuerNumber}` : '',
    draft.issuerContact,
    `客戶：${draft.customer}`,
    draft.customerNumber ? `客戶統編：${draft.customerNumber}` : '',
    `品名\t數量\t單價（${draft.priceMode === 'total' ? '含稅' : '未稅'}）\t金額`,
    ...calculation.lines.map(
      (line) => `${line.name}\t${line.quantity}\t${line.unitPrice}\t${line.inputAmount}`,
    ),
    `未稅金額：${calculation.subtotal}`,
    `稅額：${calculation.tax}`,
    `總計：${calculation.amount}`,
    draft.paymentDetails ? `付款資訊：\n${draft.paymentDetails}` : '',
    draft.notes ? `備註：\n${draft.notes}` : '',
    '本文件非統一發票。',
  ]
    .filter(Boolean)
    .join('\n');
}
