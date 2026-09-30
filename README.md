# 小事務 · everyday admin

公開免登入的發票與公司行政工具，服務自由工作者與小公司。以暖白紙張、墨黑文字與橘色操作組成工作桌，打開即可填寫、試算或查詢。

「小事務」是暫定產品名，倉庫沿用 `invoice-helper`。本機新版已實作並完成本輪程式與瀏覽器驗證；尚未推送或部署，證據與限制見[驗證紀錄](docs/VERIFICATION.md)。

## 三個工具

| 工具     | 功能                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 發票助手 | 買受人、統編與日期；多品項新增、編輯、刪除及最近一次刪除復原；含稅／未稅輸入；即時三聯式預覽、中文大寫金額、PNG 下載與複製明細。 |
| 稅額試算 | 含稅／未稅金額拆分，支援一般、零稅率與免稅模式，複製結果；與發票助手共用計算核心。                                               |
| 公司查詢 | 以 8 位數統編查詢名稱及地址；複製資料、帶入發票；提供查無、逾時及服務失敗提示。                                                  |

發票助手提供「載入範例」；已有內容時會先確認是否取代。桌面版並排編輯與預覽，手機版可切換「填寫／預覽」。介面提供鍵盤焦點、操作結果提示與減少動態效果支援。

含稅／未稅切換會以目前單價重新計算，**不會自動換算或改寫單價**。本工具的試算與預覽僅供填寫參考，PNG **非正式電子發票**，下載不等於完成開立、傳輸或申報。

## 資料如何處理

- 表單與查詢結果只留在本次頁面的記憶體；切換工具仍可保留，重新整理或關閉頁面後不保留當次修改。沒有自動保存、帳號或雲端同步。
- 計算、PNG 產生及複製明細在本機瀏覽器執行，不為這些操作上傳發票內容。
- 公司查詢會將 **8 位數統編**傳至第三方[台灣公司資料](https://company.g0v.ronny.tw/)，不傳送發票品項或金額。查詢結果可至[經濟部商工登記公示資料查詢](https://findbiz.nat.gov.tw/)核對。
- 相容既有 URL 預填參數：`uniformNumber`、`amount`、`itemName`、`date`。網址中的資料可能出現在歷史紀錄或分享內容中；不要把私密交易內容當成網址保存。重新整理帶有預填參數的網址，會再次載入那些參數。

報價單、本機草稿與範本屬後續計畫；帳號及雲端服務另行評估，詳見[產品計畫](docs/PRODUCT_PLAN.md)。

## 本機開發

使用 **Node.js 24** 與 npm；版本記錄於 `.nvmrc`。使用 nvm 時可先執行 `nvm install`、`nvm use`。

```bash
npm ci
npm run dev
```

開啟終端顯示的本機網址。工具鏈為 React 19、TypeScript 7、Vite 8、Tailwind CSS 4；Cloudflare Vite plugin 與 Wrangler 用於現有執行環境設定。

## 檢查與建置

```bash
npm run lint
npm run format:check
npm test
npm run build
```

`build` 先執行 TypeScript 檢查，再產生 Vite 建置產物。測試涵蓋金額計算、日期／中文金額與公司查詢；瀏覽器操作及 PNG 外觀仍須另行驗證。

| 指令                   | 用途                                |
| ---------------------- | ----------------------------------- |
| `npm run format`       | 使用 oxfmt 格式化檔案，會修改檔案。 |
| `npm run format:check` | 檢查格式，不修改檔案。              |
| `npm run preview`      | 重新建置並啟動本機預覽。            |

倉庫保留 Cloudflare 部署設定，但目前尚未部署。實際發布前須確認自己的目標環境與設定，不能將原作者的範例網址當成自己的正式站點。

## 設計與開發紀錄

- [產品計畫與階段驗收](docs/PRODUCT_PLAN.md)
- [本機驗證與設計對照](docs/VERIFICATION.md)
- [來源同步與獨立開發歷程](docs/SOURCE_HISTORY.md)
- [紙感工作桌設計規格](docs/design/DESIGN.md)
- [已確認的介面概念圖](docs/design/desk-concept.png)

## 來源與授權

本專案源自 [kaikhq/invoice-helper](https://github.com/kaikhq/invoice-helper)，同步指定上游版本後，於 [jacki1860/invoice-helper](https://github.com/jacki1860/invoice-helper) 獨立開發。來源提交與分離紀錄見[來源歷程](docs/SOURCE_HISTORY.md)。

沿用 [MIT License](LICENSE)，保留原始 `Copyright (c) 2025 Kaik, Inc.` 與授權文字。感謝原作者及[台灣公司資料](https://company.g0v.ronny.tw/)提供的基礎與查詢服務。
