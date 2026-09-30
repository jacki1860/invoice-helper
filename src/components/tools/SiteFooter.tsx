import { Lightbulb, Mail } from 'lucide-react';

const developerEmail = 'jacki1860@gmail.com';
const emailLink = (subject: string, body: string) =>
  `mailto:${developerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="聯絡與功能許願">
      <div className="site-footer-contact">
        <div>
          <h2>聯絡與功能許願</h2>
          <p>遇到問題，或有想用的新工具，歡迎來信。</p>
        </div>
        <div className="site-footer-actions">
          <a
            className="button button-quiet"
            href={emailLink(
              '[小事務] 聯絡開發者',
              '你好，我想聯絡小事務的開發者。\n\n相關工具（如適用）：\n想詢問或回報的事情：\n\n',
            )}
          >
            <Mail size={17} aria-hidden="true" />
            聯絡開發者
          </a>
          <a
            className="button button-primary"
            href={emailLink(
              '[小事務] 功能許願',
              '你好，我想許願新功能。\n\n希望加入的功能：\n使用情境／想解決的問題：\n目前怎麼處理這件事：\n\n',
            )}
          >
            <Lightbulb size={17} aria-hidden="true" />
            許願新功能
          </a>
        </div>
      </div>
      <p className="site-footer-email">
        點擊會開啟郵件程式，也可以直接寄信至 <span>{developerEmail}</span>。
      </p>
      <div className="site-footer-meta">
        <span>免登入，開了就用。</span>
        <p>文件內容留在本次頁面；公開資料附上來源與核對日期。</p>
        <a href={`${import.meta.env.BASE_URL}sitemap.xml`}>網站地圖</a>
      </div>
    </footer>
  );
}
