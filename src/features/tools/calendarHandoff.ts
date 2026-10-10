import { calendarSnapshots } from '../../data/calendar.ts';
import { isValidInvoiceDate } from '../../utils/dateUtils.ts';

export interface CalendarRangeSeed {
  start: string;
  end: string;
}

export const calendarRangeMin = `${calendarSnapshots[0].year}-01-01`;
export const calendarRangeMax = `${calendarSnapshots[calendarSnapshots.length - 1].year}-12-31`;

/** Only transfer civil dates covered by the calendar's published snapshots. */
export function calendarRangeError({ start, end }: CalendarRangeSeed): string {
  if (!isValidInvoiceDate(start) || !isValidInvoiceDate(end))
    return '請選擇有效的開始日期與結束日期。';
  if (end < start) return '結束日期不可早於開始日期，請調整日期。';
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
    if (!calendarSnapshots.some((snapshot) => snapshot.year === year))
      return `日期須在 ${calendarRangeMin} 至 ${calendarRangeMax} 的已核對日曆範圍內。`;
  }
  return '';
}

export function calendarToWorkdays(range: CalendarRangeSeed): CalendarRangeSeed | null {
  return calendarRangeError(range) ? null : { start: range.start, end: range.end };
}

/** A completed range starts a new selection on the next day click. */
export function selectCalendarDate(range: CalendarRangeSeed, date: string): CalendarRangeSeed {
  return !range.start || range.end ? { start: date, end: '' } : { start: range.start, end: date };
}
