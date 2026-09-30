import { calculateInvoice, MAX_AMOUNT, validateAmount } from './invoice.ts';
import type { QuoteSeed } from '../features/tools/workflowHandoff.ts';

export type CostCategory = 'material' | 'labor' | 'outsource' | 'other';
export const costCategoryLabels: Record<CostCategory, string> = {
  material: '材料',
  labor: '工時',
  outsource: '外包',
  other: '其他',
};
export interface CostInput {
  id: string;
  name: string;
  category: CostCategory;
  amount: string;
}
export interface ProfitInput {
  lines: CostInput[];
  mode: 'price' | 'margin';
  salePrice: string;
  targetMargin: string;
}
export interface ProfitResult {
  valid: boolean;
  errors: Record<string, string>;
  costCents: number;
  saleCents: number;
  profitCents: number;
  marginBasisPoints: number | null;
  markupBasisPoints: number | null;
}
const cents = (text: string): bigint => {
  const [whole, fraction = ''] = text.trim().split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const limit = BigInt(MAX_AMOUNT) * 100n;
// Signed half-up rounding, applied only to displayed percentages.
const ratio = (numerator: bigint, denominator: bigint): number | null => {
  if (!denominator) return null;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude * 20_000n + denominator) / (denominator * 2n);
  return Number(numerator < 0n ? -rounded : rounded);
};
export const centsText = (value: number): string => {
  const integer = BigInt(value);
  const absolute = integer < 0n ? -integer : integer;
  return `${integer < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};
export const formatCents = (value: number): string =>
  (value / 100).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatPercent = (basisPoints: number | null): string =>
  basisPoints === null ? '未定義' : `${centsText(basisPoints)}%`;

/** All monetary arithmetic is in integer cents. Target prices round UP to one cent. */
export function calculateProfit(input: ProfitInput): ProfitResult {
  const errors: Record<string, string> = {};
  let cost = 0n;
  let sale = 0n;
  if (!input.lines.length || input.lines.length > 50) errors.lines = '請填寫 1 至 50 筆成本。';
  if (new Set(input.lines.map((line) => line.id)).size !== input.lines.length)
    errors.lines = '成本項目識別不可重複。';
  for (const line of input.lines) {
    if (!line.name.trim()) errors[`${line.id}.name`] = '請填寫成本名稱。';
    if (!Object.prototype.hasOwnProperty.call(costCategoryLabels, line.category))
      errors[`${line.id}.category`] = '請選擇成本分類。';
    const error = validateAmount(line.amount);
    if (error) errors[`${line.id}.amount`] = error.replace('單價', '成本');
    else cost += cents(line.amount);
  }
  if (cost > limit) errors.total = '成本合計不可超過 999,999,999 元。';
  if (input.mode === 'price') {
    const error = validateAmount(input.salePrice);
    if (error) errors.salePrice = error.replace('單價', '售價');
    else sale = cents(input.salePrice);
    if (!error && sale === 0n && cost > 0n) errors.salePrice = '有成本時，售價須大於 0。';
  } else if (input.mode === 'margin') {
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(input.targetMargin.trim()) ||
      cents(input.targetMargin) >= 10_000n
    ) {
      errors.targetMargin = '目標毛利率須為 0 至 99.99%，最多 2 位小數。';
    } else {
      const target = cents(input.targetMargin);
      if (cost === 0n && target > 0n)
        errors.targetMargin = '零成本無法反推此毛利率，請改為輸入售價。';
      const denominator = 10_000n - target;
      sale = (cost * 10_000n + denominator - 1n) / denominator;
      if (sale > limit) errors.salePrice = '反推售價超過 999,999,999 元，請降低目標毛利率。';
    }
  } else errors.mode = '請選擇售價試算方式。';
  const valid = Object.keys(errors).length === 0;
  if (!valid)
    return {
      valid,
      errors,
      costCents: 0,
      saleCents: 0,
      profitCents: 0,
      marginBasisPoints: null,
      markupBasisPoints: null,
    };
  const profit = sale - cost;
  return {
    valid,
    errors,
    costCents: Number(cost),
    saleCents: Number(sale),
    profitCents: Number(profit),
    marginBasisPoints: ratio(profit, sale),
    markupBasisPoints: ratio(profit, cost),
  };
}

/** The customer-facing quote contains one selling-price line, never internal costs. */
export function profitToQuote(input: ProfitInput, projectName: string): QuoteSeed | null {
  const result = calculateProfit(input);
  if (!result.valid || result.saleCents <= 0 || !projectName.trim()) return null;
  const lines = [
    {
      id: 'profit-project',
      name: projectName.trim(),
      quantity: '1',
      unitPrice: centsText(result.saleCents),
    },
  ];
  const calculation = calculateInvoice(lines, 'subtotal', 'regular');
  if (!calculation.valid || calculation.subtotal < 1) return null;
  return {
    kind: 'quote',
    issuer: '',
    customer: '',
    reference: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines,
    notes: '',
  };
}

export function profitText(input: ProfitInput, projectName: string): string {
  const result = calculateProfit(input);
  if (!result.valid) return '';
  return [
    '成本與利潤試算（內部使用，金額皆為未稅新臺幣）',
    projectName ? `專案：${projectName}` : '',
    ...input.lines.map(
      (line) =>
        `${costCategoryLabels[line.category]}｜${line.name}：NT$ ${formatCents(Number(cents(line.amount)))}`,
    ),
    `成本合計：NT$ ${formatCents(result.costCents)}`,
    `售價：NT$ ${formatCents(result.saleCents)}`,
    `毛利：NT$ ${formatCents(result.profitCents)}`,
    `毛利率（毛利 ÷ 售價）：${formatPercent(result.marginBasisPoints)}`,
    `成本加成率（毛利 ÷ 成本）：${formatPercent(result.markupBasisPoints)}`,
    '僅依輸入成本試算，未扣除未列入的費用與所得稅。',
  ]
    .filter(Boolean)
    .join('\n');
}
