# SEO 與 AI 搜尋

本次改善已在本機完成，尚未部署或提交搜尋引擎。正式版本仍以 [DEPLOYMENT.md](DEPLOYMENT.md) 的發布紀錄為準。

## 網址與內容

- 首頁 `/invoice/`、4 個 `/invoice/category/<分類>/`、20 個 `/invoice/<工具>/`，共 25 個實際 HTML 檔。
- 建置時輸出每頁的用途、操作步驟、常見問題及可跟隨的連結；停用 JavaScript 仍可閱讀。互動計算與文件編輯需要 JavaScript。
- React 接手後保留同一份說明。站內使用 History API 切換，保持已掛載工具的表單與交接資料；直接重整仍依原本的工具保存規則處理。
- 相容舊 hash 與發票預填 query。合法工具 hash 轉為對應路徑，保留 query；帶 query 的 `#tools` 保留明確的總覽選擇。使用新的站內連結時不攜帶預填 query，避免把交易資料傳到其他工具網址。
- 每頁提供獨立 title、description、canonical、Open Graph／Twitter 文字資訊與 JSON-LD。標記限於 `WebSite`、`WebPage`／`CollectionPage`、`WebApplication`、`ItemList`、`BreadcrumbList`，沒有虛構評分或收錄承諾。
- `src/features/seo/content.ts` 是說明文案來源；新增工具時一併補齊內容。年度型工具須在更新資料快照時核對其標題、步驟及 FAQ 年度。
- canonical 與 sitemap 固定指向已確認的正式站 `https://www.ctrls.com.tw/invoice/`。一般根目錄 build 供相容性檢查；公司正式發布使用 `build:company`。更換正式網域時須同步調整 `src/features/seo/pages.ts` 與產物檢查腳本。

## 檢查與發布

```sh
npm run lint
npm run format:check
npm test
npm run build
npm run test:seo-build
npm run build:company
npm run test:seo-build -- /invoice/
```

`test:seo-build` 直接檢查產出的 HTML，核對 sitemap 全部網址、獨立標題、canonical、可見問答、JSON-LD，以及資源和連結確實存在。CI 在一般 build 後執行此檢查。

發布時仍只使用 `dist/client/` 公開產物，但檔案數已超過舊版的五檔，封存及部署清單必須包含所有工具／分類 HTML、`sitemap.xml`、favicon 與資源。不要沿用舊的固定五檔白名單；也不要上傳 Worker、原始碼或本機瀏覽器測試資料。

使用實際目錄的 `index.html`，不需要新 SPA rewrite。發布後須在正式主機驗證各工具直接開啟、重新整理、舊 hash、未知路徑 404、CSS／JS 及 sitemap，再確認目前 live 版本。

## 搜尋引擎端的後續工作

1. 在有權限的 Google Search Console 屬性提交 `https://www.ctrls.com.tw/invoice/sitemap.xml`，並用網址檢查工具查看首頁及代表性工具頁；這一步未執行。
2. 確認 Search Console 的 Search generative AI 設定是否為 Include，留意父屬性繼承設定；檢查索引及 Generative AI 效能報表。帳號狀態與收錄結果未驗證。
3. 本次公開讀取 `/robots.txt` 為 HTTP 200，只有 Cloudflare content-signal 註解，未見生效的 Disallow。公司網域的 robots 只能在根目錄 `/robots.txt` 生效，`/invoice/robots.txt` 不能代替它。本次未修改公司根目錄設定。
4. 可在保留既有 robots 規則的前提下，新增 `Sitemap: https://www.ctrls.com.tw/invoice/sitemap.xml`；也可直接透過 Search Console 提交，不必為此覆蓋公司 robots。
5. 在 Cloudflare 與伺服器紀錄確認真正的 Googlebot／OAI-SearchBot 能取回頁面。一般 curl 或瀏覽器 200 不代表已核實爬蟲放行，也不代表搜尋引擎已收錄。ChatGPT 搜尋使用 OAI-SearchBot，與訓練用 GPTBot 分開，不需為了搜尋而更改訓練授權。

## 本機驗證結果

2026-09-30，Node 24.21.0：149 項測試、lint、格式、TypeScript、一般與公司建置通過。兩種 base 的產物檢查均回報 `SEO build verified: 25 HTML pages`。本次沒有新增依賴；入口約 534.68 kB／gzip 148.84 kB，仍有既有的 500 kB chunk 大小提示。

使用真實 Chromium 瀏覽器配合一般靜態 HTTP server 驗證，不使用 SPA fallback：

- 停用 JavaScript：25 頁均 200，各有 1 個主標題、至少 2 個可讀問答及互動功能說明；未知路徑為 404。
- 啟用 JavaScript：25 頁逐一直接開啟，title、Open Graph title 與 canonical 正確，JSON-LD 可解析；320px 全部無水平溢出，無 pageerror。
- 載入報價範例後切換分類、上一頁、下一頁，再回報價，表單內容保留；請款帶入收據為 11,550 元，實際收款日期留白。
- `/invoice/?amount=100#tools` 重整仍在總覽；舊 `#invoice` 預填 1,050 與品名轉成工具路徑後，重整仍保留預填值。
- 320px／1440px 說明區截圖已目視；列印時說明區隱藏，實際報價 PDF 文字讀回為 11,000＋550＝11,550，沒有 FAQ／相關工具混入。

截圖：[桌面說明區](design/seo-guide-desktop.png)、[停用 JavaScript 的手機頁](design/seo-no-js-mobile.png)。這些是本機瀏覽器結果，不是正式站、搜尋引擎收錄、其他瀏覽器引擎或實體手機驗證。

獨立唯讀審查發現並修正 `#tools` 搭配預填 query 的路由歧義，修正後由主流程在瀏覽器重整驗證。沒有已知未修正的審查缺陷。CI 設定已加入產物檢查，但本次尚未提交／推送，沒有本次遠端 CI 結果。

實測後 Jev 第二意見三項均選 supported：靜態頁／回歸／宣告範圍信心為 0.94／0.67／0.91。回歸項低於未校準提醒門檻，未提供具體反例；主流程已核對 149 項測試、上述瀏覽器實測與 PDF 文字讀回，保留多瀏覽器、實體裝置及正式站尚未驗證的限制，不把 Jev 判斷視為獨立測試。

已準備 31 個公開檔案的本機發布封存與 SHA-256 manifest（25 HTML、sitemap、favicon、紙紋及 3 個資源），逐檔核對封存內容與 `dist/client/` 一致；沒有切換正式站。後續來源或建置有變更時必須重新封存與核對。

## 依據

核對日：2026-09-30。這些改善讓內容更容易被找到和理解，不保證排名、流量或 AI 引用。

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)：可跟隨網址、History API、預渲染及 metadata。
- [Google generative AI 搜尋指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)：可索引、實用且清楚的內容仍是基礎；沒有必要為 Google 額外建立 llms.txt。
- [Google sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)：列出 canonical URL，沒有可靠修改時間便不捏造 lastmod。
- [Google 結構化資料規則](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)：標記須與可見內容一致。
- [Google Search generative AI 控制](https://support.google.com/webmasters/answer/16908024)及[效能報表](https://support.google.com/webmasters/answer/16984139)：帳號端設定與觀察。
- [OpenAI crawler 文件](https://developers.openai.com/api/docs/bots)：搜尋與訓練爬蟲的不同用途。
