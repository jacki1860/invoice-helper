import { calendarSnapshots, type CalendarDay } from '../data/calendar.ts';
import { isValidInvoiceDate } from '../utils/dateUtils.ts';

export const MAX_WORKDAY_SPAN = 3660;
export const workdayYears = calendarSnapshots.map((snapshot) => snapshot.year);
const officialDays = new Map<string, CalendarDay>(
  calendarSnapshots.flatMap((snapshot) => snapshot.days.map((day) => [day.date, day] as const)),
);
const DAY = 86_400_000;

export interface WorkdayOptions {
  calendar: 'government' | 'custom';
  restWeekdays: number[];
  excludeHolidays: boolean;
  excludeSubstitutes: boolean;
}

export type WorkdayReason = 'work' | 'weekly-rest' | 'holiday' | 'substitute';
export interface WorkdayEntry {
  date: string;
  weekday: number;
  working: boolean;
  reason: WorkdayReason;
  label: string;
}
export interface WorkdayResult {
  valid: boolean;
  error: string;
  start: string;
  end: string;
  entries: WorkdayEntry[];
  workdays: number;
  calendarDays: number;
  restDays: number;
  holidayDays: number;
  substituteDays: number;
}

export const defaultWorkdayOptions: WorkdayOptions = {
  calendar: 'government',
  restWeekdays: [0, 6],
  excludeHolidays: true,
  excludeSubstitutes: false,
};

function failed(error: string): WorkdayResult {
  return {
    valid: false,
    error,
    start: '',
    end: '',
    entries: [],
    workdays: 0,
    calendarDays: 0,
    restDays: 0,
    holidayDays: 0,
    substituteDays: 0,
  };
}

function validateOptions(options: WorkdayOptions): string {
  if (!['government', 'custom'].includes(options.calendar)) return '請選擇日曆規則。';
  if (
    options.restWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(options.restWeekdays).size !== options.restWeekdays.length
  )
    return '休息日設定有誤，請重新選擇。';
  return '';
}

function sourceError(date: string, options: WorkdayOptions): string {
  const needsSource =
    options.calendar === 'government' || options.excludeHolidays || options.excludeSubstitutes;
  return needsSource && !officialDays.has(date)
    ? `此日期超出已核對的政府日曆（${workdayYears.join('、')} 年）。請縮小日期範圍，或使用不排除政府節日／補假的自訂工作週。`
    : '';
}

function entryFor(date: string, options: WorkdayOptions): WorkdayEntry {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const day = officialDays.get(date);
  const entry: WorkdayEntry = { date, weekday, working: true, reason: 'work', label: '工作日' };
  if (options.calendar === 'government' && day && !day.isDayOff) {
    if (weekday === 0 || weekday === 6) entry.label = '政府調整上班日';
    return entry;
  }
  const useHoliday = options.calendar === 'government' || options.excludeHolidays;
  const useSubstitute = options.calendar === 'government' || options.excludeSubstitutes;
  // One date has one reason: an official holiday takes precedence over a weekly rest day.
  if (day?.note === '補假' && useSubstitute)
    return { ...entry, working: false, reason: 'substitute', label: '政府機關補假' };
  if (day?.note && day.note !== '補假' && useHoliday)
    return { ...entry, working: false, reason: 'holiday', label: day.note };
  const rest =
    options.calendar === 'government' ? day?.isDayOff : options.restWeekdays.includes(weekday);
  return rest ? { ...entry, working: false, reason: 'weekly-rest', label: '例行休息日' } : entry;
}

function finish(start: string, end: string, entries: WorkdayEntry[]): WorkdayResult {
  return {
    valid: true,
    error: '',
    start,
    end,
    entries,
    workdays: entries.filter((day) => day.working).length,
    calendarDays: entries.length,
    restDays: entries.filter((day) => day.reason === 'weekly-rest').length,
    holidayDays: entries.filter((day) => day.reason === 'holiday').length,
    substituteDays: entries.filter((day) => day.reason === 'substitute').length,
  };
}

function stepDate(date: string, step: number): string | null {
  const next = new Date(new Date(`${date}T00:00:00Z`).getTime() + step * DAY);
  const year = next.getUTCFullYear();
  return year >= 1 && year <= 9999 ? next.toISOString().slice(0, 10) : null;
}

/** Civil dates only: the machine's timezone and daylight-saving changes do not affect counts. */
export function countWorkdays(
  start: string,
  end: string,
  includeStart: boolean,
  options: WorkdayOptions,
): WorkdayResult {
  if (!isValidInvoiceDate(start) || !isValidInvoiceDate(end))
    return failed('請填寫有效的開始與結束日期。');
  const optionError = validateOptions(options);
  if (optionError) return failed(optionError);
  if (end < start) return failed('結束日期不可早於開始日期。');
  const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY + 1;
  if (span > MAX_WORKDAY_SPAN) return failed('單次最多計算 3,660 個日曆天，請縮短區間。');
  const boundaryError = sourceError(start, options) || sourceError(end, options);
  if (boundaryError) return failed(boundaryError);
  const entries: WorkdayEntry[] = [];
  for (let offset = includeStart ? 0 : 1; offset < span; offset++) {
    const date = stepDate(start, offset)!;
    const error = sourceError(date, options);
    if (error) return failed(error);
    entries.push(entryFor(date, options));
  }
  return finish(start, end, entries);
}

/** Excludes the starting date; zero leaves it unchanged, even when it is not a workday. */
export function shiftWorkdays(
  start: string,
  countText: string,
  direction: 'forward' | 'backward',
  options: WorkdayOptions,
): WorkdayResult {
  if (!isValidInvoiceDate(start)) return failed('請填寫有效的起始日期。');
  const optionError = validateOptions(options);
  if (optionError) return failed(optionError);
  if (!['forward', 'backward'].includes(direction)) return failed('請選擇向後推算或向前回推。');
  if (!/^\d+$/.test(countText.trim()) || Number(countText) > MAX_WORKDAY_SPAN)
    return failed('工作天數須為 0 至 3,660 的整數。');
  const boundaryError = sourceError(start, options);
  if (boundaryError) return failed(boundaryError);
  const count = Number(countText);
  if (count === 0) return finish(start, start, []);
  if (options.calendar === 'custom' && options.restWeekdays.length === 7)
    return failed('每週至少需要保留一個工作日，才能推算交期。');
  const entries: WorkdayEntry[] = [];
  let found = 0;
  let cursor = start;
  const step = direction === 'forward' ? 1 : -1;
  for (let scanned = 0; scanned < MAX_WORKDAY_SPAN; scanned++) {
    const next = stepDate(cursor, step);
    if (!next) return failed('推算結果超出可處理的日期範圍。');
    const error = sourceError(next, options);
    if (error) return failed(error);
    const day = entryFor(next, options);
    entries.push(day);
    cursor = next;
    if (day.working) found++;
    if (found === count) return finish(start, cursor, entries);
  }
  return failed('已搜尋 3,660 個日曆天，仍未達指定工作天數，請減少天數。');
}

export function workdaySummary(
  result: WorkdayResult,
  options: WorkdayOptions,
  calculationLabel: string,
): string {
  if (!result.valid) return '';
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return [
    '小事務｜工作天與交期',
    calculationLabel,
    `起始：${result.start}；結果日期：${result.end}`,
    options.calendar === 'government'
      ? '依政府行政機關辦公日曆'
      : `自訂休息日：${options.restWeekdays.map((day) => `週${weekdayNames[day]}`).join('、') || '無'}；排除政府節日原日期：${options.excludeHolidays ? '是' : '否'}；排除政府補假：${options.excludeSubstitutes ? '是' : '否'}`,
    `計入範圍 ${result.calendarDays} 日；工作 ${result.workdays} 日；休息／假日 ${result.calendarDays - result.workdays} 日`,
    ...result.entries.map((day) => `${day.date}（${weekdayNames[day.weekday]}） ${day.label}`),
    '此為依所選規則排程的結果；實際交期及工作日以雙方約定為準。',
  ].join('\n');
}

function validateWorkdayExport(result: WorkdayResult): void {
  if (
    !result.valid ||
    result.entries.length === 0 ||
    !isValidInvoiceDate(result.start) ||
    !isValidInvoiceDate(result.end)
  )
    throw new Error('目前沒有有效的逐日明細可下載。');
}

/** Export calculated entries in their original order, independently of UI pagination. */
export function buildWorkdaysCsv(result: WorkdayResult): string {
  validateWorkdayExport(result);
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const rows = [
    ['日期', '星期', '是否工作日', '計算依據'],
    ...result.entries.map((day) => {
      if (
        !isValidInvoiceDate(day.date) ||
        !Number.isInteger(day.weekday) ||
        day.weekday < 0 ||
        day.weekday > 6 ||
        typeof day.working !== 'boolean' ||
        typeof day.label !== 'string'
      )
        throw new Error('逐日明細資料無效，無法下載 CSV。');
      return [day.date, `星期${weekdayNames[day.weekday]}`, day.working ? '是' : '否', day.label];
    }),
  ];
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((value) => {
          // Labels come from our calculated calendar data, never from free-text inputs.
          // Refuse unexpected formula-like content instead of adding spreadsheet formulas.
          if (/^\s*[=+@-]/u.test(value))
            throw new Error('明細包含不支援的試算表內容，無法下載 CSV。');
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\r\n')}\r\n`;
}

export function getWorkdaysCsvFilename(result: WorkdayResult): string {
  validateWorkdayExport(result);
  return `workdays-${result.start}-to-${result.end}.csv`;
}
