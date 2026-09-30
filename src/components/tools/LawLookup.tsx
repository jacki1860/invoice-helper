import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { lawData } from '../../data/laws';
import { buildOfficialLawSearchUrl, filterLaws, lawCategories } from '../../domain/laws';
import type { LawCategory } from '../../domain/laws';
import { SourceNote, ToolPage } from './ToolPage';
import './laws.css';

export function LawLookup() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LawCategory>('all');
  const filtered = filterLaws(lawData.laws, query, category);
  const checkedAt = new Date(lawData.checkedAt).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
  });

  return (
    <ToolPage title="法規查詢" description="從常用法規找到官方原文，查閱最新修正與公告。">
      <section className="law-search-section" aria-labelledby="law-search-title">
        <div className="law-section-heading">
          <div>
            <span className="law-eyebrow">常用法規索引</span>
            <h2 id="law-search-title">先找到你需要的法規</h2>
          </div>
          <span className="law-count">{lawData.laws.length} 部常用法規</span>
        </div>
        <p className="law-scope">
          本站依名稱、常用簡稱與主題篩選。查找其他法規或條文內容，請使用官方全文搜尋。
        </p>
        <form
          className="law-search-form"
          action="https://law.moj.gov.tw/Law/LawSearchResult.aspx"
          method="get"
          target="_blank"
          rel="noopener noreferrer"
        >
          <input type="hidden" name="ty" value="ONEBAR" />
          <input type="hidden" name="sSearch" value="" />
          <label className="law-search-input">
            <Search size={19} aria-hidden="true" />
            <span className="law-visually-hidden">搜尋法規名稱、簡稱或主題</span>
            <input
              name="kw"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="試試「勞基法」、「發票」或「公司」"
              required
            />
          </label>
          <button type="submit" className="law-official-button">
            到官方搜尋
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </form>
        <div className="law-categories" aria-label="法規分類">
          {lawCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="law-result-count" role="status">
          顯示 {filtered.length} 部法規
        </p>
        <div className="law-list">
          {filtered.map((law) => (
            <article className="law-row" key={law.id}>
              <div className="law-row-text">
                <span className="law-category-label">
                  {lawCategories.find((item) => item.id === law.category)?.label}
                </span>
                <h3>
                  <a href={law.officialUrl} target="_blank" rel="noopener noreferrer">
                    {law.name}
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </a>
                </h3>
                {law.effectiveNotice && (
                  <p className="law-effective-notice">{law.effectiveNotice}</p>
                )}
              </div>
              <div className="law-row-meta">
                <span>{law.dateLabel}</span>
                <time dateTime={law.revisionDate}>{law.revisionDate}</time>
                <span>{law.source}</span>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="law-empty">
              <h3>這份常用索引沒有符合的法規</h3>
              <p>可調整分類，或到全國法規資料庫繼續查找。</p>
              <a href={buildOfficialLawSearchUrl(query)} target="_blank" rel="noopener noreferrer">
                到官方查詢{query.trim() && `「${query.trim()}」`}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="law-news-section" aria-labelledby="law-news-title">
        <div className="law-section-heading">
          <div>
            <span className="law-eyebrow">官方公告摘錄</span>
            <h2 id="law-news-title">近期公告，回到來源確認</h2>
          </div>
          <span className="law-count">核對於 {lawData.checkedOn}</span>
        </div>
        <p className="law-scope">
          以下為核對當日官方最新消息首頁的部分公告，並非即時或完整清單。日期沿用來源欄位，不代表生效日；草案尚待後續程序。
        </p>
        <div className="law-news-list">
          {lawData.recent.map((notice) => (
            <article className="law-news-row" key={notice.url}>
              <div className="law-news-date">
                <time dateTime={notice.date}>{notice.date}</time>
                <span>{notice.dateLabel}</span>
              </div>
              <div>
                <div className="law-news-labels">
                  <span>{notice.source}</span>
                  <span className={notice.isDraft ? 'law-kind law-kind-draft' : 'law-kind'}>
                    {notice.kind}
                  </span>
                  {notice.isDraft && !notice.kind.includes('草案') && (
                    <span className="law-kind law-kind-draft">草案／預告</span>
                  )}
                </div>
                <h3>
                  <a href={notice.url} target="_blank" rel="noopener noreferrer">
                    {notice.title}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </h3>
              </div>
            </article>
          ))}
        </div>
        <div className="law-official-sources">
          {lawData.newsSources.map((source) => (
            <a href={source.url} key={source.id} target="_blank" rel="noopener noreferrer">
              <span>
                {source.name}
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
              <small>查看官方最新公告</small>
            </a>
          ))}
        </div>
      </section>

      <SourceNote
        checkedOn={lawData.checkedOn}
        sources={[
          { label: '全國法規資料庫', url: 'https://law.moj.gov.tw/' },
          { label: '勞動部法令查詢系統', url: 'https://laws.mol.gov.tw/' },
          { label: '財政部主管法規查詢系統', url: 'https://law-out.mof.gov.tw/' },
        ]}
      >
        <p>
          本頁核對時間：{checkedAt}（臺灣時間）。全國法規資料庫整編資料截止：
          {lawData.compiledThrough}；各機關公告更新進度不同。
        </p>
        <p>
          本站提供官方資料索引，不提供法律解釋。修正、公布與施行日期可能不同，適用條文及生效狀態請查閱官方全文、沿革與公告。
        </p>
      </SourceNote>
    </ToolPage>
  );
}
