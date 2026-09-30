import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { categories, tools, type Category } from '../../features/tools/catalog';

export function ToolOverview({ category }: { category?: Category }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('zh-TW');
  const matches = tools.filter(
    (tool) =>
      (!category || tool.category === category) &&
      `${tool.label} ${tool.description} ${tool.keywords}`
        .toLocaleLowerCase('zh-TW')
        .includes(normalized),
  );
  const selected = categories.find((entry) => entry.id === category);
  return (
    <div className="tools-overview">
      <div className="overview-intro">
        <div>
          <p className="overview-eyebrow">小事務，慢慢理清楚。</p>
          <h1>{selected?.label || '日常行政，順手完成。'}</h1>
          <p className="lead">
            {selected?.description || '寫份文件、算筆金額，或查一個有根據的答案。'}
          </p>
        </div>
        <label className="tool-search">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">搜尋工具</span>
          <input
            type="search"
            value={query}
            placeholder="找工具，例如：報價、勞保、假日"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="tool-directory">
        {categories
          .filter((entry) => !category || entry.id === category)
          .map((entry, index) => {
            const entries = matches.filter((tool) => tool.category === entry.id);
            if (!entries.length) return null;
            return (
              <section key={entry.id} className="directory-section">
                <header>
                  <span>0{index + 1}</span>
                  <h2>{entry.label}</h2>
                </header>
                <div>
                  {entries.map((tool) => (
                    <a key={tool.id} href={`#${tool.id}`} className="directory-tool">
                      <div>
                        <h3>{tool.label}</h3>
                        <p>{tool.description}</p>
                      </div>
                      <ArrowUpRight size={22} strokeWidth={1.5} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
      </div>
      {matches.length === 0 && (
        <p className="empty-result" role="status">
          沒有找到符合的工具，試試其他關鍵字。
        </p>
      )}
    </div>
  );
}
