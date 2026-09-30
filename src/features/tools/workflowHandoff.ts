import type { InvoiceLineInput, PriceMode, TaxType } from '../../domain/invoice.ts';
import { calculateHourly, type HourlyInput } from '../../domain/adminTools.ts';
import { documentResult, type BusinessDocumentDraft } from './documents.ts';
import { deliveryNoteResult, type DeliveryNoteDraft } from './tradeDocuments.ts';

// Explicit in-memory transfers. Receiving tools ask before replacing a draft.
export interface AcceptanceSeed {
  issuer: string;
  customer: string;
  reference: string;
  lines: { name: string; quantity: string }[];
  pricing?: { priceMode: PriceMode; taxType: TaxType; lines: InvoiceLineInput[] };
}

export interface QuoteSeed {
  kind: 'quote' | 'payment';
  issuer: string;
  customer: string;
  reference: string;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
  notes: string;
}

export interface PurchaseSeed {
  supplier: string;
  supplierContact: string;
  deliveryDate: string;
  priceMode: PriceMode;
  taxType: TaxType;
  lines: InvoiceLineInput[];
  notes: string;
}

export interface CostSeed {
  lines: { name: string; amount: string }[];
}

export function documentToAcceptance(draft: BusinessDocumentDraft): AcceptanceSeed | null {
  if (!documentResult(draft).valid) return null;
  return {
    issuer: draft.issuer,
    customer: draft.customer,
    reference: draft.number,
    lines: draft.lines.map(({ name, quantity }) => ({ name, quantity })),
    pricing: {
      priceMode: draft.priceMode,
      taxType: draft.taxType,
      lines: draft.lines.map((line) => ({ ...line })),
    },
  };
}

export function deliveryToAcceptance(draft: DeliveryNoteDraft): AcceptanceSeed | null {
  if (!deliveryNoteResult(draft).valid) return null;
  return {
    issuer: draft.sender,
    customer: draft.recipient,
    reference: draft.reference,
    lines: draft.lines.map(({ name, quantity }) => ({ name, quantity })),
    ...(draft.showPrices
      ? {
          pricing: {
            priceMode: draft.priceMode,
            taxType: draft.taxType,
            lines: draft.lines.map((line) => ({ ...line })),
          },
        }
      : {}),
  };
}

export function hourlyToCosts(lines: HourlyInput[]): CostSeed | null {
  const result = calculateHourly(lines);
  if (!result.valid) return null;
  return {
    lines: result.lines.map(({ name, cents }) => ({
      name,
      amount: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`,
    })),
  };
}
