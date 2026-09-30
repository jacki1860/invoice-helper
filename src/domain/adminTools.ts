import { MAX_AMOUNT } from './invoice.ts';
import { isValidInvoiceDate } from '../utils/dateUtils.ts';

const wholePattern = /^\d+$/;
const decimalPattern = /^\d+(?:\.\d{1,2})?$/;
const parseScaled = (value: string): bigint => {
  const [whole, fraction = ''] = value.trim().split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

export interface SplitResult {
  valid: boolean;
  error: string;
  total: number;
  amounts: number[];
}

const splitFailure = (error: string): SplitResult => ({
  valid: false,
  error,
  total: 0,
  amounts: [],
});

/** Allocate whole dollars by largest remainder. Input order breaks ties. */
export function splitPayment(totalText: string, shares: string[] | number): SplitResult {
  if (!wholePattern.test(totalText.trim()) || BigInt(totalText.trim()) > BigInt(MAX_AMOUNT)) {
    return splitFailure('請輸入 0 至 999,999,999 的整元金額。');
  }
  let weights: bigint[];
  if (typeof shares === 'number') {
    if (!Number.isInteger(shares) || shares < 2 || shares > 100)
      return splitFailure('均分份數須為 2 至 100。');
    weights = Array.from({ length: shares }, () => 1n);
  } else {
    if (shares.length < 2 || shares.length > 12) return splitFailure('請設定 2 至 12 期。');
    if (
      shares.some((value) => !decimalPattern.test(value.trim()) || parseScaled(value) > 10_000n)
    ) {
      return splitFailure('每期比例須為 0 至 100，最多 2 位小數。');
    }
    weights = shares.map(parseScaled);
    if (weights.reduce((sum, value) => sum + value, 0n) !== 10_000n)
      return splitFailure('所有期數的比例合計必須為 100%。');
  }
  const total = BigInt(totalText.trim());
  const denominator = weights.reduce((sum, value) => sum + value, 0n);
  const amounts = weights.map((weight) => (total * weight) / denominator);
  const remainder = Number(total - amounts.reduce((sum, value) => sum + value, 0n));
  const priority = weights.map((weight, index) => ({
    index,
    fraction: (total * weight) % denominator,
  }));
  // oxlint-disable-next-line unicorn/no-array-sort
  priority.sort((left, right) =>
    left.fraction === right.fraction
      ? left.index - right.index
      : left.fraction > right.fraction
        ? -1
        : 1,
  );
  for (const entry of priority.slice(0, remainder)) amounts[entry.index] += 1n;
  return { valid: true, error: '', total: Number(total), amounts: amounts.map(Number) };
}

export interface HourlyInput {
  id: string;
  name: string;
  hours: string;
  minutes: string;
  rate: string;
}

export interface HourlyResult {
  valid: boolean;
  errors: Record<string, string>;
  lines: { id: string; name: string; minutes: number; cents: number }[];
  minutes: number;
  cents: number;
}

export function calculateHourly(inputs: HourlyInput[]): HourlyResult {
  const errors: Record<string, string> = {};
  const lines: HourlyResult['lines'] = [];
  if (!inputs.length || inputs.length > 50) errors.total = '請填寫 1 至 50 筆工時。';
  for (const input of inputs) {
    if (!input.name.trim()) errors[`${input.id}.name`] = '請填寫工作項目。';
    if (
      !wholePattern.test(input.hours.trim()) ||
      BigInt(input.hours.trim()) > 9999n ||
      !wholePattern.test(input.minutes.trim()) ||
      BigInt(input.minutes.trim()) > 59n
    ) {
      errors[`${input.id}.time`] = '小時須為 0 至 9,999 的整數，分鐘須為 0 至 59。';
    }
    if (
      !decimalPattern.test(input.rate.trim()) ||
      parseScaled(input.rate) > BigInt(MAX_AMOUNT) * 100n
    ) {
      errors[`${input.id}.rate`] = '時薪須為非負金額，最多 2 位小數，且不超過 999,999,999 元。';
    }
    if (errors[`${input.id}.time`] || errors[`${input.id}.rate`]) continue;
    const minutes = Number(input.hours) * 60 + Number(input.minutes);
    if (minutes === 0) {
      errors[`${input.id}.time`] = '工作時間須大於 0 分鐘。';
      continue;
    }
    // Round each displayed line to cents, then sum the displayed amounts.
    const cents = (parseScaled(input.rate) * BigInt(minutes) * 2n + 60n) / 120n;
    if (cents > BigInt(MAX_AMOUNT) * 100n) {
      errors.total = '總費用不可超過 999,999,999 元。';
      continue;
    }
    lines.push({ id: input.id, name: input.name.trim(), minutes, cents: Number(cents) });
  }
  const cents = lines.reduce((sum, line) => sum + line.cents, 0);
  if (cents > MAX_AMOUNT * 100) errors.total = '總費用不可超過 999,999,999 元。';
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    lines,
    minutes: lines.reduce((sum, line) => sum + line.minutes, 0),
    cents,
  };
}

/** ROC has no year zero; pre-ROC years are handled explicitly by the era input. */
export function rocToGregorian(
  yearText: string,
  monthText: string,
  dayText: string,
  before = false,
): string | null {
  if (![yearText, monthText, dayText].every((value) => wholePattern.test(value.trim())))
    return null;
  const rocYear = Number(yearText);
  const year = before ? 1912 - rocYear : 1911 + rocYear;
  if (!Number.isInteger(rocYear) || rocYear < 1 || year < 1 || year > 9999) return null;
  const candidate = `${String(year).padStart(4, '0')}-${String(Number(monthText)).padStart(2, '0')}-${String(Number(dayText)).padStart(2, '0')}`;
  return isValidInvoiceDate(candidate) ? candidate : null;
}

export function gregorianToRoc(
  date: string,
): { year: number; month: number; day: number; before: boolean } | null {
  if (!isValidInvoiceDate(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  return { year: year > 1911 ? year - 1911 : 1912 - year, month, day, before: year < 1912 };
}
