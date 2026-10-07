export const MAX_FILENAME_PLAN_LINES = 1_000;
export const MAX_FILENAME_PLAN_CODE_POINTS = 100_000;
export const MAX_FILENAME_LENGTH = 200;
export const MAX_FILENAME_PREFIX_LENGTH = 80;
export const MAX_FILENAME_NUMBER = 999_999;

export interface FilenamePlanDraft {
  original: string;
  prefix: string;
  startRaw: string;
  paddingRaw: string;
  keepExtension: boolean;
}

export interface FilenamePlanIssue {
  field: 'original' | 'prefix' | 'startRaw' | 'paddingRaw';
  line?: number;
  message: string;
}

export interface FilenamePlanRow {
  line: number;
  original: string;
  planned: string;
}

export interface FilenamePlanResult {
  valid: boolean;
  originalLines: number;
  blankLines: number;
  rows: FilenamePlanRow[];
  errors: FilenamePlanIssue[];
  warnings: string[];
  namesText: string;
  mappingText: string;
}

export function emptyFilenamePlan(): FilenamePlanDraft {
  return { original: '', prefix: '', startRaw: '1', paddingRaw: '3', keepExtension: true };
}

export function exampleFilenamePlan(): FilenamePlanDraft {
  return {
    original: '原圖.JPG\n報告.final.pdf\n.env',
    prefix: '交件_',
    startRaw: '9',
    paddingRaw: '3',
    keepExtension: true,
  };
}

const invalidCharacters = /[<>:"/\\|?*]/u;
const controls = /[\p{Cc}\u2028\u2029]/u;
const reservedName = /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[1-9¹²³]|lpt[1-9¹²³])$/iu;
const collisionKey = (name: string) => name.normalize('NFC').toLowerCase();

function characterError(value: string): string | undefined {
  if (controls.test(value)) return '不可含控制字元、Tab 或 Unicode 換行符號。';
  if (invalidCharacters.test(value)) return '不可含路徑分隔符或 < > : " | ? *。';
}

function filenameError(name: string): string | undefined {
  const characters = characterError(name);
  if (characters) return characters;
  if (Array.from(name).length > MAX_FILENAME_LENGTH) return '最多 200 個 Unicode 碼點。';
  if (name === '.' || name === '..') return '不可使用 . 或 .. 作為檔名。';
  if (/[ .]$/u.test(name)) return '檔名結尾不可為空格或句點。';
  if (reservedName.test(name.split('.')[0].replace(/ +$/u, ''))) {
    return '不可使用 Windows 保留名稱（含副檔名形式）。';
  }
}

function integerInRange(value: string, maximum: number): number | undefined {
  if (!/^[0-9]+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : undefined;
}

export function planFilenames(draft: FilenamePlanDraft): FilenamePlanResult {
  const result: FilenamePlanResult = {
    valid: false,
    originalLines: 0,
    blankLines: 0,
    rows: [],
    errors: [],
    warnings: [],
    namesText: '',
    mappingText: '',
  };
  const addError = (field: FilenamePlanIssue['field'], message: string, line?: number) => {
    result.errors.push({ field, message, ...(line === undefined ? {} : { line }) });
  };

  // Check the raw input before splitting or processing names; never truncate a plan.
  let codePoints = 0;
  const characters = draft.original[Symbol.iterator]();
  while (!characters.next().done) {
    codePoints += 1;
    if (codePoints > MAX_FILENAME_PLAN_CODE_POINTS) {
      addError('original', '原始文字超過 100,000 個 Unicode 碼點，請縮短後再規劃。');
      return result;
    }
  }
  const lines = draft.original === '' ? [] : draft.original.split(/\r\n|\r|\n/u);
  result.originalLines = lines.length;
  if (lines.length > MAX_FILENAME_PLAN_LINES) {
    addError('original', '原始文字超過 1,000 行（含空白行及最後換行），請減少行數。');
    return result;
  }

  const prefixError = characterError(draft.prefix);
  if (prefixError) addError('prefix', `檔名前綴${prefixError}`);
  if (Array.from(draft.prefix).length > MAX_FILENAME_PREFIX_LENGTH) {
    addError('prefix', '檔名前綴最多 80 個 Unicode 碼點。');
  }
  const start = integerInRange(draft.startRaw, MAX_FILENAME_NUMBER);
  const padding = integerInRange(draft.paddingRaw, 6);
  if (start === undefined) addError('startRaw', '起始編號須為 1–999999 的半形整數。');
  if (padding === undefined) addError('paddingRaw', '編號位數須為 1–6 的半形整數。');

  const originals: { line: number; original: string }[] = [];
  const oldNames = new Map<string, number>();
  for (const [index, original] of lines.entries()) {
    const line = index + 1;
    // Ordinary blank lines can be skipped, but prohibited controls must remain visible errors.
    if (!controls.test(original) && /^\s*$/u.test(original)) {
      result.blankLines += 1;
      continue;
    }
    originals.push({ line, original });
    const error = filenameError(original);
    if (error) addError('original', `原檔名${error}`, line);
    const key = collisionKey(original);
    const previous = oldNames.get(key);
    if (previous !== undefined) {
      addError(
        'original',
        `與第 ${previous} 行原檔名相同（NFC 正規化後轉成小寫比較），請先釐清重複項目。`,
        line,
      );
    } else {
      oldNames.set(key, line);
    }
  }
  if (originals.length === 0) addError('original', '請至少輸入一個檔名。');
  if (start !== undefined && start + originals.length - 1 > MAX_FILENAME_NUMBER) {
    addError('startRaw', '最後編號超過 999999，請降低起始編號或減少檔名。');
  }
  if (result.errors.length || start === undefined || padding === undefined) return result;

  const rows: FilenamePlanRow[] = [];
  const newNames = new Map<string, number>();
  for (const [index, entry] of originals.entries()) {
    const lastDot = entry.original.lastIndexOf('.');
    const extension = draft.keepExtension && lastDot > 0 ? entry.original.slice(lastDot) : '';
    const planned = `${draft.prefix}${String(start + index).padStart(padding, '0')}${extension}`;
    const error = filenameError(planned);
    if (error) addError('original', `產生的新檔名${error}`, entry.line);
    const key = collisionKey(planned);
    const previous = newNames.get(key);
    if (previous !== undefined) {
      addError('original', `產生的新檔名與第 ${previous} 行重複，請調整設定。`, entry.line);
    } else {
      newNames.set(key, entry.line);
    }
    const otherOldLine = oldNames.get(key);
    if (otherOldLine !== undefined && otherOldLine !== entry.line) {
      result.warnings.push(
        `第 ${entry.line} 行的新檔名與第 ${otherOldLine} 行原檔名相同，更名順序可能衝突。`,
      );
    }
    rows.push({ ...entry, planned });
  }
  if (result.errors.length) {
    result.warnings = [];
    return result;
  }
  result.valid = true;
  result.rows = rows;
  result.namesText = `${rows.map((row) => row.planned).join('\n')}\n`;
  result.mappingText = `原檔名\t新檔名\n${rows.map((row) => `${row.original}\t${row.planned}`).join('\n')}\n`;
  return result;
}
