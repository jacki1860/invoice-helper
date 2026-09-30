export const laborIdentities = [
  '一般勞工',
  '部分工時勞工',
  '庇護性身心障礙者',
  '職訓機構受訓者',
] as const;

export type LaborIdentity = (typeof laborIdentities)[number];
export type InsuranceKind = 'labor' | 'health';

export interface LaborSourceRow {
  readonly 適用起日: string;
  readonly 序號: string;
  readonly 身分別: string;
  readonly 投保薪資等級: string;
  readonly 月薪資總額: string;
  readonly 月投保薪資: string;
}

export interface HealthSourceRow {
  readonly 組別級距: string;
  readonly 投保等級: string;
  readonly '月投保金額（元）': string;
  readonly '實際薪資月額（元）': string;
}

export interface InsuranceBracket {
  readonly grade: number;
  readonly amount: number;
  readonly lowerInclusive: number | null;
  readonly upperInclusive: number | null;
  readonly sourceRange: string;
}

export const laborIdentityNotes: Record<LaborIdentity, string> = {
  一般勞工: '供一般受僱勞工查表；低於第一級的輸入仍對照第一級，這不表示薪資或納保資格已符合規定。',
  部分工時勞工:
    '適用實際以部分工時身分投保者。月收入低不等於部分工時；臨時工作也不一定適用。請以整月薪資總額查表。',
  庇護性身心障礙者: '限適用庇護性就業投保規定者；持有身心障礙證明並不代表必然適用此表。',
  職訓機構受訓者: '限適用職業訓練機構受訓者投保規定者；一般學生、實習生不能僅憑名稱套用。',
};

function positiveInteger(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`無效的官方整數欄位：${value}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('官方金額或等級必須為正整數');
  return number;
}

export function parseInsuranceSalary(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const number = Number(text.replace(/,/g, ''));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function parseInsuranceRange(
  sourceRange: string,
): Pick<InsuranceBracket, 'lowerInclusive' | 'upperInclusive'> {
  const text = sourceRange.replace(/元| /g, '');
  const below = /^(\d+)以下$/.exec(text);
  if (below) return { lowerInclusive: null, upperInclusive: positiveInteger(below[1]) };
  const above = /^(\d+)以上$/.exec(text);
  if (above) return { lowerInclusive: positiveInteger(above[1]), upperInclusive: null };
  const between = /^(\d+)(?:至|-)(\d+)$/.exec(text);
  if (!between) throw new Error(`未識別的官方區間格式：${sourceRange}`);
  const lowerInclusive = positiveInteger(between[1]);
  const upperInclusive = positiveInteger(between[2]);
  if (lowerInclusive > upperInclusive) throw new Error('官方區間上下界顛倒');
  return { lowerInclusive, upperInclusive };
}

export function validateInsuranceBrackets(rows: readonly InsuranceBracket[]): void {
  if (
    rows.length < 2 ||
    rows[0].lowerInclusive !== null ||
    rows[rows.length - 1].upperInclusive !== null
  ) {
    throw new Error('級距表缺少首尾開放區間');
  }
  rows.forEach((row, index) => {
    if (row.grade !== index + 1 || !Number.isSafeInteger(row.amount) || row.amount <= 0) {
      throw new Error('級距等級或金額無效');
    }
    if (index > 0) {
      const previous = rows[index - 1];
      if (previous.upperInclusive === null || row.lowerInclusive !== previous.upperInclusive + 1) {
        throw new Error('級距區間有缺口或重疊');
      }
      if (row.amount <= previous.amount) throw new Error('投保金額未嚴格遞增');
    }
    if (index < rows.length - 1 && row.upperInclusive === null) throw new Error('中間級距沒有上界');
  });
}

export function getLaborBrackets(
  rows: readonly LaborSourceRow[],
  identity: LaborIdentity,
): InsuranceBracket[] {
  const brackets = rows
    .filter((row) => row.身分別 === identity)
    .map((row) => ({
      grade: positiveInteger(row.投保薪資等級),
      amount: positiveInteger(row.月投保薪資),
      sourceRange: row.月薪資總額,
      ...parseInsuranceRange(row.月薪資總額),
    }));
  validateInsuranceBrackets(brackets);
  return brackets;
}

export function getHealthBrackets(rows: readonly HealthSourceRow[]): InsuranceBracket[] {
  const brackets = rows.map((row) => ({
    grade: positiveInteger(row.投保等級),
    amount: positiveInteger(row['月投保金額（元）']),
    sourceRange: row['實際薪資月額（元）'],
    ...parseInsuranceRange(row['實際薪資月額（元）']),
  }));
  validateInsuranceBrackets(brackets);
  return brackets;
}

export function findInsuranceBracket(
  rows: readonly InsuranceBracket[],
  salary: number,
): InsuranceBracket | null {
  if (!Number.isSafeInteger(salary) || salary <= 0) return null;
  return (
    rows.find(
      (row) =>
        (row.lowerInclusive === null || salary >= row.lowerInclusive) &&
        (row.upperInclusive === null || salary <= row.upperInclusive),
    ) ?? null
  );
}
