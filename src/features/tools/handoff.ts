import { documentResult, type BusinessDocumentDraft } from './documents.ts';

// In-memory transfers between tools; never serialized into a URL.
export interface ReceiptSeed {
  payer: string;
  payee: string;
  amount: string;
  purpose: string;
  reference: string;
  date: string;
  method?: string;
}

export interface ReceivableSeed {
  customer: string;
  issuer: string;
  title: string;
  reference: string;
  total: string;
  dueDate: string;
}

export interface ToolHandoff<T> {
  id: string;
  data: T;
}

export function paymentToReceipt(draft: BusinessDocumentDraft): ReceiptSeed | null {
  const { calculation, valid } = documentResult(draft);
  if (draft.kind !== 'payment' || !valid || calculation.amount <= 0) return null;
  return {
    payer: draft.customer,
    payee: draft.issuer,
    amount: String(calculation.amount),
    purpose: draft.number ? `請款單 ${draft.number} 對應款項` : draft.lines[0].name,
    reference: draft.number,
    // A bill date is not evidence of a payment date; the recipient form asks for it.
    date: '',
  };
}

export function paymentToReceivable(draft: BusinessDocumentDraft): ReceivableSeed | null {
  const { calculation, valid } = documentResult(draft);
  if (draft.kind !== 'payment' || !valid || calculation.amount <= 0) return null;
  return {
    customer: draft.customer,
    issuer: draft.issuer,
    title: draft.lines[0].name,
    reference: draft.number,
    total: String(calculation.amount),
    dueDate: draft.dueDate,
  };
}
