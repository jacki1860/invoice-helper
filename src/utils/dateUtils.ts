const taiwanDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface FormattedDatePart {
  text: string;
  highlight: boolean;
}

/** Accept only a real Gregorian calendar date in the YYYY-MM-DD form. */
export const isValidInvoiceDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
};

const chineseDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const toChineseMonth = (month: number): string =>
  month < 10 ? chineseDigits[month] : `十${month === 10 ? '' : chineseDigits[month - 10]}`;
const toChineseYear = (year: number): string =>
  [...year.toString()].map((digit) => chineseDigits[Number(digit)]).join('');

/** Return today's date in Taipei; the optional instant makes timezone boundaries testable. */
export const getTaiwanDate = (instant: Date = new Date()): string => {
  if (!Number.isFinite(instant.getTime())) return '';
  const parts = taiwanDateFormatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
};

/** Format a selected calendar date without converting it through the host timezone. */
export const formatTaiwanDate = (dateStr: string): FormattedDatePart[] => {
  if (!isValidInvoiceDate(dateStr)) return [];
  const [yearText, month, day] = dateStr.split('-');
  const year = Number(yearText) - 1911;
  return [
    { text: year > 0 ? '中華民國 ' : '民國前 ', highlight: false },
    { text: String(year > 0 ? year : 1 - year), highlight: true },
    { text: ' 年 ', highlight: false },
    { text: month, highlight: true },
    { text: ' 月 ', highlight: false },
    { text: day, highlight: true },
    { text: ' 日', highlight: false },
  ];
};

/** Return the two-month invoice period, or an empty string for an invalid date. */
export const getInvoicePeriod = (date: string): string => {
  if (!isValidInvoiceDate(date)) return '';
  const [calendarYear, month] = date.split('-').map(Number);
  const year = calendarYear - 1911;
  const displayYear = year > 0 ? toChineseYear(year) : `民國前${toChineseYear(1 - year)}`;
  const periodStart = Math.floor((month - 1) / 2) * 2 + 1;
  return `${displayYear}年${toChineseMonth(periodStart)}、${toChineseMonth(periodStart + 1)}月份`;
};
