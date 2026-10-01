# 每日新功能與持續改善

## 目標與目前狀態

每天台北時間 09:00 由本機 Codex 排程開始一輪工作，目標為新增一項可驗收的新能力，同時修復問題與改善既有功能。功能可擴充既有工具，不必增加獨立工具；修 bug、文件、重構與測試不能充作新功能。沒有通過驗證時記錄延後，不能用未驗證的發布補足數量。

目前是工程基礎提案，**尚未開放自動合併或正式部署**。2026-10-01 查驗時，產品分支 `codex/admin-tools-foundation` 在 `32fc700212cef9b7ccd17ce6880fddde5297c0da`，領先 `main` 61 個提交；`main` 尚未保護、auto-merge 未啟用。這些是當時觀察，開工必須重新查驗。既有 61 個提交不因本提案而自動通過審查。

本次 PR 以現有產品分支為 base，只包含新工程基礎；同日新功能以同一基準另開 PR。建議暫以產品分支作正式基準，先由維護者確認這個選擇及基準 SHA，再套用保護。後續若要把產品分支提升為 `main`，需獨立檢視該批差異，不在此 PR 隱含執行。

## 一輪工作

1. 讀最新使用者決策與專案規則，取得整輪工作鎖；以台北日期記錄 run key，重新確認 GitHub PR、分支、未結案工作及正式站版本。
2. 選一項有使用情境的新功能，先寫 1–3 條驗收；改善另列。以獨立 worktree 開工，保留其他人的變更。
3. 先延續仍可推進的功能 PR。只剩等使用者核准者保留，另選不依賴它的一般功能，不堆疊未核准差異；同日重跑恢復已有工作，不重建 PR 或重算交付。
4. 執行相稱的驗收、回歸與下列必要檢查，再 commit、push、建立 PR。測試有失敗先分析證據，有可驗證的新方向才繼續。
5. 由未撰寫該變更的 AI 獨立審查最新版本；修正後更新證據。Jev 是第二意見，不能取代測試、獨立審查或 GitHub 正式核准。
6. 工程基礎獲准並驗證後，一般功能才可在必要門檻全數通過時合併與發布。發布同一份可追溯產物，驗證正式站，再把失敗、使用問題與成本帶回待辦。
7. 記錄 PR、commit、審查、測試、部署及未驗證項目，釋放本人持有的鎖。失敗也須保留進度，不把「已開 PR」寫成「已上線」。

金額與稅額規則、官方法規或費率解讀、資料保存或匯入 schema、權限與安全、新外部資料傳送、帳號／付款／雲端服務、部署設定或審查政策的變更，先準備具體 PR 與證據，再由使用者核准。一般功能自動交付的授權不涵蓋更改自己的審查門檻。

## 已提供的檢查

```bash
npm ci
npm run lint
npm run format:check
npm test
npm run build
npm run test:seo-build
npm run build:company
npm run test:seo-build -- /invoice/
npx playwright install chromium
npm run test:browser
```

使用 Node 24。瀏覽器測試另需 `pdftotext`（macOS 的 Poppler，Ubuntu 的 `poppler-utils`）；CI 安裝其系統套件及 Chromium。`@playwright/test` 以 lockfile 鎖定版本。CI 不注入正式站憑證，checkout 不保留 Git 寫入憑證，Actions 固定完整 SHA。

瀏覽器測試使用建置後的 `dist/client`，透過只綁定 `127.0.0.1` 的靜態伺服器檢查真實 `/invoice/` 路徑與 404。涵蓋 1440px／320px、搜尋與導覽、全年 ICS、報價範例、實際 PNG 下載與 Chromium 列印 PDF，並用 `pdftotext` 核對內容。列印按鈕的呼叫和 PDF renderer 分別驗證，未聲稱操作了作業系統列印對話框或實體印表機。沒有全工具、所有瀏覽器引擎及所有文件排列的覆蓋；新功能仍需自己的驗收。

本機證據預設放在系統暫存目錄的 `invoice-helper-browser-results`；可用 `PLAYWRIGHT_OUTPUT_DIR` 指定位置。CI 保留 7 天的瀏覽器產物供審查。`COMPANY_TEST_PORT` 可更換預設的 4178 port；不重用已佔用的伺服器，以免驗到另一版本。

## 工作鎖與進度

`scripts/loop-state.mjs` 將資料放在 Git common directory 的 `engineering-loop/`，同一 checkout 的所有 worktree 共用。此為本機工作紀錄，不提交到 Git，也不是跨主機分散式鎖。未來若改成多部機器執行，需要另行核准與驗證全域互斥，不能沿用本機鎖的保證。

```bash
node scripts/loop-state.mjs status
node scripts/loop-state.mjs acquire
# 保存 acquire 回傳的 token；只用自己的 token 更新與釋放。
node scripts/loop-state.mjs update --token YOUR_RUN_TOKEN --json '{"status":"running","feature":"selected-month-calendar-ics"}'
node scripts/loop-state.mjs release --token YOUR_RUN_TOKEN
```

無參數執行會列出用法。同日已記錄的 feature、branch、PR 不可替換；修復時追加進度。遺留鎖不因時間到了就搶占，先確認原執行已停止，再按鎖擁有者資料處理；不可刪掉不屬於本輪的鎖。測試使用獨立 `--state-dir`，涵蓋雙程序競爭、錯誤 token、重跑及損毀狀態。

## 合併與發布啟用前的核准清單

- 維護者確認正式基準分支與 SHA，檢視本工程基礎 PR；此提案未改預設分支。
- `.github/branch-protection.proposed.json` 是待核准的 GitHub branch protection payload，不會被 CI 自動套用。`check` 的來源固定為 GitHub Actions App 15368，已由第一個功能 PR 的 check-run API 核對；實際套用前再次確認名稱與來源。提案要求最新基準與重新審核，不允許 force push／刪除／管理員 bypass。
- 需要與 PR 作者不同的有效 GitHub 審核身分。相同 GitHub 帳號下的兩個 Codex 子代理，不能假裝成兩個 GitHub review 身分。未設置獨立 reviewer App 或其他合格審核者前，可產生 AI 審查證據，但不能宣稱已滿足正式 approval；合併保持關閉。
- 維護者核准後才啟用 repository auto-merge。開 PR 身分與 workflow 觸發方式須實測；使用 `GITHUB_TOKEN` 建立的 PR 可能需要人工允許 workflow，不能假設檢查會自行跑完。
- 在工程與 PR 執行環境外建立受控發布 runner／工作，使用只可部署本站的憑證與固定程序；不得把一般使用者 SSH key 複製到 agent/PR 環境。此次 PR **不建立具正式權限的部署 workflow、不設定 GitHub secrets、不啟用 SSH 操作**。受控 runner、審核身分及憑證授予需要維護者核准後另行完成和驗證，這是目前的發布阻擋條件。
- 依 [發布操作說明](RELEASE_RUNBOOK.md) 檢查腳本、可信任 baseline、完整 manifest 與預期前版。先在隔離目錄演練啟用、拒絕錯誤版本與回復，再在受控環境完成正式驗證。只發布 `dist/client` 的公開產物；`npm run deploy` 仍是 Cloudflare 指令，不能拿來部署公司站。

啟用時應將發布工作序列化、鎖定合併後的提交及其已驗證產物，核對 GitHub checks 和獨立審查對應同一版本。不能在測完後重新建置一份未核對的產物直接發布。首次正式 runner／回復演練未完成前，僅到 PR 階段。

參考：[GitHub auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)、[workflow 觸發與 token 行為](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[Playwright web server](https://playwright.dev/docs/test-webserver)。
