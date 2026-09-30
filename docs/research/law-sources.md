# 法規索引與官方公告來源

核對日期：2026-09-30。這份紀錄說明目前可實作的資料取得方式與限制，不是法律解釋。前端只保存名稱、官方連結、日期、分類與少量公告標題，不複製法規全文。

## 來源與可取得內容

| 來源                   | 已驗證入口                                                                                                   | 用途與限制                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 全國法規資料庫         | [首頁](https://law.moj.gov.tw/)、[最新訊息](https://law.moj.gov.tw/News/NewsList.aspx?type=all)              | 法律與命令全文、沿革、最新訊息。首頁標示整編截止 2026-09-18；最新訊息另有 2026-09-30 公告，兩者不可混用。                                  |
| 全國法規官方 API       | [Swagger](https://law.moj.gov.tw/api/swagger/index.html)、[定義](https://law.moj.gov.tw/api/swagger/docs/v1) | 提供中英文法律、命令的 JSON/XML ZIP 批次下載；本次實際下載中文法律及命令成功，不需金鑰。沒有在此 API 定義中發現關鍵字搜尋或最新公告 feed。 |
| 勞動部法令查詢系統     | [首頁最新動態](https://laws.mol.gov.tw/)                                                                     | 表格欄位為「公發布日、類別、訊息摘要」，含法規草案；首頁只取第一頁，不代表完整異動清單。                                                   |
| 財政部主管法規查詢系統 | [首頁最新法規](https://law-out.mof.gov.tw/)                                                                  | 表格欄位為「資料日期、主旨、法規類別」，連結可能指向行政院公報或公共政策網路參與平臺。資料日期不等於生效日。                               |
| 財政部一般新聞 RSS     | [RSS 入口](https://www.mof.gov.tw/Rss)                                                                       | 有可讀取的一般新聞 feed，但內容包含部會新聞，不能當作完整法規異動 feed。這次不使用。                                                       |

全國法規 API 端點：`/api/ch/law/json` 與 `/api/ch/order/json`，均回傳 ZIP。2026-09-30 下載的 `ChLaw.json` 有 1,347 筆、`ChOrder.json` 有 10,451 筆，檔內 `UpdateDate` 為 `2026/9/18`。已查得欄位包含 `LawName`、`LawURL`、`LawModifiedDate`、`LawEffectiveDate`、`LawEffectiveNote`、`LawAbandonNote`。`LawEffectiveDate` 可為空值或 `99991231`；不能直接格式化後當作施行日。所得稅法頁面另明示部分或全部條文尚未生效。

[全國法規更新說明](https://law.moj.gov.tw/Service/refresh.aspx)區分最新訊息與中央法規整編週期。現有頁面可讀取，但未取得承諾此 HTML 格式穩定的機關規格，也未驗證瀏覽器 CORS，因此採建置前人工執行的更新腳本，不由訪客瀏覽器跨站抓取。

## 官方搜尋

全國法規首頁的熱門法規連結實際導向：

`https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw=勞基法&sSearch=`

另以「所得稅法」實測可回傳查詢結果。前端使用 GET 表單，欄位 `ty=ONEBAR`、`kw=使用者關鍵字`、`sSearch=`，由瀏覽器編碼並在新分頁開啟官方搜尋；無結果入口以 `URLSearchParams` 建構相同 URL。本站搜尋只篩選 14 部核心法規的名稱、簡稱與主題，不稱為完整法規全文搜尋。

財政部首頁程式提供 `SearchAllResultList.aspx?KW=` 關鍵字搜尋，已驗證可取得「統一發票」結果。勞動部搜尋使用 ASP.NET 表單與狀態欄位，這次未建立或臆造直達查詢參數；保留官方首頁入口即可。

## 14 部核心法規

以下官方 URL 均逐一取得 HTTP 200 並核對頁面法規名稱與日期。全國法規 URL 取自官方 API 的 `LawURL`；財政部電子發票要點取自該機關法規頁。

| 分類     | 法規                                                                                   | 官方頁面日期                        |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------- |
| 勞動     | [勞動基準法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001)               | 修正 2024-07-31                     |
| 勞動     | [勞動基準法施行細則](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030002)       | 修正 2024-03-27                     |
| 勞動     | [性別平等工作法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030014)           | 修正 2023-08-16                     |
| 勞健保   | [勞工保險條例](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001)             | 修正 2026-01-21                     |
| 勞健保   | [就業保險法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050021)               | 修正 2022-01-12                     |
| 勞健保   | [勞工退休金條例](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020)           | 修正 2019-05-15                     |
| 勞健保   | [勞工職業災害保險及保護法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050031) | 公布 2021-04-30                     |
| 勞健保   | [全民健康保險法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0060001)           | 修正 2023-06-28                     |
| 稅務     | [所得稅法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340003)                 | 修正 2026-09-11；官方有尚未生效提示 |
| 稅務     | [加值型及非加值型營業稅法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340080) | 修正 2025-05-28                     |
| 稅務     | [統一發票使用辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340082)         | 修正 2024-12-12                     |
| 稅務     | [電子發票實施作業要點](https://law-out.mof.gov.tw/LawContent.aspx?id=FL041411)         | 修正 2026-04-22                     |
| 公司行政 | [公司法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0080001)                   | 修正 2025-12-26                     |
| 公司行政 | [商業登記法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0080004)               | 修正 2025-12-26                     |

## 更新與驗證方式

使用 Node 24 以上及系統 `curl` 執行：

```sh
node scripts/refresh-laws.mjs
node --test tests/laws.test.ts
npx oxfmt src/data/laws.ts
```

腳本逐一核對核心法規名稱及日期，讀取全國法規整編截止日，再讀取上述三個最新公告首頁。全國法規公告按勞動、勞工、就業、保險、稅、公司、商業、發票或產業創新等標題關鍵字篩選；各來源最多保留三筆。勞動部及財政部首頁本身已限定主管領域。此選擇不是法規完整涵蓋性判斷。

任一取得、法規名稱、日期或公告格式檢查失敗，整次中止並保留原資料。成功後一次寫入 `src/data/laws.ts`，保留原本的分類與簡稱，只更新來源 metadata、公告與實際核對時間。連結僅接受 HTTPS 與已驗證的機關網域。沒有建立排程；每次發布前須執行更新並檢查 diff，未更新時頁面會繼續顯示原核對日期。

公告日期沿用各來源欄名，草案／預告明確標示。生效資訊回到原文確認；例：財政部 2026-09-24 公告可包含 2026-10-01 起實施事項，也可包含追溯至 2026-01-30 生效事項，不能使用公告日期代替生效日期。更新腳本不自行推論。

依[全國法規資料庫著作權聲明](https://law.moj.gov.tw/Service/Copyright.aspx)與各機關頁尾授權標示，資料索引保留機關名稱、來源連結及核對時間。頁面不暗示機關背書。完整法律適用、最新公報及正式條文仍以機關來源為準。
