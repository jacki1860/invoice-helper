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

目前版本使用 25 個實際 HTML 頁面，站內以 History API 切換並相容舊 hash，不需要額外 SPA rewrite。Nginx 會將實際目錄導向結尾含 `/` 的網址。

## 2026-09-30 SEO／AEO 版

- 發布時間：**23:23:04 Asia/Taipei**（15:23:04 UTC）。
- 部署來源：`27c019b4bacf35b957def577be4919aff8ce79e7`，已推送 `codex/admin-tools-foundation`，遠端 SHA 回讀一致；main 未更動。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/27c019b4bacf35b957def577be4919aff8ce79e7`。
- 前版保留：`/var/www/invoice-helper/releases/b94d7b36170bf48ae0ef796323091103c53ab2d1`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T152304Z-27c019b4bacf-730719`。
- Manifest：`/var/www/invoice-helper/manifests/27c019b4bacf35b957def577be4919aff8ce79e7.sha256`。

從已提交 Git archive 隔離建置，Node 24.21.0 的 npm ci、149 項測試、lint、格式、TypeScript、公司建置與 SEO 產物檢查通過，31 個公開檔案與已測本機產物逐檔一致。封存包含 25 HTML、sitemap、favicon、紙紋及 3 個資源，不包含 Worker 或原始碼。

部署腳本的精確白名單由五檔擴充為 31 檔，保留部署鎖、tar／manifest／型態與目錄核對、預期前版檢查及同目錄原子 symlink 切換。腳本經獨立撰寫與主代理審查，27 項本機輸入檢查與 origin bash 語法檢查通過；啟用時由 GNU 工具實際驗證。切換後錯誤只在 live 仍指向本版時回復前版；本次未實際演練 rollback。

獨立公開 HTTPS／SSH 驗證於 **23:23:45–23:23:55 Asia/Taipei** 完成：正常 TLS 的 31／31 檔 HTTP 200、SHA-256 一致；25 HTML 以乾淨目錄 URL 取回，無轉址，title／description／canonical／JSON-LD 與 sitemap 25 URL 正確。未知路徑 404，公司首頁 200；新31檔與舊5檔 manifest 均通過，Nginx active、default／common.conf 雜湊不變。

沒有修改公司根目錄 robots 或 Cloudflare 設定。尚未提交 Search Console，HTTP 檢查不代表已收錄。npm ci 仍有 5 項既有開發依賴警示（3 moderate、2 high），npm audit --omit=dev 為 0；入口 534.68 kB 保留大小提示。詳細功能與驗證見 [SEO 說明](SEO.md)。

回復時先確認 live 仍指向本版，核對本次備份的 OLD-SHA256SUMS，再以同目錄 symlink 原子切回上述前版並重做公開驗證。後續文件提交只記錄發布結果，不改變已發布產物。

## 歷史：2026-09-30 二十工具版

- 發布時間：**20:58:32 Asia/Taipei**（12:58:32 UTC）。
- 部署來源：`b94d7b36170bf48ae0ef796323091103c53ab2d1`，已推送 `codex/admin-tools-foundation`，遠端 SHA 回讀一致；main 未更動。後續文件提交只記錄發布結果，不改變正式站產物。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/b94d7b36170bf48ae0ef796323091103c53ab2d1`。
- 前版保留：`/var/www/invoice-helper/releases/89ff50de48efa486243e8f79bd335770b881f49f`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T125831Z-b94d7b36170b-726461`。
- 新 manifest：`/var/www/invoice-helper/manifests/b94d7b36170bf48ae0ef796323091103c53ab2d1.sha256`。

新增費用報支、成本與利潤、驗收／結案、多家報價比較及器材借還，正式站共二十工具。從已提交 Git archive 的獨立目錄執行 Node 24.21.0 的 npm ci、144 項測試、lint、格式、TypeScript 與公司建置，全部通過；五個公開產物與原已測本機產物逐檔雜湊相同。

部署沿用已獨立審查的五檔封存、部署鎖、舊 live 比對、同目錄原子 symlink 替換與失敗條件回復。新舊 manifest、tar、解壓檔案及 origin 位元組核對通過；沒有更改 Nginx、重啟服務或發布 Node／Worker 伺服器。

### 本版正式站驗證

獨立公開 HTTPS／SSH 核對於 **21:00:15–21:00:49 Asia/Taipei** 完成：

- 下列五檔均正常 TLS、HTTP **200**，SHA-256 與本機封存完全一致：`index.html`、`assets/index-DYMNFVR-.js`、`assets/index-B-eMv6A5.css`、`assets/html2canvas-BGKcc9_a.js`、`paper-grain.png`。
- Live 指向本版；前版 89ff50d 的五檔符合本次 `OLD-SHA256SUMS`。Nginx active，default／common.conf 雜湊與切換前一致。第一次以一般 SSH 使用者讀備份紀錄遇權限不足，改用 sudo -n 重新執行相同唯讀檢查後通過。
- 公司首頁 200；舊 `client/index.html`、`invoice_generator/index.js` 仍為 404。
- Chrome 154 實測正式站二十工具入口，五個新工具範例、剪貼簿、PNG 真實下載及列印 PDF 通過；桌面 1440px、手機 390px／320px 無水平溢出，五份 PDF 文字可讀回。首頁及比價 PNG 再次目視，尺寸與頁數詳見[驗證紀錄](VERIFICATION.md)。
- 正式站跨工具確認、取消取代、驗收／來源價格檢查、成本隔離及採購總額守恆通過；報支與借還備份下載、匯入、錯誤結構拒絕和讀檔途中編輯保護亦通過。測試分頁沒有 JavaScript runtime error 或應用程式資源 HTTP 錯誤，favicon 按既有口徑排除。

證據：[二十工具正式站](design/twenty-production-home.png)。此分支沒有遠端 CI 執行紀錄；工作流程只監聽 main push 及 pull request。本機檢查不稱為遠端 CI。實體手機、多瀏覽器引擎與實體印表機未涵蓋。

### 依賴、回復與第二意見

npm ci 仍有五項既有開發依賴警示（3 moderate、2 high），npm audit --omit=dev 為 0；未更改依賴或 lockfile，只發布五個靜態檔。Vite 的入口約 505.36 kB／gzip 138.01 kB，保留非阻擋大小提示。

需回復時，先確認 live 仍指向本版，於前版目錄依本次 `OLD-SHA256SUMS` 核對，再建立同目錄臨時 symlink 指向 89ff50d，以 `mv -Tf` 替換 live，最後做公開 HTTPS 與工具驗證。前版已保留並校驗，未演練故障回復。

實測後 Jev 三項皆選 supported：Git／公開發布／正式站操作信心為 **0.93／0.86／0.51**。操作項觸發未校準注意門檻，未提供具體反例；主流程已核對實際正式站腳本結果、下載檔及 PDF 讀回，不擴大為所有情境通過，也不將 Jev 摘要當成獨立實測。

## 歷史：2026-09-30 十五工具版

- 發布時間：**20:18:01 Asia/Taipei**（12:18:01 UTC）。
- 部署來源：`89ff50de48efa486243e8f79bd335770b881f49f`，已推送 `codex/admin-tools-foundation`，遠端 SHA 回讀一致；`main` 未更動。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/89ff50de48efa486243e8f79bd335770b881f49f`。
- 前版保留：`/var/www/invoice-helper/releases/b6d17eb24f67214ba43469cdb2277351567d3730`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T121800Z-89ff50de48ef-725028`。
- 新 manifest：`/var/www/invoice-helper/manifests/89ff50de48efa486243e8f79bd335770b881f49f.sha256`。

新增收據、採購單、送貨／簽收單、收款進度與工作天／交期。部署前 Node 24 的 `npm ci`、101 項測試、lint、格式與公司建置通過。程式、文案及版面依本站既有設計獨立實作；官方來源與限制見[行政工具來源](research/admin-tools-sources.md)。

封存僅含五個允許的普通檔案，manifest、逐檔及 tar SHA-256 已核對。部署腳本經獨立唯讀審查，具部署鎖、舊 live 比對、同目錄原子 symlink 替換與驗證失敗時的條件回復；切換前後 origin 位元組比對均通過。沒有改 Nginx、重新啟動服務或部署 Node／Worker 伺服器。

### 本版正式站驗證

- 獨立公開 HTTPS 核對：以下五檔全部 **200**、正常 TLS，SHA-256 與本機封存一致：
  - `index.html`
  - `assets/index-BVRi9k5x.js`
  - `assets/index-B-mBZuLx.css`
  - `assets/html2canvas-Bv4z6KOT.js`
  - `paper-grain.png`
- SSH：live 正確，遠端新檔 5/5 hash 通過；前版 b6d17eb 的五檔及舊 manifest 仍完整。Nginx `active`，default／common.conf 的 hash 與發布前一致。
- 公司首頁及 `/invoice/` 為 200；舊 `client/index.html`、`invoice_generator/index.js` 仍為 404。
- Chrome 154：總覽十五工具；三種新文件的範例、複製讀回及 PNG 真實下載通過，逐張檢視完整；送貨 PNG 另在 390px 下載。
- 收款 12,000 → 實收 3,000 → 餘額 9,000，主動啟用保存後重新整理還原，單筆收據只帶入 3,000。工作天全年 245、跨年交期 2027-01-04。原公司查詢／帶入發票、2027 ICS 下載 24 個事件亦通過；測試分頁沒有 JavaScript runtime error。

證據：[十五工具正式站](design/admin-production-home.png)。輸出尺寸、本機儲存衝突及錯誤狀態的完整測試見[驗證紀錄](VERIFICATION.md)。實體手機、多瀏覽器引擎、實體印表機與美術接受度未涵蓋。本輪分支未觸發遠端 CI：工作流程僅監聽 `main` push 及 pull request，`gh run list` 回讀此分支為空；不將本機檢查稱作遠端 CI。

### 依賴稽核與回復

`npm ci` 顯示五項既有開發依賴警示（3 moderate、2 high），涉及 PostCSS 的 nanoid、Cloudflare 開發工具鏈的 undici 及相依包；`npm explain` 確認為 dev 相依，`npm audit --omit=dev` 為 0。本輪沒有改動依賴版本；正式站只使用上述靜態產物，不包含 `node_modules` 或 Worker。這不表示整個開發工具鏈沒有弱點，依賴更新需另做版本與建置驗證。

需回復時，先確認 live 仍指向本版，並在前版目錄以本次紀錄的 `OLD-SHA256SUMS` 校驗；建立同目錄臨時 symlink 指向前版，以 `mv -Tf` 取代 live，再做公開 HTTPS 與工具驗證。本次保留並校驗了前版，未演練故障回復。

實際驗證後 Jev 四項皆選 `supported`：Git／部署／正式站操作／依賴界線信心為 **0.99／0.99／0.84／0.65**。依賴項低於未校準提醒門檻，沒有附具體反例；主流程已對照 npm audit、npm explain 與僅五個靜態檔案的封存清單，保留五項 dev 警示，不宣稱整體稽核零弱點。Jev 是證據摘要第二意見，沒有自行操作網站或主機。

## 歷史：2026-09-30 文件 Logo

- 發布時間：**19:51:52 Asia/Taipei**（11:51:52 UTC）。
- 部署來源：`b6d17eb24f67214ba43469cdb2277351567d3730`，已推送至 `codex/admin-tools-foundation`。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/b6d17eb24f67214ba43469cdb2277351567d3730`。
- 前版保留：`/var/www/invoice-helper/releases/69e93d568e7313f6faadc8a0c607cbe4a3f6daf5`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T115152Z-b6d17eb24f67-723863`。
- 新 manifest：`/var/www/invoice-helper/manifests/b6d17eb24f67214ba43469cdb2277351567d3730.sha256`。

報價與請款單加入本機 Logo 選圖、更換與移除。發布來源版本的 69 項測試、lint、格式、TypeScript、公司建置及瀏覽器 PNG／PDF 檢查通過；實測結果見[驗證紀錄](VERIFICATION.md)。

新舊檔案 SHA-256 及 origin 位元組比對通過；公開 HTTPS 五個檔案均 200，正常 TLS，雜湊與本次封存 manifest 一致。Nginx active、兩份設定雜湊不變，未改其他站點。正式站實際選入透明 PNG，預覽原圖 800 × 240、顯示 135.04 × 40.51，error log 為空。[正式站畫面](design/logo-production.png)。回復時核對 live 與前版 manifest，再依既有 symlink 替換流程切回本節前版；未演練回復。

發布期間共用工作區出現其他工具的進行中變更，保留原狀，未納入本次 Logo 提交或已封存建置；本紀錄不宣稱整個工作區乾淨。

Jev 結案三項皆選 `supported`，behavior／outputs／release 信心為 0.92／0.29／0.45；後兩項觸發未校準提醒門檻。主流程核對實際 PNG、PDF 渲染、正式站選圖及五檔雜湊，未找到具體矛盾；保留低信心結果，不視為 Jev 獨立驗證。未測實體手機、實體印表機及所有瀏覽器引擎。

## 歷史：2026-09-30 文件聯絡與自訂欄位

- 發布時間：**19:27:16 Asia/Taipei**（11:27:16 UTC）。
- 部署來源：`69e93d568e7313f6faadc8a0c607cbe4a3f6daf5`，已推送至 `codex/admin-tools-foundation`。
- Live：`/var/www/html/invoice` → `/var/www/invoice-helper/releases/69e93d568e7313f6faadc8a0c607cbe4a3f6daf5`。
- 前版保留：`/var/www/invoice-helper/releases/a8350fbb42a4af7e1298de07d9d30ef114ef4a93`。
- 發布紀錄：`/var/backups/invoice-helper/20260930T112716Z-69e93d568e73-722901`。
- 新 manifest：`/var/www/invoice-helper/manifests/69e93d568e7313f6faadc8a0c607cbe4a3f6daf5.sha256`。

報價與請款單將聯絡資訊拆成電話與信箱，新增多筆自訂名稱／內容欄位。66 項測試、lint、格式、型別與公司建置通過；Chrome 實際複製、下載 PNG、PDF 列印引擎與 320px 排版結果見[驗證紀錄](VERIFICATION.md)。

切換腳本成功完成，新舊 release 逐檔雜湊與 origin 位元組核對通過；正常 TLS 的公開 HTTPS 五檔均回應 200，SHA-256 與本機建置一致。Nginx active、兩份設定雜湊不變，未改其他網站。正式站瀏覽器已填入範例電話、信箱及兩行地址，讀回預覽一致；error log 為空。[正式站畫面](design/custom-fields-production.png)。

回復方式沿用下方十工具版紀錄的條件核對與同目錄 symlink 替換，目標為本節所列前版；本次未實際演練回復。

實際驗證後 Jev 三項均選 `supported`：fields／outputs／release 信心分別 0.75／0.78／0.97。前兩項低於其未校準提醒門檻；主流程核對已執行的測試、瀏覽器文字讀回與實際輸出，未發現具體矛盾。這是第二意見，不是 Jev 自行操作瀏覽器或伺服器的結果。未測實體手機、實體印表機與所有瀏覽器引擎。

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
