import { cleanupList, type ListCleanupResult } from './listCleanup.ts';

type CleanList = Extract<ListCleanupResult, { valid: true }>;

export const listCompareGroups = [
  { id: 'onlyA', label: '只在 A', description: '預定有，實際未出現' },
  { id: 'common', label: '雙方都有', description: '預定與實際都出現' },
  { id: 'onlyB', label: '只在 B', description: '實際有，預定未列入' },
] as const;

export type ListCompareResult =
  | {
      valid: true;
      a: CleanList;
      b: CleanList;
      onlyA: string[];
      common: string[];
      onlyB: string[];
      text: string;
    }
  | { valid: false; errors: { a?: string; b?: string }; text: '' };

export function compareLists(inputA: string, inputB: string): ListCompareResult {
  // Reuse the exact trim/deduplication and raw-input limits of the list tool.
  // Neither side is truncated; one invalid list suspends the complete comparison.
  const a = cleanupList(inputA);
  const b = cleanupList(inputB);
  if (!a.valid || !b.valid) {
    return {
      valid: false,
      errors: {
        ...(!a.valid && { a: a.error }),
        ...(!b.valid && { b: b.error }),
      },
      text: '',
    };
  }

  const setA = new Set(a.items);
  const setB = new Set(b.items);
  const groups = {
    onlyA: a.items.filter((item) => !setB.has(item)),
    common: a.items.filter((item) => setB.has(item)),
    onlyB: b.items.filter((item) => !setA.has(item)),
  };
  const text =
    a.keptRows + b.keptRows === 0
      ? ''
      : [
          '雙清單比對',
          'A：預定清單；B：實際清單',
          '規則：去除每行首尾空白與空行，重複項目只計一次；忽略清單順序，精確比對文字。',
          '排序：只在 A、雙方都有依 A 首次出現順序；只在 B 依 B 首次出現順序。',
          `A：輸入 ${a.inputRows} 行／不重複 ${a.keptRows} 項／移除空行 ${a.blankRows} 行／移除重複 ${a.duplicateRows} 行`,
          `B：輸入 ${b.inputRows} 行／不重複 ${b.keptRows} 項／移除空行 ${b.blankRows} 行／移除重複 ${b.duplicateRows} 行`,
          ...listCompareGroups.flatMap(({ id, label }) => [
            '',
            `【${label}】${groups[id].length} 項`,
            ...groups[id],
          ]),
        ].join('\n');

  return { valid: true, a, b, ...groups, text };
}
