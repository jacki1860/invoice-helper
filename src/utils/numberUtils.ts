import { MAX_AMOUNT } from '../domain/invoice.ts';

const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
const units = ['', '拾', '佰', '仟', '萬', '拾', '佰', '仟', '億'];

interface ChineseAmountDisplay {
  digit: string | null;
  unit: string;
  show: boolean;
}

const isSupportedAmount = (amount: number): boolean =>
  Number.isInteger(amount) && amount >= 0 && amount <= MAX_AMOUNT;

/** Preserve the nine digit slots used by the legacy paper layout. Invalid amounts return []. */
export const formatChineseAmount = (amount: number): ChineseAmountDisplay[] => {
  if (!isSupportedAmount(amount)) return [];
  const number = amount.toString().padStart(9, '0');
  const firstDigit = amount === 0 ? 8 : number.search(/[1-9]/);
  return [...number].map((digit, index) => ({
    digit: index < firstDigit ? null : digits[Number(digit)],
    unit: units[8 - index],
    show: index >= firstDigit,
  }));
};

const formatFourDigits = (amount: number): string => {
  let text = '';
  let pendingZero = false;
  for (let place = 3; place >= 0; place--) {
    const digit = Math.floor(amount / 10 ** place) % 10;
    if (digit === 0) {
      if (text) pendingZero = true;
      continue;
    }
    if (pendingZero) text += digits[0];
    text += digits[digit] + units[place];
    pendingZero = false;
  }
  return text;
};

/** Format a supported whole-dollar amount as financial Chinese. Invalid amounts return ''. */
export const formatChineseAmountText = (amount: number): string => {
  if (!isSupportedAmount(amount)) return '';
  if (amount === 0) return '零元整';

  let text = '';
  let pendingZero = false;
  const groupUnits = ['', '萬', '億'];
  for (let groupIndex = 2; groupIndex >= 0; groupIndex--) {
    const group = Math.floor(amount / 10_000 ** groupIndex) % 10_000;
    if (group === 0) {
      if (text) pendingZero = true;
      continue;
    }
    if (text && (pendingZero || group < 1_000)) text += digits[0];
    text += formatFourDigits(group) + groupUnits[groupIndex];
    pendingZero = false;
  }
  return `${text}元整`;
};
