import { getTaiwanDate, isValidInvoiceDate } from '../../utils/dateUtils.ts';

export const ATTENDANCE_ROWS_PER_PAGE = 20;
export const MAX_ATTENDANCE_ROWS = 100;
export const MAX_ATTENDANCE_NAME_LENGTH = 24;
export const MAX_ATTENDANCE_FIELD_LENGTH = 80;
export const MAX_ATTENDANCE_RAW_LENGTH = 10_000;
export const MAX_ATTENDANCE_RAW_LINES = 1000;

export interface AttendanceSheetDraft {
  title: string;
  date: string;
  venue: string;
  organizer: string;
  totalRowsRaw: string;
  namesRaw: string;
}
export interface AttendanceSheetError {
  field: keyof AttendanceSheetDraft;
  message: string;
}
export interface AttendanceRow {
  number: number;
  name: string;
}
export interface AttendanceSheet {
  title: string;
  date: string;
  venue: string;
  organizer: string;
  namedRows: number;
  totalRows: number;
  pages: AttendanceRow[][];
}
export type AttendanceSheetResult =
  | { valid: true; errors: []; sheet: AttendanceSheet }
  | { valid: false; errors: AttendanceSheetError[]; sheet: null };

export function emptyAttendanceSheet(): AttendanceSheetDraft {
  return {
    title: '',
    date: getTaiwanDate(),
    venue: '',
    organizer: '',
    totalRowsRaw: '20',
    namesRaw: '',
  };
}
export function exampleAttendanceSheet(): AttendanceSheetDraft {
  return {
    ...emptyAttendanceSheet(),
    title: '社區手作交流日',
    venue: '社區活動中心一樓',
    organizer: '巷口生活小組',
    namesRaw: '林小青\n陳文宇\n林小青\n王庭安',
  };
}

function exceedsPoints(value: string, limit: number): boolean {
  let count = 0;
  for (let offset = 0; offset < value.length;) {
    if (++count > limit) return true;
    offset += value.codePointAt(offset)! > 0xffff ? 2 : 1;
  }
  return false;
}

/** Check the full candidate before native paste creates a potentially expensive textarea layout. */
export function attendanceRawLimitError(value: string): string {
  if (exceedsPoints(value, MAX_ATTENDANCE_RAW_LENGTH)) {
    return '名單原文最多 10,000 字，未產生任何結果。請縮短後再試。';
  }
  if (value.split(/\r\n|\r|\n/).length > MAX_ATTENDANCE_RAW_LINES) {
    return '名單原文最多 1,000 行（含空白行），未產生任何結果。請減少行數後再試。';
  }
  return '';
}

const invalidSingleLine = (value: string): boolean => /[\p{Cc}\u2028\u2029]/u.test(value);

export function attendanceSheetResult(draft: AttendanceSheetDraft): AttendanceSheetResult {
  const errors: AttendanceSheetError[] = [];
  for (const [field, label] of [
    ['title', '活動名稱'],
    ['venue', '活動地點'],
    ['organizer', '主辦單位'],
  ] as const) {
    const value = draft[field];
    if (
      (field === 'title' && !value.trim()) ||
      exceedsPoints(value, MAX_ATTENDANCE_FIELD_LENGTH) ||
      invalidSingleLine(value)
    ) {
      errors.push({
        field,
        message: `${label}${field === 'title' ? '必填，' : ''}最多 80 字，不可包含換行或控制字元。`,
      });
    }
  }
  if (!isValidInvoiceDate(draft.date)) {
    errors.push({
      field: 'date',
      message: '請填寫有效活動日期，格式為 YYYY-MM-DD（0001–9999 年）。',
    });
  }
  const totalRows = /^\d{1,3}$/.test(draft.totalRowsRaw) ? Number(draft.totalRowsRaw) : NaN;
  if (!Number.isInteger(totalRows) || totalRows < 1 || totalRows > MAX_ATTENDANCE_ROWS) {
    errors.push({ field: 'totalRowsRaw', message: '總列數請填 1–100 的整數。' });
  }
  const rawError = attendanceRawLimitError(draft.namesRaw);
  const names: string[] = [];
  if (rawError) {
    errors.push({ field: 'namesRaw', message: rawError });
  } else {
    for (const [index, line] of draft.namesRaw.split(/\r\n|\r|\n/).entries()) {
      if (!line.trim()) continue;
      if (exceedsPoints(line, MAX_ATTENDANCE_NAME_LENGTH) || invalidSingleLine(line)) {
        errors.push({
          field: 'namesRaw',
          message: `名單原文第 ${index + 1} 行：每行最多 24 字，不可包含控制字元或特殊換行。`,
        });
      }
      names.push(line.trim());
    }
    if (names.length > MAX_ATTENDANCE_ROWS) {
      errors.push({ field: 'namesRaw', message: '姓名最多 100 筆，請分成不同簽到表。' });
    } else if (Number.isInteger(totalRows) && names.length > totalRows) {
      errors.push({
        field: 'namesRaw',
        message: `目前有 ${names.length} 筆姓名，超過總列數 ${totalRows}；請增加總列數或調整名單。`,
      });
    }
  }
  if (errors.length) return { valid: false, errors, sheet: null };
  const rows = Array.from({ length: totalRows }, (_, index) => ({
    number: index + 1,
    name: names[index] ?? '',
  }));
  const pages: AttendanceRow[][] = [];
  for (let start = 0; start < rows.length; start += ATTENDANCE_ROWS_PER_PAGE) {
    pages.push(rows.slice(start, start + ATTENDANCE_ROWS_PER_PAGE));
  }
  return {
    valid: true,
    errors: [],
    sheet: {
      title: draft.title.trim(),
      date: draft.date,
      venue: draft.venue.trim(),
      organizer: draft.organizer.trim(),
      namedRows: names.length,
      totalRows,
      pages,
    },
  };
}

export function attendanceSheetText(result: AttendanceSheetResult): string {
  if (!result.valid) return '';
  const { sheet } = result;
  return sheet.pages
    .map((rows, index) =>
      [
        '活動簽到表',
        `活動名稱：${sheet.title}`,
        `活動日期：${sheet.date}`,
        `活動地點：${sheet.venue || '未填寫'}`,
        `主辦單位：${sheet.organizer || '未填寫'}`,
        `第 ${index + 1} / ${sheet.pages.length} 頁`,
        '序號\t姓名\t單位\t簽名\t備註',
        ...rows.map((row) => `${row.number}\t${row.name}\t\t\t`),
      ].join('\n'),
    )
    .join('\n\n');
}
