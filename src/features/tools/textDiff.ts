export const MAX_TEXT_DIFF_CODE_POINTS = 100_000;
export const MAX_TEXT_DIFF_LINES = 1_000;

export type TextDiffKind = 'unchanged' | 'removed' | 'added';
export interface TextDiffRow {
  kind: TextDiffKind;
  text: string;
  originalLine: number | null;
  revisedLine: number | null;
}

export const textDiffLabels: Record<TextDiffKind, string> = {
  unchanged: '= 相同',
  removed: '− 刪除',
  added: '+ 新增',
};

export type TextDiffResult =
  | {
      valid: true;
      rows: TextDiffRow[];
      text: string;
      originalLines: number;
      revisedLines: number;
      unchangedRows: number;
      removedRows: number;
      addedRows: number;
    }
  | {
      valid: false;
      rows: [];
      text: '';
      errors: { original?: string; revised?: string };
    };

function inputError(input: string, label: string): string | undefined {
  let codePoints = 0;
  let lines = input === '' ? 0 : 1;
  let previous = '';
  for (const character of input) {
    codePoints += 1;
    if (codePoints > MAX_TEXT_DIFF_CODE_POINTS) {
      return `${label}超過 100,000 個字元，請縮短後再比對；本次未產生結果。`;
    }
    if (character === '\r' || (character === '\n' && previous !== '\r')) {
      lines += 1;
      if (lines > MAX_TEXT_DIFF_LINES) {
        return `${label}超過 1,000 行，請減少行數後再比對；本次未產生結果。`;
      }
    }
    previous = character;
  }
}

function splitLines(input: string): string[] {
  return input === '' ? [] : input.split(/\r\n|\r|\n/u);
}

export function compareText(original: string, revised: string): TextDiffResult {
  const originalError = inputError(original, '原版文字');
  const revisedError = inputError(revised, '新版文字');
  if (originalError || revisedError) {
    return {
      valid: false,
      rows: [],
      text: '',
      errors: { original: originalError, revised: revisedError },
    };
  }

  const before = splitLines(original);
  const after = splitLines(revised);
  // Intern lines so each bounded LCS cell compares numbers, even for long repeated lines.
  const lineIds = new Map<string, number>();
  const idFor = (line: string) => {
    if (!lineIds.has(line)) lineIds.set(line, lineIds.size);
    return lineIds.get(line)!;
  };
  const beforeIds = before.map(idFor);
  const afterIds = after.map(idFor);
  const width = after.length + 1;
  // The validated 1,000-line limit bounds this table to 1,002,001 uint16 cells.
  const lengths = new Uint16Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        beforeIds[i] === afterIds[j]
          ? 1 + lengths[(i + 1) * width + j + 1]
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  const rows: TextDiffRow[] = [];
  let i = 0;
  let j = 0;
  let unchangedRows = 0;
  let removedRows = 0;
  let addedRows = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && beforeIds[i] === afterIds[j]) {
      rows.push({ kind: 'unchanged', text: before[i], originalLine: i + 1, revisedLine: j + 1 });
      i += 1;
      j += 1;
      unchangedRows += 1;
    } else if (
      i < before.length &&
      (j === after.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])
    ) {
      // Deletion wins ties so repeated lines always produce the same alignment.
      rows.push({ kind: 'removed', text: before[i], originalLine: i + 1, revisedLine: null });
      i += 1;
      removedRows += 1;
    } else {
      rows.push({ kind: 'added', text: after[j], originalLine: null, revisedLine: j + 1 });
      j += 1;
      addedRows += 1;
    }
  }

  const text =
    rows.length === 0
      ? ''
      : [
          '文字版本差異報告',
          `原版 ${before.length} 行／新版 ${after.length} 行`,
          `相同 ${unchangedRows} 行／新增 ${addedRows} 行／刪除 ${removedRows} 行`,
          '逐行嚴格比對；CRLF／CR 換行統一為 LF，其餘內容保留。',
          '每行格式：[標記 原:行號 新:行號] 原文；= 相同、- 刪除、+ 新增，— 表示該側沒有此行。',
          '右方 ] 後第一個空格是分隔符，其後才是原文；空白行仍保留。替換與重排以刪除及新增表示。',
          '--- 差異內容開始 ---',
          ...rows.map((row) => {
            const marker = row.kind === 'unchanged' ? '=' : row.kind === 'removed' ? '-' : '+';
            return `[${marker} 原:${row.originalLine ?? '—'} 新:${row.revisedLine ?? '—'}] ${row.text}`;
          }),
        ].join('\n');

  return {
    valid: true,
    rows,
    text,
    originalLines: before.length,
    revisedLines: after.length,
    unchangedRows,
    removedRows,
    addedRows,
  };
}
