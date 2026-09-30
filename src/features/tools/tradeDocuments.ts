import {
  calculateInvoice,
  MAX_AMOUNT,
  type InvoiceLineInput,
  type PriceMode,
  type TaxType,
} from '../../domain/invoice.ts';
import { isValidInvoiceDate } from '../../utils/dateUtils.ts';
import { formatChineseAmountText } from '../../utils/numberUtils.ts';
import type { ReceiptSeed } from './handoff.ts';

export interface ReceiptDraft extends ReceiptSeed {
  method: string;
  notes: string;
}

export interface PurchaseOrderDraft {
  buyer: string;
  supplier: string;
  buyerContact: string;
  supplierContact: string;
  reference: string;
  date: string;
  deliveryDate: string;
  deliveryPlace: string;
  notes: string;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
}

export interface DeliveryNoteDraft {
  sender: string;
  recipient: string;
  senderContact: string;
  recipientContact: string;
  reference: string;
  date: string;
  address: string;
  notes: string;
  showPrices: boolean;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
}

export function receiptFromSeed(seed: ReceiptSeed): ReceiptDraft {
  return {
    payer: seed.payer,
    payee: seed.payee,
    amount: seed.amount,
    purpose: seed.purpose,
    reference: seed.reference,
    date: seed.date,
    method: seed.method ?? '',
    notes: '',
  };
}

export function hasReceiptContent(draft: ReceiptDraft, initialDate: string): boolean {
  return (
    [draft.payer, draft.payee, draft.amount, draft.purpose, draft.reference, draft.notes].some(
      Boolean,
    ) ||
    draft.date !== initialDate ||
    draft.method !== '現金'
  );
}

export function receiptResult(draft: ReceiptDraft) {
  const errors: string[] = [];
  if (!draft.payer.trim()) errors.push('請填寫付款人。');
  if (!draft.payee.trim()) errors.push('請填寫收款人。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的收款日期。');
  if (!draft.purpose.trim()) errors.push('請填寫收款事由。');
  if (!draft.method.trim()) errors.push('請填寫付款方式。');
  const value = draft.amount.trim();
  const amount = /^\d+$/.test(value) ? Number(value) : NaN;
  const amountValid = Number.isInteger(amount) && amount >= 1 && amount <= MAX_AMOUNT;
  if (!amountValid) errors.push('實收金額須為 1 至 999,999,999 元的整數。');
  return { amount: amountValid ? amount : null, errors, valid: errors.length === 0 };
}

export function receiptText(draft: ReceiptDraft): string {
  const { amount, valid } = receiptResult(draft);
  if (!valid || amount === null) return '';
  return [
    '收據',
    `收款日期：${draft.date}`,
    draft.reference ? `收據／對應文件編號：${draft.reference}` : '',
    `收款人：${draft.payee}`,
    `付款人：${draft.payer}`,
    `實收金額：新臺幣 ${amount} 元`,
    `中文大寫：${formatChineseAmountText(amount)}`,
    `付款方式：${draft.method}`,
    `收款事由：${draft.purpose}`,
    draft.notes ? `備註：${draft.notes}` : '',
    '收款人簽章：________________',
    '本收據用於記錄實際收款，非統一發票。',
  ]
    .filter(Boolean)
    .join('\n');
}

function hasLineContent(lines: InvoiceLineInput[]): boolean {
  return (
    lines.length !== 1 || lines.some((line) => line.name || line.unitPrice || line.quantity !== '1')
  );
}

export function hasPurchaseOrderContent(draft: PurchaseOrderDraft, initialDate: string): boolean {
  return (
    [
      draft.buyer,
      draft.supplier,
      draft.buyerContact,
      draft.supplierContact,
      draft.reference,
      draft.deliveryDate,
      draft.deliveryPlace,
      draft.notes,
    ].some(Boolean) ||
    draft.date !== initialDate ||
    draft.priceMode !== 'subtotal' ||
    draft.taxType !== 'regular' ||
    hasLineContent(draft.lines)
  );
}

export function hasDeliveryNoteContent(draft: DeliveryNoteDraft, initialDate: string): boolean {
  return (
    [
      draft.sender,
      draft.recipient,
      draft.senderContact,
      draft.recipientContact,
      draft.reference,
      draft.address,
      draft.notes,
    ].some(Boolean) ||
    draft.date !== initialDate ||
    draft.showPrices ||
    draft.priceMode !== 'subtotal' ||
    draft.taxType !== 'regular' ||
    hasLineContent(draft.lines)
  );
}

export function purchaseOrderResult(draft: PurchaseOrderDraft) {
  const calculation = calculateInvoice(draft.lines, draft.priceMode, draft.taxType);
  const errors: string[] = [];
  if (!draft.buyer.trim()) errors.push('請填寫採購方。');
  if (!draft.supplier.trim()) errors.push('請填寫供應商。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的採購日期。');
  if (
    draft.deliveryDate &&
    (!isValidInvoiceDate(draft.deliveryDate) || draft.deliveryDate < draft.date)
  )
    errors.push('交貨日期須為有效日期，且不得早於採購日期。');
  return { calculation, errors, valid: calculation.valid && errors.length === 0 };
}

export function deliveryNoteResult(draft: DeliveryNoteDraft) {
  // Hidden prices are not part of a delivery document. Validate names and quantities
  // with zero-price copies; never parse, total, or expose the retained editor prices.
  const lines = draft.showPrices
    ? draft.lines
    : draft.lines.map((line) => ({ ...line, unitPrice: '0' }));
  const calculation = calculateInvoice(
    lines,
    draft.showPrices ? draft.priceMode : 'subtotal',
    draft.showPrices ? draft.taxType : 'exempt',
  );
  const errors: string[] = [];
  if (!draft.sender.trim()) errors.push('請填寫出貨方。');
  if (!draft.recipient.trim()) errors.push('請填寫收貨方。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的送貨日期。');
  return { calculation, errors, valid: calculation.valid && errors.length === 0 };
}

const taxText: Record<TaxType, string> = {
  regular: '應稅 5%',
  'zero-rate': '零稅率',
  exempt: '免稅',
};

function pricedLinesText(
  calculation: ReturnType<typeof calculateInvoice>,
  priceMode: PriceMode,
  taxType: TaxType,
) {
  return [
    `品項\t數量\t單價（${priceMode === 'total' ? '含稅' : '未稅'}）\t金額`,
    ...calculation.lines.map(
      (line) => `${line.name}\t${line.quantity}\t${line.unitPrice}\t${line.inputAmount}`,
    ),
    `未稅金額：${calculation.subtotal}`,
    `稅額（${taxText[taxType]}）：${calculation.tax}`,
    `總計：新臺幣 ${calculation.amount} 元`,
    `中文大寫：${formatChineseAmountText(calculation.amount)}`,
  ];
}

export function purchaseOrderText(draft: PurchaseOrderDraft): string {
  const { calculation, valid } = purchaseOrderResult(draft);
  if (!valid) return '';
  return [
    '採購單',
    `採購日期：${draft.date}`,
    draft.reference ? `採購編號：${draft.reference}` : '',
    `採購方：${draft.buyer}`,
    draft.buyerContact ? `採購聯絡資訊：${draft.buyerContact}` : '',
    `供應商：${draft.supplier}`,
    draft.supplierContact ? `供應商聯絡資訊：${draft.supplierContact}` : '',
    draft.deliveryDate ? `預定交貨日期：${draft.deliveryDate}` : '',
    draft.deliveryPlace ? `交貨地點：${draft.deliveryPlace}` : '',
    ...pricedLinesText(calculation, draft.priceMode, draft.taxType),
    draft.notes ? `採購備註：${draft.notes}` : '',
    '採購方確認：________________',
    '供應商確認：________________',
    '本單記錄採購需求；品項、交期與付款條件請由雙方確認。非統一發票。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function deliveryNoteText(draft: DeliveryNoteDraft): string {
  const { calculation, valid } = deliveryNoteResult(draft);
  if (!valid) return '';
  return [
    '送貨／簽收單',
    `送貨日期：${draft.date}`,
    draft.reference ? `送貨／對應文件編號：${draft.reference}` : '',
    `出貨方：${draft.sender}`,
    draft.senderContact ? `出貨聯絡資訊：${draft.senderContact}` : '',
    `收貨方：${draft.recipient}`,
    draft.recipientContact ? `收貨聯絡資訊：${draft.recipientContact}` : '',
    draft.address ? `送達地址：${draft.address}` : '',
    ...(draft.showPrices
      ? pricedLinesText(calculation, draft.priceMode, draft.taxType)
      : ['品項\t數量', ...calculation.lines.map((line) => `${line.name}\t${line.quantity}`)]),
    draft.notes ? `送貨備註：${draft.notes}` : '',
    '送貨人：________________',
    '收貨人簽章：________________',
    '簽收日期／時間：________________',
    '點收情形／差異：________________',
    '請於點收時記錄數量與外觀差異。本單非統一發票。',
  ]
    .filter(Boolean)
    .join('\n');
}
