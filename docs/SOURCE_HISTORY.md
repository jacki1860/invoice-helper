# 來源與獨立開發歷程

紀錄日期：2026-09-30（Asia/Taipei）。本紀錄分別記載來源同步、獨立開發、Git 推送與公司網站部署；技術發布不等同全部產品驗收完成。

## 來源與同步

| 項目             | 紀錄                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| 原始專案         | [kaikhq/invoice-helper](https://github.com/kaikhq/invoice-helper)                      |
| 最後同步上游提交 | `ddc0554890bb6bceb079b2b30f745001468112f7`                                             |
| 同步日期         | 2026-09-30（Asia/Taipei）                                                              |
| 同步前自己的提交 | `cdcd19c74ae58630cdf8a7c838819c17a488b148`，包含多品項功能                             |
| 合併提交         | `63ac7fd43cf654fc07117c4f2f0640fe216b16dd`                                             |
| 合併父提交       | `cdcd19c74ae58630cdf8a7c838819c17a488b148`、`ddc0554890bb6bceb079b2b30f745001468112f7` |
| 本機備份分支     | `codex/baseline-before-upstream-20260930`                                              |
| 本輪開發分支     | `codex/admin-tools-foundation`                                                         |

此次合併帶入上游 React 19、Vite 8、TypeScript 7、Tailwind CSS 4 工具鏈與 CI 設定，並保留自己的多品項功能。合併完成與 CI 設定存在，不代表所有檢查已通過；實際驗證成果由本輪實作紀錄另行補充。

同步後已實作「小事務」三工具介面、共用計算核心與已知 bug 修復，本輪本機瀏覽器與程式驗證已完成，詳見[驗證紀錄](VERIFICATION.md)。後續依使用者授權完成下列推送與部署，仍不構成完整稅務合規驗證。

## 已完成的獨立化

- GitHub 倉庫沿用 [jacki1860/invoice-helper](https://github.com/jacki1860/invoice-helper)，沒有以新名稱取代。
- 使用者完成 GitHub sudo 驗證後，API 已回傳 `fork: false`、`parent: null`、`source: null`，確認 fork 關係解除。
- GitHub homepage 已清空原作者的部署網址，目前仍為空白；本次部署未更動該欄位。
- 本機 `upstream` remote 已移除，`origin` 指向自己的倉庫；來源仍保留在本文件和 Git 歷史。
- 後續以自己的產品計畫發展；若再次引用原作者變更，應另外記錄來源 SHA 與整合範圍。

## 授權與發布邊界

原始程式採 [MIT License](../LICENSE)，包含 `Copyright (c) 2025 Kaik, Inc.`。獨立開發不移除原授權文字、版權聲明或既有提交歷史；散布原始碼或其實質部分時仍須保留授權要求的聲明。

「小事務」是本輪暫定產品名，與 GitHub 倉庫名稱分開管理。原作者的專案網址或範例部署網址均不代表本專案部署。

## 2026-09-30 三工具首版推送與部署

使用者已授權 commit、push，並透過公司 SSH 部署及取代舊內容。

| 項目         | 紀錄                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 已推送分支   | `codex/admin-tools-foundation`；`main` 未更動                                                                                             |
| 部署來源提交 | [`562ae00c1eab4357def3a52f066f708d953f94d7`](https://github.com/jacki1860/invoice-helper/commit/562ae00c1eab4357def3a52f066f708d953f94d7) |
| 正式網址     | [https://www.ctrls.com.tw/invoice/](https://www.ctrls.com.tw/invoice/)                                                                    |
| 部署時間     | 2026-09-30 17:54:53（Asia/Taipei）                                                                                                        |
| 技術檢查     | 獨立 HTTP／SSH 核對通過：5 個發布檔回應 200 且雜湊一致；舊產物入口回應 404；主站根目錄回應 200；Nginx 設定未更動；7 個舊檔已備份。        |
| 操作驗收     | 正式站三工具、公司查詢、複製及桌面／手機尺寸 PNG 已實際檢查；證據見部署紀錄。                                                             |

發布方式、備份與回復流程見[部署紀錄](DEPLOYMENT.md)；本機與正式站的驗證範圍見[驗證紀錄](VERIFICATION.md)。

## 2026-09-30 十工具公開版

後續公開工具擴充提交 [`68b1026a31367754d36446a647edaa14c39ae10d`](https://github.com/jacki1860/invoice-helper/commit/68b1026a31367754d36446a647edaa14c39ae10d) 已推送同一分支，於 18:45:57（Asia/Taipei）部署至相同 `/invoice/` 網址。加入報價／請款、款項與工時計算、日期／金額轉換、官方級距、法規、日曆與網站配色的支持連結。上一版 release 保留可回復；授權文字與來源歷史未更動。64 項測試、建置及本版正式站證據見[驗證紀錄](VERIFICATION.md)與[部署紀錄](DEPLOYMENT.md)。

## 2026-09-30 五項行政工具擴充與發布

新增收據、採購單、送貨／簽收單、收款進度與工作天／交期。本輪以通用商務需求自行實作程式、文案及版面，延用本站既有計算核心與紙感設計；未複製競品程式碼、文案、範本或視覺素材。收據法律適用說明及工作天資料使用已核對的官方來源，詳見[來源與適用範圍](research/admin-tools-sources.md)。

本輪經使用者授權後，以 `89ff50de48efa486243e8f79bd335770b881f49f` 提交並推送 `codex/admin-tools-foundation`，於 2026-09-30 20:18:01（Asia/Taipei）發布至公司 `/invoice/`；`main` 未更動。正式站與回復路徑見[部署紀錄](DEPLOYMENT.md)，本機及正式站證據見[驗證紀錄](VERIFICATION.md)。原始 MIT 授權及來源記錄繼續保留。

## 2026-09-30 第二批五工具與二十工具版發布

新增費用報支、成本與利潤、驗收／結案、多家報價比較及器材借還；沿用本站紙感元件並獨立實作計算、文件、備份與跨工具確認流程。參考與產品規則見[報支／借還](research/expense-equipment-sources.md)、[驗收](research/acceptance-sources.md)、[成本／比價](research/profit-comparison-sources.md)，未複製競品程式碼、文案或素材。

使用者授權 commit、push、部署後，以 `b94d7b36170bf48ae0ef796323091103c53ab2d1` 推送 `codex/admin-tools-foundation`，於 2026-09-30 20:58:32（Asia/Taipei）發布至原公司網址；main 未更動。144 項測試及正式站五工具、輸出、備份與交接流程通過，前版十五工具 release 保留。發布紀錄與驗證界線見[部署紀錄](DEPLOYMENT.md)和[驗證紀錄](VERIFICATION.md)。原始 MIT 授權及來源歷史繼續保留。
