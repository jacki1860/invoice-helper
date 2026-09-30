# 來源與獨立開發歷程

紀錄日期：2026-09-30（Asia/Taipei）。本紀錄保留來源與同步邊界，不代表已部署或完成新版產品驗收。

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

同步後已在本機實作「小事務」三工具介面、共用計算核心與已知 bug 修復，本輪瀏覽器與程式驗證已完成，詳見[驗證紀錄](VERIFICATION.md)。這些本機變更不代表已推送或部署，也不構成完整稅務合規驗證。

## 已完成的獨立化

- GitHub 倉庫沿用 [jacki1860/invoice-helper](https://github.com/jacki1860/invoice-helper)，沒有以新名稱取代。
- 使用者完成 GitHub sudo 驗證後，API 已回傳 `fork: false`、`parent: null`、`source: null`，確認 fork 關係解除。
- GitHub homepage 已清空原作者的部署網址，尚未填入自己的正式站點。
- 本機 `upstream` remote 已移除，`origin` 指向自己的倉庫；來源仍保留在本文件和 Git 歷史。
- 後續以自己的產品計畫發展；若再次引用原作者變更，應另外記錄來源 SHA 與整合範圍。

## 授權與發布邊界

原始程式採 [MIT License](../LICENSE)，包含 `Copyright (c) 2025 Kaik, Inc.`。獨立開發不移除原授權文字、版權聲明或既有提交歷史；散布原始碼或其實質部分時仍須保留授權要求的聲明。

「小事務」是本輪暫定產品名，與 GitHub 倉庫名稱分開管理。原作者的專案網址或範例部署網址均不代表本專案部署。本輪截至此紀錄尚未部署；後續應分別記錄程式驗證、遠端發布與線上操作驗收。
