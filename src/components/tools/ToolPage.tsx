import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

export function ToolPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="public-tool-page">
      <header className="public-tool-heading">
        <h1>{title}</h1>
        <p className="lead">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function SourceNote({
  checkedOn,
  children,
  sources,
}: {
  checkedOn: string;
  children?: ReactNode;
  sources: { label: string; url: string }[];
}) {
  return (
    <aside className="source-note" aria-label="資料來源與適用範圍">
      <p>資料核對：{checkedOn}。最新內容以官方公告為準。</p>
      {children}
      <div className="source-links">
        {sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
            {source.label}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ))}
      </div>
    </aside>
  );
}

export function SessionNote() {
  return (
    <p className="session-note">
      內容只留在本次頁面，重新整理後不保留；計算與文件產生在你的瀏覽器完成。
    </p>
  );
}
