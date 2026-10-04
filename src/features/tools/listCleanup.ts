export const MAX_LIST_CODE_POINTS = 100_000;
export const MAX_LIST_ROWS = 5_000;

export type ListCleanupResult =
  | {
      valid: true;
      text: string;
      items: string[];
      inputRows: number;
      keptRows: number;
      blankRows: number;
      duplicateRows: number;
    }
  | { valid: false; text: ''; error: string };

export function cleanupList(input: string): ListCleanupResult {
  let codePoints = 0;
  let inputRows = input === '' ? 0 : 1;
  let previousCharacter = '';

  // Count code points without allocating an array or truncating the original input.
  for (const character of input) {
    codePoints += 1;
    if (codePoints > MAX_LIST_CODE_POINTS) {
      return {
        valid: false,
        text: '',
        error: '原始清單超過 100,000 個字元，請縮短後再整理；本次未產生結果。',
      };
    }
    if (character === '\r' || (character === '\n' && previousCharacter !== '\r')) {
      inputRows += 1;
      if (inputRows > MAX_LIST_ROWS) {
        return {
          valid: false,
          text: '',
          error: '原始清單超過 5,000 行，請減少行數後再整理；本次未產生結果。',
        };
      }
    }
    previousCharacter = character;
  }

  const items: string[] = [];
  const seen = new Set<string>();
  let blankRows = 0;
  let duplicateRows = 0;

  for (const row of input === '' ? [] : input.split(/\r\n|\r|\n/u)) {
    const item = row.trim();
    if (item === '') {
      blankRows += 1;
    } else if (seen.has(item)) {
      duplicateRows += 1;
    } else {
      seen.add(item);
      items.push(item);
    }
  }

  return {
    valid: true,
    text: items.join('\n'),
    items,
    inputRows,
    keptRows: items.length,
    blankRows,
    duplicateRows,
  };
}
