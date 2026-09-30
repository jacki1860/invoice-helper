import assert from 'node:assert/strict';
import test from 'node:test';
import { lawData } from '../src/data/laws.ts';
import { buildOfficialLawSearchUrl, filterLaws } from '../src/domain/laws.ts';
import {
  newsSources,
  officialUrl,
  parseCompiledThrough,
  parseLawMetadata,
  parseNews,
  parseRecentNews,
  parseRocDate,
} from '../scripts/refresh-laws.mjs';

test('law index filters names, aliases, multiple terms, and categories without mutating data', () => {
  assert.equal(filterLaws(lawData.laws, '').length, 14);
  assert.deepEqual(
    filterLaws(lawData.laws, '  勞基法　細則 ').map((law) => law.id),
    ['N0030002'],
  );
  assert.equal(filterLaws(lawData.laws, '特休')[0]?.name, '勞動基準法');
  assert.equal(filterLaws(lawData.laws, '勞基法', 'tax').length, 0);
  assert.equal(filterLaws(lawData.laws, '', 'insurance').length, 5);
  assert.equal(filterLaws(lawData.laws, '沒有這部法規').length, 0);
  assert.equal(lawData.laws.length, 14);
});

test('official search preserves the keyword as a single encoded parameter', () => {
  const keyword = '所得稅 & 發票/# ?kw=公司';
  const url = new URL(buildOfficialLawSearchUrl(` ${keyword} `));
  assert.equal(url.origin, 'https://law.moj.gov.tw');
  assert.equal(url.pathname, '/Law/LawSearchResult.aspx');
  assert.equal(url.searchParams.get('kw'), keyword);
  assert.equal(url.searchParams.get('ty'), 'ONEBAR');
  assert.equal(url.searchParams.get('sSearch'), '');
  assert.equal([...url.searchParams].length, 3);
  assert.equal(url.hash, '');
  assert.equal(buildOfficialLawSearchUrl('　 '), 'https://law.moj.gov.tw/');
});

test('shipped index has unique official metadata and actual checked timestamps', () => {
  assert.equal(new Set(lawData.laws.map((law) => law.id)).size, 14);
  for (const law of lawData.laws) {
    assert.match(law.revisionDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['修正日期', '公布日期'].includes(law.dateLabel));
    assert.ok(['law.moj.gov.tw', 'law-out.mof.gov.tw'].includes(new URL(law.officialUrl).hostname));
    assert.ok(law.aliases.length > 0);
  }
  assert.ok(Number.isFinite(Date.parse(lawData.checkedAt)));
  assert.match(lawData.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(lawData.compiledThrough, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(lawData.newsSources.length, 3);
  assert.ok(lawData.recent.length > 0);
  for (const notice of lawData.recent) assert.equal(officialUrl(notice.url), notice.url);
});

test('law parser reads header dates and flags explicit pending effectiveness', () => {
  const html =
    '<table><tr><th>法規名稱：</th><td>所得稅法</td></tr><tr><th>修正日期：</th><td>民國 115 年 09 月 11 日</td></tr></table><p>本法規部分或全部條文尚未生效，最後生效日期：未定</p><p>民國 116 年 1 月 1 日</p>';
  const result = parseLawMetadata(html, '所得稅法');
  assert.equal(result.revisionDate, '2026-09-11');
  assert.equal(result.dateLabel, '修正日期');
  assert.match(result.effectiveNotice, /尚未生效/);
  assert.throws(() => parseLawMetadata(html, '勞動基準法'), /名稱不符/);
  assert.throws(
    () => parseLawMetadata('<th>法規名稱：</th><td>所得稅法</td>', '所得稅法'),
    /找不到法規日期/,
  );
});

test('dates validate calendar days and distinguish the compiled cutoff', () => {
  assert.equal(parseRocDate('115.09.24'), '2026-09-24');
  assert.equal(parseRocDate('113-02-29'), '2024-02-29');
  assert.throws(() => parseRocDate('115.02.29'), /無效日期/);
  assert.equal(
    parseCompiledThrough('<p>法規整編資料截止日：民國 115 年 09 月 18 日</p>'),
    '2026-09-18',
  );
  assert.throws(() => parseCompiledThrough('<html>暫停服務</html>'), /找不到/);
});

test('news parser preserves publication dates, draft state, and entity-encoded official links', () => {
  const mol = newsSources.find((source) => source.id === 'mol');
  const drafts = parseNews(
    '<table><tr><td>115.09.10</td><td>法規草案</td><td><a href="news.aspx?msgid=6937">&#21214;工保護草案</a><span>預告終止日：115.10.12</span></td></tr></table>',
    mol,
  );
  assert.equal(drafts[0].date, '2026-09-10');
  assert.equal(drafts[0].dateLabel, '公發布日');
  assert.equal(drafts[0].title, '勞工保護草案');
  assert.equal(drafts[0].isDraft, true);
  assert.equal(drafts[0].url, 'https://laws.mol.gov.tw/news.aspx?msgid=6937');
  const mof = newsSources.find((source) => source.id === 'mof');
  const notices = parseNews(
    '<tr><td>1.</td><td>115.09.24</td><td><a href="https://gazette.nat.gov.tw/egFront/detail.do?metaid=168585&amp;log=detailLog">自115年10月1日調整營業稅</a></td><td>實質法規</td></tr>',
    mof,
  );
  assert.equal(notices[0].date, '2026-09-24');
  assert.equal(notices[0].dateLabel, '資料日期');
  assert.equal(new URL(notices[0].url).searchParams.get('log'), 'detailLog');
  assert.equal(notices[0].isDraft, false);
  assert.throws(() => parseNews('<html>網站維護中</html>', mol), /保留舊資料/);
});

test('news parser rejects non-official or unsafe links before saving', () => {
  assert.throws(() => officialUrl('javascript:alert(1)'), /非允許/);
  assert.throws(() => officialUrl('https://law.moj.gov.tw.evil.test/'), /非允許/);
  assert.throws(() => officialUrl('http://law.moj.gov.tw/'), /非允許/);
  const source = newsSources[0];
  assert.throws(
    () =>
      parseNews(
        '<tr><td>1.</td><td>115-09-30</td><td>法律</td><td><a href="https://example.com">公司法</a></td></tr>',
        source,
      ),
    /非允許/,
  );
});

test('recent selection ignores unrelated local links while preserving source counts and dates', () => {
  const source = newsSources[0];
  const html = [
    '<tr><td>1.</td><td>115-09-29</td><td>法律</td><td><a href="/News/NewsDetail.aspx?msgid=1">修正公司法</a></td></tr>',
    '<tr><td>2.</td><td>115-09-29</td><td>法律</td><td><a href="/News/NewsDetail.aspx?msgid=2">修正所得稅法</a></td></tr>',
    '<tr><td>3.</td><td>115-09-29</td><td>法律</td><td><a href="/News/NewsDetail.aspx?msgid=3">修正勞工保險條例</a></td></tr>',
    '<tr><td>19.</td><td>115-09-30</td><td>行政規則</td><td><a href="https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL041850">修正「臺北市政府特殊境遇家庭扶助申請及審核作業須知」</a></td></tr>',
  ].join('');
  const parsed = parseRecentNews(html, source);
  assert.equal(parsed.fetchedCount, 4);
  assert.equal(parsed.latestListedDate, '2026-09-30');
  assert.deepEqual(
    parsed.notices.map((row) => row.title),
    ['修正公司法', '修正所得稅法', '修正勞工保險條例'],
  );
  for (const row of parsed.notices) assert.equal(new URL(row.url).hostname, 'law.moj.gov.tw');
});

test('recent selection still rejects an unsafe link when that notice would be published', () => {
  assert.throws(
    () =>
      parseRecentNews(
        '<tr><td>1.</td><td>115-09-30</td><td>法律</td><td><a href="https://example.com">修正公司法</a></td></tr>',
        newsSources[0],
      ),
    /非允許/,
  );
});
