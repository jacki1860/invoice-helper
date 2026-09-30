# 公司網站部署

目標：[https://www.ctrls.com.tw/invoice/](https://www.ctrls.com.tw/invoice/)。使用既有公司 SSH 設定與 Nginx 靜態檔案服務。

## 建置與發布方式

1. 使用 Node 24，執行 `npm ci`、`npm run build:company`。
2. 核對 `dist/client/index.html` 的 JS／CSS URL 以 `/invoice/assets/` 開頭；紙紋 URL 為 `/invoice/paper-grain.png`。
3. 只上傳 `dist/client/` 的公開產物。不要上傳原始碼、Worker 目錄、設定檔或整個 `dist/`。
4. 新內容先放到 `/var/www/invoice-helper/releases/<commit>/`，對照逐檔 SHA-256。
5. 舊 `/var/www/html/invoice` 移到 `/var/backups/invoice-helper/` 的具日期備份，確認其內容與搬移前完全相同。
6. 將 `/var/www/html/invoice` 指向已驗證的新版本。後續發布以替換該符號連結切換版本。
7. 驗證公開首頁、JS、CSS、紙紋、動態匯出 chunk，以及三工具、公司查詢、複製和 PNG。需要回復時，只切回本次備份或上一個已驗證 release；不修改其他站點。

路由採 hash，不需要伺服器端應用程式或額外 SPA rewrite。既有 Nginx 會將實際目錄的 `/invoice` 導向 `/invoice/`。

## 2026-09-30 發布前檢查

- 使用者明確授權 commit、push、部署至上述網址，並取代舊內容。
- 公司主機與 SSH 身分已現場核對，Nginx 正常執行；本次不更動其他站點設定。
- 舊站回應 403；舊產物的入口位於 `invoice/client/index.html`，沒有放在網站根目錄。
- 專用建置、lint、格式檢查通過；已確認 Vite 正確改寫子目錄資源路徑。

正式部署結果於完成公開網站驗證後補記。
