export type PriceMode = 'total' | 'subtotal';
export type TaxType = 'regular' | 'zero-rate' | 'exempt';

export const MAX_AMOUNT = 999_999_999;
export const MAX_QUANTITY = 9_999;

export interface InvoiceLineInput {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

export interface CalculatedLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  inputAmount: number;
  subtotal: number;
  unitPriceExcl: number;
}

export interface InvoiceCalculation {
  subtotal: number;
  tax: number;
  amount: number;
  lines: CalculatedLine[];
  errors: Record<string, string>;
  valid: boolean;
}

const maximumAmount = BigInt(MAX_AMOUNT);
const amountPattern = /^\d+(?:\.\d{1,2})?$/;

// Called only after validating decimal syntax; no binary decimal arithmetic is used.
const toCents = (value: string): bigint => {
  const [whole, fraction = ''] = value.trim().split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const roundRatio = (numerator: bigint, denominator: bigint): bigint =>
  (numerator * 2n + denominator) / (denominator * 2n);

/** Validate a non-negative decimal price, with at most two decimal places. */
export const validateAmount = (value: string): string | null => {
  if (!value.trim()) return '請輸入單價';
  if (!amountPattern.test(value.trim())) return '請輸入非負金額，最多 2 位小數';
  if (toCents(value) > maximumAmount * 100n) return '單價不可超過 999,999,999 元';
  return null;
};

const parseQuantity = (value: string): number | null => {
  if (!/^\d+$/.test(value.trim())) return null;
  const quantity = BigInt(value.trim());
  return quantity >= 1n && quantity <= BigInt(MAX_QUANTITY) ? Number(quantity) : null;
};

interface ParsedLine {
  input: InvoiceLineInput;
  quantity: number;
  cents: bigint;
  amount: bigint;
}

/**
 * Calculate whole-dollar invoice totals from decimal prices parsed as integer cents.
 * Inclusive input fixes the gross line amounts. Tax is rounded once for the invoice;
 * the sales amount is distributed by largest remainder, with input order breaking ties.
 * This follows the tax-rounding principle in MOF's electronic filing rules, section 20(15):
 * https://law-out.mof.gov.tw/LawContent.aspx?id=GL009478&media=print
 *
 * Invalid numeric rows are excluded from the preview, but errors always make valid false.
 * A total outside the supported range returns empty lines and zero totals, never a capped total.
 */
export const calculateInvoice = (
  lines: InvoiceLineInput[],
  priceMode: PriceMode,
  taxType: TaxType,
): InvoiceCalculation => {
  const errors: Record<string, string> = {};
  const parsed: ParsedLine[] = [];

  if (lines.length === 0) errors.total = '請至少新增一個品項';

  for (const input of lines) {
    if (!input.name.trim()) errors[`${input.id}.name`] = '請輸入品名';
    const quantity = parseQuantity(input.quantity);
    if (quantity === null) {
      errors[`${input.id}.quantity`] = '數量須為 1 至 9,999 的整數';
    }
    const priceError = validateAmount(input.unitPrice);
    if (priceError) errors[`${input.id}.unitPrice`] = priceError;
    if (quantity === null || priceError) continue;

    const cents = toCents(input.unitPrice);
    parsed.push({
      input,
      quantity,
      cents,
      amount: roundRatio(cents * BigInt(quantity), 100n),
    });
  }

  const inputTotal = parsed.reduce((sum, line) => sum + line.amount, 0n);
  const tax =
    taxType === 'regular' ? roundRatio(inputTotal * 5n, priceMode === 'total' ? 105n : 100n) : 0n;
  const subtotal = priceMode === 'total' ? inputTotal - tax : inputTotal;
  const amount = priceMode === 'total' ? inputTotal : inputTotal + tax;

  if (amount > maximumAmount) {
    errors.total = '發票總額不可超過 999,999,999 元';
    return { subtotal: 0, tax: 0, amount: 0, lines: [], errors, valid: false };
  }

  let lineSubtotals = parsed.map((line) => line.amount);
  if (priceMode === 'total' && taxType === 'regular') {
    lineSubtotals = parsed.map((line) => (line.amount * 100n) / 105n);
    const baseTotal = lineSubtotals.reduce((sum, value) => sum + value, 0n);
    const remaining = Number(subtotal - baseTotal);
    const priority = parsed
      .map((line, index) => ({
        index,
        remainder: (line.amount * 100n) % 105n,
      }))
      // This new array is owned here; toSorted would require an ES2023 runtime.
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((left, right) => {
        if (left.remainder === right.remainder) return left.index - right.index;
        return left.remainder > right.remainder ? -1 : 1;
      });
    for (const { index } of priority.slice(0, remaining)) lineSubtotals[index] += 1n;
  }

  const calculatedLines = parsed.map((line, index): CalculatedLine => {
    const lineSubtotal = Number(lineSubtotals[index]);
    return {
      id: line.input.id,
      name: line.input.name,
      quantity: line.quantity,
      unitPrice: Number(line.cents) / 100,
      inputAmount: Number(line.amount),
      subtotal: lineSubtotal,
      unitPriceExcl:
        priceMode === 'total' && taxType === 'regular'
          ? lineSubtotal / line.quantity
          : Number(line.cents) / 100,
    };
  });

  return {
    subtotal: Number(subtotal),
    tax: Number(tax),
    amount: Number(amount),
    lines: calculatedLines,
    errors,
    valid: Object.keys(errors).length === 0,
  };
};
