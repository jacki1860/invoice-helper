import { calendarSnapshots } from '../data/calendar.ts';
import type { CalendarDay, CalendarYear } from '../data/calendar.ts';

export { calendarSnapshots };
export type { CalendarDay, CalendarYear };
export type CalendarDayKind = 'holiday' | 'substitute' | 'weekend' | 'workday';

export function getCalendarDayKind(day: CalendarDay): CalendarDayKind {
  if (day.note === '補假') return 'substitute';
  if (day.note) return 'holiday';
  return day.isDayOff ? 'weekend' : 'workday';
}

export function getCalendarEventLabel(day: CalendarDay): string {
  if (day.date === '2027-12-31' && day.note === '補假') return '2028 年元旦補假';
  return day.note === '補假' ? '政府機關補假' : day.note;
}

export function getCalendarEvents(calendar: CalendarYear): CalendarDay[] {
  return calendar.days.filter((day) => day.note !== '');
}

export function getCalendarMonth(calendar: CalendarYear, month: number): (CalendarDay | null)[][] {
  const prefix = `${calendar.year}-${String(month).padStart(2, '0')}-`;
  const days = calendar.days.filter((day) => day.date.startsWith(prefix));
  if (!days.length) return [];
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: days[0].weekday }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function foldIcsLine(value: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = '';
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(line);
      line = ' ';
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join('\r\n');
}

export function getCalendarFilename(year: number): string {
  return `taiwan-holidays-${year}.ics`;
}

export function buildCalendarIcs(calendar: CalendarYear, generatedAt = new Date()): string {
  const stamp = generatedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Invoice Helper//Taiwan Government Calendar//ZH-TW',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(`${calendar.year} 國定假日與政府機關補假`)}`,
  ];
  for (const day of getCalendarEvents(calendar)) {
    const end = new Date(`${day.date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const scope = day.note === '補假' ? '政府行政機關補假。' : '國定假日原日期。';
    lines.push(
      'BEGIN:VEVENT',
      `UID:tw-dgpa-${day.date}@invoice-helper.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${escapeIcsText(getCalendarEventLabel(day))}`,
      `DESCRIPTION:${escapeIcsText(`${scope}依人事行政總處政府行政機關辦公日曆；民間企業補假依勞資協商及適用法令。資料取得：${calendar.fetchedOn}。`)}`,
      'URL:https://data.gov.tw/dataset/14718',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
