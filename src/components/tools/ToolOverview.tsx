import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Search, X } from 'lucide-react';
import {
  categories,
  tools,
  pagePath,
  taskCollections,
  taskForPage,
  toolsForPage,
  categoryForPage,
  type PageId,
  type ToolId,
} from '../../features/tools/catalog';
import { searchTools } from '../../features/tools/discovery';
import { FavoriteButton } from './FavoriteButton';

const base = import.meta.env.BASE_URL;
type Props = { page: PageId; favorites: ToolId[]; toggleFavorite: (id: ToolId) => void };

export function ToolOverview({ page, favorites, toggleFavorite }: Props) {
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [expandFavorites, setExpandFavorites] = useState(false);
  const searching = Boolean(query.trim());
  const isHome = page === 'tools';
  const task = taskForPage(page);
  const category = categoryForPage(page);
  const selected = categories.find((entry) => entry.id === category);
  const savedTools = favorites.flatMap((id) => tools.filter((entry) => entry.id === id));
  const entries = searching ? searchTools(query) : onlyFavorites ? savedTools : toolsForPage(page);
  const title = task?.label || selected?.label || (isHome ? '今天，要做什麼？' : '全部工具');
  const description =
    task?.description ||
    selected?.description ||
    (isHome ? '從手上的事情出發，找到用得上的工具。' : '依類型瀏覽，或直接搜尋你想完成的事情。');

  const renderEntry = (entry: (typeof tools)[number]) => (
    <div className="directory-item" key={entry.id}>
      <a className="directory-tool" href={pagePath(entry.id, base)}>
        <div>
          <h3>{entry.label}</h3>
          <p>{entry.description}</p>
        </div>
        <ArrowUpRight size={19} strokeWidth={1.5} aria-hidden="true" />
      </a>
      <FavoriteButton
        tool={entry}
        selected={favorites.includes(entry.id)}
        onToggle={toggleFavorite}
      />
    </div>
  );

  return (
    <div className="tools-overview">
      <div className="overview-intro">
        <div>
          <p className="overview-eyebrow">小事務，慢慢理清楚。</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
        </div>
        <div className="discovery-search">
          <label className="tool-search">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">搜尋全部工具</span>
            <input
              type="search"
              value={query}
              placeholder="找工具，例如：報帳、催款、假日"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p>搜尋涵蓋全部 {tools.length} 個工具</p>
        </div>
      </div>
      {searching ? (
        <section className="discovery-section" aria-labelledby="search-results-title">
          <div className="discovery-section-heading">
            <div>
              <h2 id="search-results-title">全站搜尋結果</h2>
              <p role="status">找到 {entries.length} 個工具</p>
            </div>
            <button className="discovery-text-button" type="button" onClick={() => setQuery('')}>
              <X size={16} aria-hidden="true" />
              清除搜尋
            </button>
          </div>
          <div className="discovery-tool-list">{entries.map(renderEntry)}</div>
          {entries.length === 0 && (
            <p className="discovery-empty">
              沒有找到符合的工具，試試較短的關鍵字，例如「報帳」或「日期」。
            </p>
          )}
        </section>
      ) : isHome ? (
        <>
          <section className="discovery-section" aria-labelledby="favorites-title">
            <div className="discovery-section-heading">
              <div>
                <h2 id="favorites-title">我的常用</h2>
                {savedTools.length > 0 && <p>按工具旁的星號加入，只記在這個瀏覽器。</p>}
              </div>
              <a className="discovery-text-link" href={pagePath('directory', base)}>
                挑選工具
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            {savedTools.length ? (
              <>
                <div className="discovery-tool-list favorite-tools">
                  {(expandFavorites ? savedTools : savedTools.slice(0, 6)).map(renderEntry)}
                </div>
                {savedTools.length > 6 && (
                  <button
                    className="discovery-text-button"
                    type="button"
                    aria-expanded={expandFavorites}
                    onClick={() => setExpandFavorites(!expandFavorites)}
                  >
                    {expandFavorites ? '收起常用工具' : `展開全部 ${savedTools.length} 個常用`}
                  </button>
                )}
              </>
            ) : (
              <p className="discovery-empty">按星號加入常用，只記在這個瀏覽器。</p>
            )}
          </section>
          <section className="discovery-section" aria-labelledby="tasks-title">
            <div className="discovery-section-heading">
              <div>
                <h2 id="tasks-title">依事情找工具</h2>
                <p>選一件正在處理的事，再挑需要的工具。</p>
              </div>
            </div>
            <div className="task-directory">
              {taskCollections.map((collection) => (
                <a
                  className="task-entry"
                  href={pagePath(`task-${collection.id}`, base)}
                  key={collection.id}
                >
                  <div>
                    <h3>{collection.label}</h3>
                    <p>{collection.description}</p>
                  </div>
                  <span>
                    {collection.toolIds.length} 個工具
                    <ArrowUpRight size={21} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
            <a className="directory-link" href={pagePath('directory', base)}>
              查看全部 {tools.length} 個工具
              <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </>
      ) : (
        <section className="discovery-section" aria-labelledby="directory-title">
          <div className="discovery-section-heading">
            <div>
              <h2 id="directory-title">
                {onlyFavorites ? '我的常用工具' : task ? '這件事會用到的工具' : '工具目錄'}
              </h2>
              <p>
                {onlyFavorites
                  ? `共 ${entries.length} 個；只記在這個瀏覽器。`
                  : `共 ${entries.length} 個工具；按星號加入常用。`}
              </p>
            </div>
            {task && (
              <a className="discovery-text-link" href={pagePath('tools', base)}>
                其他事情
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            )}
          </div>
          {!task && (
            <nav className="directory-filters" aria-label="工具類型">
              <a
                href={pagePath('directory', base)}
                aria-current={page === 'directory' && !onlyFavorites ? 'page' : undefined}
                onClick={() => setOnlyFavorites(false)}
              >
                全部
              </a>
              {categories.map((entry) => (
                <a
                  key={entry.id}
                  href={pagePath(`category-${entry.id}`, base)}
                  aria-current={category === entry.id && !onlyFavorites ? 'page' : undefined}
                  onClick={() => setOnlyFavorites(false)}
                >
                  {entry.label}
                </a>
              ))}
              <button
                type="button"
                aria-pressed={onlyFavorites}
                onClick={() => setOnlyFavorites(!onlyFavorites)}
              >
                我的常用
              </button>
            </nav>
          )}
          <div className="discovery-tool-list">{entries.map(renderEntry)}</div>
          {entries.length === 0 && (
            <p className="discovery-empty">
              還沒有常用工具。切回「全部」，按工具旁的星號就能加入。
            </p>
          )}
        </section>
      )}
    </div>
  );
}
