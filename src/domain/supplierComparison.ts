import {
  calculateInvoice,
  type InvoiceCalculation,
  type InvoiceLineInput,
  type PriceMode,
  type TaxType,
} from './invoice.ts';
import type { PurchaseSeed } from '../features/tools/workflowHandoff.ts';
import { isValidInvoiceDate } from '../utils/dateUtils.ts';

export interface ComparisonItem {
  id: string;
  name: string;
  quantity: string;
}
export interface SupplierOffer {
  id: string;
  name: string;
  contact: string;
  prices: Record<string, string>;
  priceMode: PriceMode;
  taxType: TaxType;
  shipping: string;
  deliveryDate: string;
  leadTime: string;
  warranty: string;
  paymentTerms: string;
}
export interface SupplierResult {
  id: string;
  valid: boolean;
  errors: string[];
  productsGross: number | null;
  shippingGross: number | null;
  calculation: InvoiceCalculation | null;
  purchaseLines: InvoiceLineInput[];
  difference: number | null;
}
export interface ComparisonResult {
  valid: boolean;
  errors: string[];
  suppliers: SupplierResult[];
  lowestGross: number | null;
}
export const comparisonPriceLabels: Record<PriceMode, string> = { subtotal: '未稅', total: '含稅' };
export const comparisonTaxLabels: Record<TaxType, string> = {
  regular: '應稅 5%',
  'zero-rate': '零稅率',
  exempt: '免稅',
};

/** Preserve the invoice's already-calculated gross; apportion only its rounding remainder. */
function productGrossLines(calculation: InvoiceCalculation, mode: PriceMode): number[] {
  if (mode === 'total' || calculation.tax === 0)
    return calculation.lines.map((line) => line.inputAmount);
  const base = calculation.lines.map((line) => BigInt(line.inputAmount));
  const total = BigInt(calculation.subtotal);
  const tax = BigInt(calculation.tax);
  const shares = base.map((amount) => (amount * tax) / total);
  const remaining = Number(tax - shares.reduce((sum, share) => sum + share, 0n));
  const priority = base.map((amount, index) => ({ index, remainder: (amount * tax) % total }));
  // oxlint-disable-next-line unicorn/no-array-sort
  priority.sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const row of priority.slice(0, remaining)) shares[row.index] += 1n;
  return base.map((amount, index) => Number(amount + shares[index]));
}

function evaluateSupplier(
  items: ComparisonItem[],
  offer: SupplierOffer,
  sharedErrors: string[],
): SupplierResult {
  const errors = [...sharedErrors];
  if (!offer.name.trim()) errors.push('請填寫廠商名稱。');
  if (offer.priceMode !== 'subtotal' && offer.priceMode !== 'total')
    errors.push('請選擇單價含稅方式。');
  if (!['regular', 'zero-rate', 'exempt'].includes(offer.taxType)) errors.push('請選擇稅別。');
  if (offer.deliveryDate && !isValidInvoiceDate(offer.deliveryDate))
    errors.push('請填寫有效的預計交貨日期。');
  const rawLines = items.map((item) => ({ ...item, unitPrice: offer.prices[item.id] ?? '' }));
  const products = calculateInvoice(rawLines, offer.priceMode, offer.taxType);
  if (!products.valid) errors.push(...Object.values(products.errors));
  const shipping = calculateInvoice(
    [{ id: 'shipping', name: '運費', quantity: '1', unitPrice: offer.shipping }],
    'total',
    offer.taxType,
  );
  if (!shipping.valid) errors.push('含稅運費：請填寫 0 至 999,999,999 元，最多 2 位小數。');
  const failure = (): SupplierResult => ({
    id: offer.id,
    valid: false,
    errors: [...new Set(errors)],
    productsGross: null,
    shippingGross: null,
    calculation: null,
    purchaseLines: [],
    difference: null,
  });
  if (errors.length) return failure();
  const gross = productGrossLines(products, offer.priceMode);
  const purchaseLines: InvoiceLineInput[] = items.map((item, index) => ({
    id: `comparison-item-${item.id}`,
    name: `${item.name.trim()}（原數量 ${products.lines[index].quantity}；批次）`,
    quantity: '1',
    unitPrice: String(gross[index]),
  }));
  purchaseLines.push({
    id: 'comparison-shipping',
    name: '運費（含稅）',
    quantity: '1',
    unitPrice: String(shipping.amount),
  });
  const combined = calculateInvoice(purchaseLines, 'total', offer.taxType);
  if (!combined.valid || combined.amount !== products.amount + shipping.amount) {
    errors.push(
      ...Object.values(combined.errors),
      '商品與運費合計須在支援範圍內，且與採購移交金額一致。',
    );
    return failure();
  }
  return {
    id: offer.id,
    valid: true,
    errors: [],
    productsGross: products.amount,
    shippingGross: shipping.amount,
    calculation: combined,
    purchaseLines,
    difference: null,
  };
}

export function compareSuppliers(
  items: ComparisonItem[],
  offers: SupplierOffer[],
): ComparisonResult {
  const errors: string[] = [];
  if (items.length < 1 || items.length > 20) errors.push('共同採購品項須為 1 至 20 筆。');
  if (offers.length < 2 || offers.length > 5) errors.push('請比較 2 至 5 家廠商。');
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(offers.map((offer) => offer.id)).size !== offers.length
  )
    errors.push('品項與廠商識別不可重複。');
  const suppliers = offers.map((offer) => evaluateSupplier(items, offer, errors));
  const validTotals = suppliers
    .filter((supplier) => supplier.valid)
    .map((supplier) => supplier.calculation!.amount);
  const lowestGross = validTotals.length ? Math.min(...validTotals) : null;
  for (const supplier of suppliers)
    if (supplier.valid && lowestGross !== null)
      supplier.difference = supplier.calculation!.amount - lowestGross;
  return {
    valid: !errors.length && suppliers.every((supplier) => supplier.valid),
    errors,
    suppliers,
    lowestGross,
  };
}

const priceText = (price: string): string => {
  const [whole, fraction = ''] = price.trim().split('.');
  return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
};
export function supplierToPurchase(
  items: ComparisonItem[],
  offers: SupplierOffer[],
  supplierId: string,
): PurchaseSeed | null {
  const comparison = compareSuppliers(items, offers);
  const offer = offers.find((entry) => entry.id === supplierId);
  const result = comparison.suppliers.find((entry) => entry.id === supplierId);
  if (!offer || !result?.valid) return null;
  const notes = [
    '由報價比較帶入；各商品轉為數量 1 的含稅批次金額，名稱保留原數量。',
    `原報價：${comparisonPriceLabels[offer.priceMode]}單價；${comparisonTaxLabels[offer.taxType]}。`,
    ...items.map(
      (item) =>
        `${item.name.trim()}：原數量 ${BigInt(item.quantity.trim())}；原${comparisonPriceLabels[offer.priceMode]}單價 NT$ ${priceText(offer.prices[item.id])}。`,
    ),
    `原含稅運費 NT$ ${priceText(offer.shipping)}，整元運費 NT$ ${result.shippingGross}，已獨立列入。`,
    offer.leadTime ? `交期：${offer.leadTime}` : '',
    offer.warranty ? `保固：${offer.warranty}` : '',
    offer.paymentTerms ? `付款條件：${offer.paymentTerms}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    supplier: offer.name.trim(),
    supplierContact: offer.contact,
    deliveryDate: offer.deliveryDate,
    priceMode: 'total',
    taxType: offer.taxType,
    lines: result.purchaseLines.map((line) => ({ ...line })),
    notes,
  };
}

export function comparisonText(items: ComparisonItem[], offers: SupplierOffer[]): string {
  const result = compareSuppliers(items, offers);
  if (!result.valid) return '';
  return [
    '多家報價比較（新臺幣；以商品加含稅運費的總支出比較）',
    ...items.map((item) => `${item.name} × ${item.quantity}`),
    ...offers.flatMap((offer, index) => {
      const row = result.suppliers[index];
      return [
        '',
        offer.name,
        `原報價：${comparisonPriceLabels[offer.priceMode]}單價；${comparisonTaxLabels[offer.taxType]}`,
        ...items.map((item) => `${item.name}：原單價 NT$ ${priceText(offer.prices[item.id])}`),
        `商品含稅：NT$ ${row.productsGross}；含稅運費：NT$ ${row.shippingGross}`,
        `含稅總支出：NT$ ${row.calculation!.amount}；較最低有效報價：+ NT$ ${row.difference}`,
        `預計交貨：${offer.deliveryDate || '未提供'}；交期：${offer.leadTime || '未提供'}`,
        `保固：${offer.warranty || '未提供'}；付款條件：${offer.paymentTerms || '未提供'}`,
      ];
    }),
    '最低金額只供比較；請自行確認規格、品質與交易條件後選商。',
  ].join('\n');
}
