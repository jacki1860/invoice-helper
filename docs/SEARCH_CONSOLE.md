# Google Search Console 設定與驗證

核對時間：2026-10-01 00:31（Asia/Taipei）。

## 已完成

- 建立 URL-prefix 資源 `https://www.ctrls.com.tw/invoice/`，HTML 標記驗證成功，帳戶為已驗證擁有者。範圍只涵蓋這個 HTTPS／www／invoice 路徑。
- 將 Google 提供的公開 `google-site-verification` 標記保存在 `index.html`，由 `b6240cb00a9b3bc1e714b2b2ac03202f9ac20acb` 提交、推送及部署。後續建置必須保留標記；未新增分析追蹤或外部 JavaScript。
- 提交 `https://www.ctrls.com.tw/invoice/sitemap.xml`。Search Console 最終顯示類型 **Sitemap**、狀態 **成功**、系統探索到的網頁 **31**、影片 **0**，上次讀取日期 **2026年10月1日**。
- 首頁及報價工具頁均完成 Google 即時測試，並顯示「已要求建立索引」，已加入優先檢索佇列。
- 「人工判決處罰」與「安全性問題」皆顯示「未偵測到任何問題」。
- Google 搜尋生成式 AI 沿用 `ctrls.com.tw` 預設，當前為 **包含**。這次只確認狀態，未變更繼承或公司層級設定。

## 網址檢查結果

| 網址                   | Google 即時測試                                       | 建立索引申請                            |
| ---------------------- | ----------------------------------------------------- | --------------------------------------- |
| `/invoice/`            | 允許檢索、擷取成功、允許編入索引；宣告 canonical 正確 | 已加入優先檢索佇列                      |
| `/invoice/quote/`      | Google 可為網址建立索引；導覽標記 1 個有效項目        | 已加入優先檢索佇列                      |
| `/invoice/sitemap.xml` | 00:29:03：允許檢索、擷取成功                          | 僅作擷取診斷，未申請將 XML 編入搜尋索引 |

首頁與報價頁首次 Google Index 狀態均為「網址不在 Google 服務中／Google 無法辨識的網址」。即時測試與申請成功不代表實際收錄完成；31 是 Sitemap 解析出的網址數，不是已收錄頁數。搜尋流量、排名、AI 引用與全站收錄數仍待後續報表。

## 初次 Sitemap 狀態與排查

最初提交對話框顯示成功，但報表短暫呈現「未知／無法擷取／0」。公開 HTTP 為 200、正常 TLS、有效 XML，2233 bytes 與 manifest 相同；主機也有帶 Googlebot User-Agent 的 200 抓取紀錄，該紀錄只作輔助證據，未靠 User-Agent 宣稱完成來源身分驗證。

在上述新證據下，僅重新提交相同 Sitemap 一次；依 Google 官方流程對 Sitemap 本身做 Live test，確認允許檢索及擷取成功，並確認沒有人工處置。後續回到 Sitemap 報表已為 **成功／31**，期間沒有再修改站台、robots、DNS、Cloudflare 或 Nginx 設定。無法據此斷言初次狀態的內部原因，也不需要繼續重複提交。

## 發布與證據

驗證標記版於 **2026-10-01 00:23:31 Asia/Taipei** 發布。隔離 Git archive 的 Node 24.21.0 `npm ci`、173 項測試、lint、格式、TypeScript、公司建置及 31 頁 SEO 檢查通過。31 HTML 相較前版僅多驗證標記，其餘 6 個公開檔案逐位元組相同；獨立公開核對 37／37 檔 HTTP 200、SHA 相符，主機新舊 37 檔皆完整。發布位置與回復方式見[部署紀錄](DEPLOYMENT.md)。

控制台結果、截圖、即時測試、索引申請、公開與主機核對保存在本機 `.wrangler/search-console/`；不把含帳戶介面的原始截圖放進公開倉庫。此分支沒有遠端 CI run；本次沒有重新執行完整互動測試，因為應用 JS／CSS 及 sitemap 與已驗證前版相同。

實測後 Jev 第二意見：擁有權與索引申請為 supported（0.94／0.97），sitemap 為 contradicted（0.16），未附具體理由。主流程因此重新目視最終控制台截圖並讀回同一頁文字：明確為「成功／31」，與完成宣告一致；保留初次「無法擷取」的不同時間狀態，不將其混為最終結果，也不把 Jev 回覆稱為全項通過。

## 後續維護

1. 保留 `index.html` 的驗證 meta。新增工具後更新 sitemap 並按既有流程建置、部署；Google 會定期重新處理已提交的 sitemap。
2. 後續在「網頁」與「成效」報表查看收錄及搜尋資料。新資源概述當時顯示「資料處理中，請等約一天後再返回查看」，這不是保證一天內完成收錄。
3. 不重複申請相同頁面；新的一批頁面用 sitemap，重要新入口再視需要單獨檢查及申請。
4. 若將來出現讀取錯誤，依官方流程先對 exact sitemap URL 做 Live test，記錄允許檢索與擷取結果，再依具體原因處理。不要用正常瀏覽器 200 代替 Google 的實際檢查。

官方依據：[Sitemaps report](https://support.google.com/webmasters/answer/7451001?hl=en)、[URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en)、[要求 Google 重新檢索](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)、[Property 範圍](https://support.google.com/webmasters/answer/34592?hl=en)。
