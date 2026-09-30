import {
  validateAmount,
  type InvoiceLineInput,
  type PriceMode,
  type TaxType,
} from '../../domain/invoice.ts';
import { getTaiwanDate, isValidInvoiceDate } from '../../utils/dateUtils.ts';

export interface InvoiceDraft {
  buyer: string;
  uniformNumber: string;
  date: string;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
}

export function emptyLine(): InvoiceLineInput {
  return { id: crypto.randomUUID(), name: '', quantity: '1', unitPrice: '' };
}

export function emptyDraft(): InvoiceDraft {
  return {
    buyer: '',
    uniformNumber: '',
    date: getTaiwanDate(),
    priceMode: 'total',
    taxType: 'regular',
    lines: [emptyLine()],
  };
}

export function exampleDraft(): InvoiceDraft {
  return {
    ...emptyDraft(),
    lines: [
      { id: crypto.randomUUID(), name: '視覺設計服務', quantity: '1', unitPrice: '10500' },
      { id: crypto.randomUUID(), name: '印刷製作', quantity: '2', unitPrice: '525' },
    ],
  };
}

/** Read legacy prefill URLs without letting invalid values reach calculations. */
export function createInitialDraft(search = window.location.search): {
  draft: InvoiceDraft;
  notice: string;
} {
  const draft = emptyDraft();
  const params = new URLSearchParams(search);
  const notices: string[] = [];
  const uniformNumber = params.get('uniformNumber');
  const amount = params.get('amount');
  const itemName = params.get('itemName');
  const date = params.get('date');
  if (uniformNumber !== null) {
    if (/^\d{8}$/.test(uniformNumber)) draft.uniformNumber = uniformNumber;
    else notices.push('連結中的統編無效，請重新輸入。');
  }
  if (amount !== null) {
    if (validateAmount(amount) === null) draft.lines[0].unitPrice = amount;
    else notices.push('連結中的金額無效，請重新輸入。');
  }
  if (itemName) draft.lines[0].name = itemName.slice(0, 100);
  if (date !== null) {
    if (isValidInvoiceDate(date)) draft.date = date;
    else notices.push('連結中的日期無效，已使用今天。');
  }
  return { draft, notice: notices.join(' ') };
}

export function hasEnteredData(draft: InvoiceDraft): boolean {
  return Boolean(
    draft.buyer || draft.uniformNumber || draft.lines.some((line) => line.name || line.unitPrice),
  );
}
