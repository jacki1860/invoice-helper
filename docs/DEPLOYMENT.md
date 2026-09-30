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

## 2026-09-30 正式發布結果

- 發布時間：2026-09-30 **17:54:53 Asia/Taipei**（09:54:53 UTC）。
- 部署來源：`562ae00c1eab4357def3a52f066f708d953f94d7`，已推送至 `codex/admin-tools-foundation`。`main` 未更動；後續文件提交不改變本次部署產物。
- 正式入口：[https://www.ctrls.com.tw/invoice/](https://www.ctrls.com.tw/invoice/)。
- Release：`/var/www/invoice-helper/releases/562ae00c1eab4357def3a52f066f708d953f94d7`。
- Live：`/var/www/html/invoice` 為指向上述 release 的符號連結。
- 舊站備份：`/var/backups/invoice-helper/20260930T095453Z-562ae00/invoice`，位於公開網站以外；同層保留 `OLD-SHA256SUMS`、`OLD-FILES`、`NGINX-SHA256SUMS`。
- 新版逐檔 manifest：`/var/www/invoice-helper/manifests/562ae00c1eab4357def3a52f066f708d953f94d7.sha256`。

SSH 切換腳本成功完成，獨立只讀審查確認 live 連結、7 個舊檔備份 checksum 與 Nginx 狀態。沒有修改 Nginx 設定或重啟服務，也沒有修改其他站點內容。

### 公開 HTTP 與瀏覽器檢查

| 檢查            | 實際結果                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| 首頁與 4 個資源 | `index.html`、主 JS、CSS、html2canvas 動態 chunk、紙紋共 5 檔回應 200，SHA-256 與本機產物一致。                  |
| 子目錄入口      | `/invoice` 重新導向 `/invoice/`，保留 query string。                                                             |
| 舊內容          | `/invoice/client/index.html`、`/invoice/invoice_generator/index.js` 回應 404。舊檔已移出 webroot。               |
| 公司主站        | `/` 仍回應 200，兩份既有 Nginx 設定 checksum 未變，服務保持 active。                                             |
| 發票範例        | 兩品項得到銷售額 11,000、稅額 550、總額 11,550。                                                                 |
| 稅額試算        | 含稅 1,050 拆分為銷售額 1,000、稅額 50。                                                                         |
| 公司查詢        | 22099131 取得名稱及地址；帶入發票後保留原來兩個品項。                                                            |
| 複製            | Chrome 複製後實際貼上，讀回兩個品項及 11,000／550／11,550。                                                      |
| PNG             | Chrome 桌面及 390 × 844 手機預覽各實際下載 1360 × 1638 PNG；檢視確認完整品項、日期、金額、大寫與非電子發票標示。 |
| 手機與錯誤      | 390px 的填寫／預覽可切換，頁面 scrollWidth 為 390；兩個正式站測試分頁的 error log 均為空。測試尺寸已還原。       |

公開 HTTPS 檢查使用正常憑證驗證。Python urllib 因本機 CA 設定無法驗證時，改用 macOS 系統 curl；curl 與真實瀏覽器均正常，沒有略過公開站點的 TLS 驗證。

證據：[正式站桌面](design/production-desktop.png)、[正式站桌面 PNG](design/production-export-desktop.png)、[正式站手機 PNG](design/production-export-mobile.png)。本次手機結果是 Chromium 尺寸模擬，未進行實體手機、所有瀏覽器引擎或使用者美術驗收。遠端 CI 未執行，程式檢查結果見[驗證紀錄](VERIFICATION.md)。

### 回復方式

需要回復時，先確認 live 仍指向本紀錄 release，並在本次備份的 `invoice/` 目錄內執行 `sha256sum -c ../OLD-SHA256SUMS` 核對 7 個舊檔。移除的應是 live 符號連結本身，再將上述備份的 `invoice` 目錄移回 `/var/www/html/invoice`。不要刪除 release 內容或其他網站路徑。原始備份回復的是發布前檔案結構，當時 `/invoice/` 回應 403；這不保證舊站入口恢復可用。

本次已驗證備份完整性，未實際演練回復。後續版本若要回到本次正常站點，可建立指向上述 release 的新符號連結並以同檔案系統的 rename 替換 live。

### Jev 結案核對

實際驗證完成後，以最小證據摘要呼叫 Jev：Git 發布、舊站替換、正式站操作三項均回覆 `supported`，信心分別為 0.78／0.97／0.86。Git 項低於其未校準的 0.8 提醒門檻，另以遠端 SHA 回讀完成確認。Jev 僅提供第二意見，沒有自行操作網站或讀取檔案。
