# 公司網站部署

目標：[https://www.ctrls.com.tw/invoice/](https://www.ctrls.com.tw/invoice/)。使用既有公司 SSH 設定與 Nginx 靜態檔案服務。

## 建置與發布方式

1. 使用 Node 24，執行 `npm ci`、`npm run build:company`。
2. 核對 `dist/client/index.html` 的 JS／CSS URL 以 `/invoice/assets/` 開頭；紙紋 URL 為 `/invoice/paper-grain.png`。
3. 只上傳 `dist/client/` 的公開產物。不要上傳原始碼、Worker 目錄、設定檔或整個 `dist/`。
4. 新內容先放到 `/var/www/invoice-helper/releases/<commit>/`，對照逐檔 SHA-256。
5. 首次發布若 live 是實體目錄，先移到 webroot 外備份；後續發布保留上一個 release，記錄並核對舊 live 連結、manifest 與 Nginx 設定雜湊。
6. 將新符號連結建在 `/var/www/html/`，以 `mv -Tf` 原子替換 `/var/www/html/invoice`。切換前再次確認 live 仍指向預期舊版。
7. 驗證公開首頁、JS、CSS、紙紋、動態匯出 chunk，以及工具操作、公司查詢、複製和實際匯出。需要回復時，只切回上一個已驗證 release；不修改其他站點。

路由採 hash，不需要伺服器端應用程式或額外 SPA rewrite。既有 Nginx 會將實際目錄的 `/invoice` 導向 `/invoice/`。

## 歷史：2026-09-30 共用聯絡頁尾

- 發布時間：**19:17:18 Asia/Taipei**（11:17:18 UTC）。
- 部署來源：`a8350fbb42a4af7e1298de07d9d30ef114ef4a93`。
- 當次 Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/a8350fbb42a4af7e1298de07d9d30ef114ef4a93`。
- 前版保留於 `/var/www/invoice-helper/releases/68b1026a31367754d36446a647edaa14c39ae10d`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T111718Z-a8350fbb42a4-722373`。

本版在總覽、四分類與十工具共 15 頁加入共用頁尾。「聯絡開發者」與「許願新功能」均使用 `mailto:jacki1860@gmail.com`，預填不同主旨及內容提示。部署前 `npm run lint`、`npm run format:check`、64 項測試及 `npm run build:company` 通過。

| 檢查       | 已驗證結果                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| 公開 HTTPS | 五個公開檔案均回應 200，SHA-256 與本機產物一致。                                   |
| 伺服器     | 當次 Live 指向上述 release，Nginx 為 active，設定檔 SHA-256 不變。                 |
| 頁尾與連結 | 15 頁可找到兩個入口；瀏覽器讀回並解碼 mailto URI，收件者、不同主旨及內容提示正確。 |
| 排版與列印 | 桌面及 320px viewport 無水平溢出；列印模式的頁尾 CSS 為 `display: none`。          |

證據：[正式站聯絡頁尾](design/contact-production.png)。320px 為瀏覽器尺寸模擬；本次未打開郵件客戶端、未寄出郵件，也未進行實體手機驗證。這份紀錄保留本次已完成部署的狀態，後續發布另列版本，不以此推定目前 Live。

## 歷史：2026-09-30 十工具公開版

- 發布時間：**18:45:57 Asia/Taipei**（10:45:57 UTC）。
- 部署來源：`68b1026a31367754d36446a647edaa14c39ae10d`，已推送 `codex/admin-tools-foundation`，遠端 SHA 回讀一致；`main` 未更動。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/68b1026a31367754d36446a647edaa14c39ae10d`。
- 上一版保留於 `/var/www/invoice-helper/releases/562ae00c1eab4357def3a52f066f708d953f94d7`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T104557Z-68b1026a3136-721244`，含新舊連結、逐檔 manifest、tar 與設定雜湊。
- 新 manifest：`/var/www/invoice-helper/manifests/68b1026a31367754d36446a647edaa14c39ae10d.sha256`。

切換腳本經主流程及獨立代理檢查，限制為五個公開檔案、核對上傳與解壓後雜湊，對新舊版本執行 origin 位元組比對。切換使用同目錄 symlink rename，保留錯誤時僅在 live 仍指向本版才可回復的條件。沒有更動 Nginx 設定、重新啟動服務或修改其他站點；未實際演練 rollback。

### 本版正式站驗證

獨立唯讀核對於 **18:47:32 Asia/Taipei** 完成：

| 項目         | 結果                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 公開 HTTPS   | `index.html`、`index-DS3N4LMg.js`、`index-DPA-YpoR.css`、`html2canvas-efe5BClf.js`、`paper-grain.png` 五檔均 200；正常 TLS，SHA-256 與本機及 manifest 一致。 |
| 舊路徑與主站 | 舊 `client/index.html`、`invoice_generator/index.js` 均 404；公司首頁 `/` 為 200。                                                                           |
| 伺服器       | Live 指向本版，Nginx active，default／common.conf 雜湊與前版一致。                                                                                           |
| 頁首與首頁   | 四大分類、十工具與正確支持連結可見；咖啡按鈕顏色 `rgb(231,100,53)` 與網站 `#e76435` 一致。                                                                   |
| 發票／公司   | 範例 11,000 + 550 = 11,550；公開統編查詢取得名稱、地址，帶入發票保留原品項與金額。                                                                           |
| 級距／法規   | 月薪 30,000 的勞保查表結果 30,300；所得稅法搜尋取得一筆，保留官方尚未生效提示。                                                                              |
| 文件輸出     | 正式站 Chrome 真正下載 1360 × 1760 報價 PNG，圖像包含兩品項與 11,550，已開啟檢視。                                                                           |
| 日曆輸出     | 正式站下載 2027 ICS：10,139 bytes、24 事件，CRLF／UTF-8 folding 與跨年 DTEND 讀回正確。                                                                      |
| 瀏覽器錯誤   | 正式站兩個測試分頁的 error log 為空。                                                                                                                        |

證據：[正式站十工具首頁](design/public-tools-production.png)、[正式站報價 PNG](design/public-quote-production.png)。本機 64 項測試、390／320px 與 PDF 等詳細結果見[驗證紀錄](VERIFICATION.md)。資料為有日期的官方快照，由維護者人工刷新；沒有即時同步、背景排程或自動發布。

### 本版回復與 Jev 核對

回復時先確認 live 仍指向本版，並用發布紀錄內的 `OLD-SHA256SUMS` 在上一版 release 核對檔案；建立指向上一版的臨時連結，以同目錄 `mv -Tf` 替換 live，然後重做公開 HTTPS 與工具檢查。保留兩版 release，不回到首版部署前的錯誤目錄結構。

實際驗證後呼叫 Jev：implementation／official_data／ui_outputs／release 皆選 `supported`，信心為 0.35／0.81／0.93／0.59；前後兩項觸發其未校準的低信心提醒。主流程核對 64 項測試、瀏覽器證據及遠端 SHA／正式檔案雜湊後，未找到具體矛盾；保留提醒，不將其稱為獨立驗證通過。Jev 沒有操作瀏覽器或伺服器。遠端 CI、真實行事曆帳號匯入、實體手機與美術接受度不在已驗證範圍。

## 歷史：2026-09-30 首版發布前檢查

- 使用者明確授權 commit、push、部署至上述網址，並取代舊內容。
- 公司主機與 SSH 身分已現場核對，Nginx 正常執行；本次不更動其他站點設定。
- 舊站回應 403；舊產物的入口位於 `invoice/client/index.html`，沒有放在網站根目錄。
- 專用建置、lint、格式檢查通過；已確認 Vite 正確改寫子目錄資源路徑。

## 歷史：2026-09-30 三工具首版發布結果

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
