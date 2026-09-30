export const lawCategories = [
  { id: 'all', label: '全部' },
  { id: 'labor', label: '勞動' },
  { id: 'insurance', label: '勞健保' },
  { id: 'tax', label: '稅務' },
  { id: 'company', label: '公司行政' },
] as const;

export type LawCategory = (typeof lawCategories)[number]['id'];

export type LawEntry = {
  readonly id: string;
  readonly name: string;
  readonly category: Exclude<LawCategory, 'all'>;
  readonly aliases: readonly string[];
  readonly officialUrl: string;
  readonly source: string;
  readonly revisionDate: string;
  readonly dateLabel: string;
  readonly effectiveNotice: string | null;
};

function normalize(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-TW');
}

export function filterLaws(
  laws: readonly LawEntry[],
  query: string,
  category: LawCategory = 'all',
) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return laws.filter((law) => {
    if (category !== 'all' && law.category !== category) return false;
    const text = normalize([law.name, ...law.aliases].join(' '));
    return terms.every((term) => text.includes(term));
  });
}

export function buildOfficialLawSearchUrl(query: string) {
  const keyword = query.trim();
  if (!keyword) return 'https://law.moj.gov.tw/';
  const url = new URL('https://law.moj.gov.tw/Law/LawSearchResult.aspx');
  url.search = new URLSearchParams({ ty: 'ONEBAR', kw: keyword, sSearch: '' }).toString();
  return url.href;
}
