import { execFile } from 'node:child_process';
import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const dataUrl = new URL('../src/data/laws.ts', import.meta.url);
const officialHosts = new Set([
  'law.moj.gov.tw',
  'laws.mol.gov.tw',
  'law-out.mof.gov.tw',
  'gazette.nat.gov.tw',
  'join.gov.tw',
]);

export const newsSources = [
  {
    id: 'moj',
    name: '全國法規資料庫',
    url: 'https://law.moj.gov.tw/News/NewsList.aspx?type=all',
    dateLabel: '訊息日期',
    dateIndex: 1,
    kindIndex: 2,
    titleIndex: 3,
  },
  {
    id: 'mol',
    name: '勞動部法令查詢系統',
    url: 'https://laws.mol.gov.tw/',
    dateLabel: '公發布日',
    dateIndex: 0,
    kindIndex: 1,
    titleIndex: 2,
  },
  {
    id: 'mof',
    name: '財政部主管法規查詢系統',
    url: 'https://law-out.mof.gov.tw/',
    dateLabel: '資料日期',
    dateIndex: 1,
    kindIndex: 3,
    titleIndex: 2,
  },
];

export function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, code) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? whole;
    const point =
      code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

export function plainText(html) {
  return decodeHtml(
    html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRocDate(value) {
  const match = value.match(
    /(?:民國\s*)?(\d{2,3})\s*(?:年|[./-])\s*(\d{1,2})\s*(?:月|[./-])\s*(\d{1,2})\s*日?/,
  );
  if (!match) throw new Error(`找不到民國日期：${value}`);
  const year = Number(match[1]) + 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error(`無效日期：${value}`);
  return date.toISOString().slice(0, 10);
}

export function officialUrl(value, base) {
  const url = new URL(decodeHtml(value), base);
  if (url.protocol !== 'https:' || !officialHosts.has(url.hostname) || url.username || url.password)
    throw new Error(`非允許的官方網址：${url.href}`);
  return url.href;
}

export function parseLawMetadata(html, expectedName) {
  const fields = [
    ...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi),
  ].map((row) => [plainText(row[1]), plainText(row[2])]);
  const name = fields.find(([label]) => label.includes('法規名稱'))?.[1];
  if (!name?.includes(expectedName)) throw new Error(`法規名稱不符：${expectedName}`);
  const field =
    fields.find(([label]) => label.includes('修正日期')) ??
    fields.find(([label]) => label.includes('公布日期'));
  if (!field) throw new Error(`找不到法規日期：${expectedName}`);
  return {
    revisionDate: parseRocDate(field[1]),
    dateLabel: field[0].includes('修正') ? '修正日期' : '公布日期',
    effectiveNotice: plainText(html).includes('本法規部分或全部條文尚未生效')
      ? '官方標示部分或全部條文尚未生效，請查閱全文及沿革。'
      : null,
  };
}

export function parseCompiledThrough(html) {
  const match = plainText(html).match(
    /法規整編資料截止日[：:]\s*(民國\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/,
  );
  if (!match) throw new Error('找不到全國法規整編截止日');
  return parseRocDate(match[1]);
}

function parseNewsRows(html, source) {
  const rows = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length <= Math.max(source.dateIndex, source.kindIndex, source.titleIndex)) continue;
    const dateText = plainText(cells[source.dateIndex]);
    if (!/^\d{2,3}[./-]\d{1,2}[./-]\d{1,2}$/.test(dateText)) continue;
    const anchor = cells[source.titleIndex].match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!anchor) throw new Error(`${source.name} 公告缺少連結`);
    const title = plainText(anchor[2]);
    const kind = plainText(cells[source.kindIndex]);
    if (!title || !kind) throw new Error(`${source.name} 公告缺少標題或分類`);
    rows.push({
      title,
      kind,
      date: parseRocDate(dateText),
      dateLabel: source.dateLabel,
      url: anchor[1],
      source: source.name,
      sourceId: source.id,
      isDraft: /草案|預告/.test(kind + title),
    });
  }
  if (!rows.length) throw new Error(`${source.name} 最新消息格式不符，保留舊資料`);
  return rows;
}

function validateNewsLinks(rows, source) {
  return rows.map((row) => ({ ...row, url: officialUrl(row.url, source.url) }));
}

export function parseNews(html, source) {
  return validateNewsLinks(parseNewsRows(html, source), source);
}

export function parseRecentNews(html, source) {
  const rows = parseNewsRows(html, source);
  const relevant =
    source.id === 'moj'
      ? rows.filter((row) => /勞動|勞工|就業|保險|稅|公司|商業|發票|產業創新/.test(row.title))
      : rows;
  return {
    // Validate only links that will be published. Unrelated local regulations on
    // the same official news page must not block refreshing the selected notices.
    notices: validateNewsLinks(relevant.slice(0, 3), source),
    fetchedCount: rows.length,
    latestListedDate: rows
      .map((row) => row.date)
      .toSorted()
      .at(-1),
  };
}

async function fetchHtml(url) {
  officialUrl(url);
  const { stdout } = await execFileAsync(
    'curl',
    [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--proto',
      '=https',
      '--proto-redir',
      '=https',
      '--max-time',
      '35',
      url,
    ],
    { maxBuffer: 5 * 1024 * 1024 },
  );
  if (!/<html\b/i.test(stdout)) throw new Error(`回應不是 HTML：${url}`);
  return stdout;
}

export async function refreshLaws() {
  const { lawData: previous } = await import(dataUrl.href);
  const laws = [];
  for (const law of previous.laws) {
    laws.push({ ...law, ...parseLawMetadata(await fetchHtml(law.officialUrl), law.name) });
  }
  const compiledThrough = parseCompiledThrough(await fetchHtml('https://law.moj.gov.tw/'));
  const recent = [];
  const sources = [];
  for (const source of newsSources) {
    const parsed = parseRecentNews(await fetchHtml(source.url), source);
    recent.push(...parsed.notices);
    sources.push({
      id: source.id,
      name: source.name,
      url: source.url,
      fetchedCount: parsed.fetchedCount,
      latestListedDate: parsed.latestListedDate,
    });
  }
  const checkedAt = new Date().toISOString();
  const checkedOn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(checkedAt));
  const next = {
    checkedOn,
    checkedAt,
    compiledThrough,
    laws,
    recent: recent.toSorted((a, b) => b.date.localeCompare(a.date)),
    newsSources: sources,
  };
  const output = `// Official metadata only. Refresh with: node scripts/refresh-laws.mjs\nexport const lawData = ${JSON.stringify(next, null, 2)} as const;\n`;
  const temporary = new URL(`${dataUrl.href}.tmp`);
  await writeFile(temporary, output);
  await rename(temporary, dataUrl);
  console.log(
    `已核對 ${laws.length} 部法規、${sources.length} 個公告來源，保留 ${recent.length} 筆公告。核對時間：${checkedAt}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  refreshLaws().catch((error) => {
    console.error(`更新失敗，未覆蓋既有法規資料：${error.message}`);
    process.exitCode = 1;
  });
}
