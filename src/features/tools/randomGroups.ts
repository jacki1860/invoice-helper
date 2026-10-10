export const MAX_RANDOM_GROUP_PARTICIPANTS = 500;
export const MAX_RANDOM_GROUP_NAME_LENGTH = 80;
export const MAX_RANDOM_GROUP_CODE_POINTS = 100_000;
export const MAX_RANDOM_GROUP_INPUT_LINES = 1_000;
export const MAX_RANDOM_GROUPS = 100;

export interface RandomGroupsDraft {
  names: string;
  groupCountRaw: string;
}

export interface RandomGroupsIssue {
  field: 'names' | 'groupCountRaw';
  line?: number;
  message: string;
}

export interface RandomGroupsValidation {
  valid: boolean;
  names: string[];
  groupCount: number;
  blankLines: number;
  errors: RandomGroupsIssue[];
  errorCount: number;
}

export interface RandomGroupsOutput {
  groups: string[][];
  participantCount: number;
  text: string;
}

export function emptyRandomGroups(): RandomGroupsDraft {
  return { names: '', groupCountRaw: '2' };
}

export function exampleRandomGroups(): RandomGroupsDraft {
  return { names: '小安\n小晴\n阿哲\n小岑\n小宇\n小禾\n阿凱\n小寧', groupCountRaw: '3' };
}

export function randomGroupsInputLimitError(names: string): string | null {
  let codePoints = 0;
  let lines = 1;
  let previousWasCarriageReturn = false;
  for (const character of names) {
    codePoints += 1;
    if (codePoints > MAX_RANDOM_GROUP_CODE_POINTS)
      return '整份文字最多 100,000 個 Unicode 碼點；請縮短後再分組，沒有截斷或產生部分結果。';
    if (character === '\r' || (character === '\n' && !previousWasCarriageReturn)) lines += 1;
    previousWasCarriageReturn = character === '\r';
    if (lines > MAX_RANDOM_GROUP_INPUT_LINES)
      return '整份文字最多 1,000 行（含空白行，最後換行也算一行）；請縮短後再分組。';
  }
  return null;
}

export function validateRandomGroups(draft: RandomGroupsDraft): RandomGroupsValidation {
  const result: RandomGroupsValidation = {
    valid: false,
    names: [],
    groupCount: 0,
    blankLines: 0,
    errors: [],
    errorCount: 0,
  };
  const addError = (issue: RandomGroupsIssue) => {
    result.errorCount += 1;
    if (result.errors.length < 20) result.errors.push(issue);
  };
  const inputLimitError = randomGroupsInputLimitError(draft.names);
  if (inputLimitError) {
    addError({ field: 'names', message: inputLimitError });
    return result;
  }

  const names: string[] = [];
  const seen = new Map<string, number>();
  // Browser textareas normalize CRLF/CR; accepting the same line endings here keeps API tests consistent.
  const lines = draft.names.replace(/\r\n?/gu, '\n').split('\n');
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const name = raw.trim();
    // Check before trim: a Tab-only line must not silently disappear.
    if (/[\p{Cc}\u2028\u2029]/u.test(raw)) {
      addError({ field: 'names', line, message: '不可含控制字元、Tab 或 Unicode 換行符號。' });
    } else if (/[\uD800-\uDFFF]/u.test(raw)) {
      addError({ field: 'names', line, message: '含不完整的 Unicode 字元，請重新輸入此行。' });
    } else if (!name) {
      result.blankLines += 1;
      continue;
    } else if (Array.from(name).length > MAX_RANDOM_GROUP_NAME_LENGTH) {
      addError({ field: 'names', line, message: '每名最多 80 個 Unicode 碼點（不含首尾空白）。' });
    }
    if (!name) continue;
    names.push(name);
    const key = name.normalize('NFC');
    const previousLine = seen.get(key);
    if (previousLine !== undefined) {
      addError({
        field: 'names',
        line,
        message: `與第 ${previousLine} 行姓名重複，請替同名參與者加上可區分的識別；不會自動刪人。`,
      });
    } else {
      seen.set(key, line);
    }
  }
  if (names.length < 2 || names.length > MAX_RANDOM_GROUP_PARTICIPANTS) {
    addError({
      field: 'names',
      message: '需要 2–500 名參與者；超過上限時整份停止，不會自動刪人。',
    });
  }
  const groupCount = /^[0-9]+$/u.test(draft.groupCountRaw) ? Number(draft.groupCountRaw) : NaN;
  if (!Number.isSafeInteger(groupCount) || groupCount < 2 || groupCount > MAX_RANDOM_GROUPS) {
    addError({ field: 'groupCountRaw', message: '組數須為 2–100 的整數。' });
  } else if (groupCount > names.length) {
    addError({ field: 'groupCountRaw', message: '組數不可超過參與者人數。' });
  }
  if (result.errors.length === 0) {
    result.valid = true;
    result.names = names;
    result.groupCount = groupCount;
  }
  return result;
}

export type RandomUint32 = () => number;

function browserRandomUint32(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

// Rejection sampling avoids modulo bias; bound retries so a broken random source cannot hang the page.
export function randomGroupIndex(
  upperExclusive: number,
  random: RandomUint32 = browserRandomUint32,
): number {
  if (
    !Number.isInteger(upperExclusive) ||
    upperExclusive < 1 ||
    upperExclusive > MAX_RANDOM_GROUP_PARTICIPANTS
  ) {
    throw new RangeError('Invalid random index bound');
  }
  const range = 2 ** 32;
  const limit = Math.floor(range / upperExclusive) * upperExclusive;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const value = random();
    if (!Number.isInteger(value) || value < 0 || value >= range)
      throw new Error('Invalid random value');
    if (value < limit) return value % upperExclusive;
  }
  throw new Error('Random source repeatedly returned rejected values');
}

export function createRandomGroups(
  draft: RandomGroupsDraft,
  random: RandomUint32 = browserRandomUint32,
): RandomGroupsOutput {
  const input = validateRandomGroups(draft);
  if (!input.valid) throw new Error('Invalid participant list or group count');
  const shuffled = [...input.names];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = randomGroupIndex(index + 1, random);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const size = Math.floor(shuffled.length / input.groupCount);
  const remainder = shuffled.length % input.groupCount;
  let offset = 0;
  const groups = Array.from({ length: input.groupCount }, (_, index) => {
    const length = size + (index < remainder ? 1 : 0);
    const group = shuffled.slice(offset, offset + length);
    offset += length;
    return group;
  });
  const text =
    [
      `隨機分組結果（共 ${shuffled.length} 人，${groups.length} 組）`,
      '',
      groups
        .map((group, index) =>
          [`第 ${index + 1} 組（${group.length} 人）`, ...group.map((name) => `- ${name}`)].join(
            '\n',
          ),
        )
        .join('\n\n'),
    ].join('\n') + '\n';
  return { groups, participantCount: shuffled.length, text };
}
