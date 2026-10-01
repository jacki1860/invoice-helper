# 靜態 release 腳本

這是待核准的發布工具，不是已啟用的正式部署流程。腳本不含 SSH、Nginx 變更、憑證安裝或網路請求；正式環境仍須另外完成受控部署、基準版本核准及 HTTPS／瀏覽器驗證。

## 執行環境與信任邊界

- 打包／測試：Node.js 24 以上、Python 3.10 以上；腳本只使用 Python 標準庫。
- 正式執行：具 `fcntl.flock`、同目錄原子 rename 的 Linux 本機檔案系統，Python 3.10 以上。macOS 暫存環境可演練；Windows、NFS／分散式檔案系統未支援。
- 正式資料根目錄固定為 `/var/www/invoice-helper`，產物放在 `releases/<commit>`，manifest 放在 `manifests/<commit>.json`，live 固定為 `/var/www/html/invoice`。不提供任意 live 路徑或 shell command 參數。
- 上述目錄與 `/var/www/html` 須預先配置，由 root 或部署帳號持有，禁止 group／other 寫入。受控執行者须有實際建立 release、manifest 和切換 live symlink 的權限；不透過本腳本開放一般開發帳號的 sudo 或正式密鑰。
- 正式使用的腳本須是經核准、部署帳號以外無法修改的固定版本。不得用正式權限直接執行 PR 中尚未核准的 Python 或 workflow。
- 所有會切換本站 live 的流程必須使用同一個 `.deploy.lock`。expected-current 的比較與原子替換在此鎖內完成；腳本不能保護忽略此鎖、直接修改檔案的其他 privileged 程序。
- 封裝器記錄呼叫方提供的 commit，不自行證明 build 來自該 commit。受控建置必須從核准的乾淨 commit 產生 `dist/client`，保存 build／review 證據，並將封裝回傳的 **manifestSha256** 釘在可信的審查／發布紀錄；不要為了讓改過的 artifact 通過，重新取 hash 代替審查。

## 封裝與校驗

在完成公司站 build 的核准 checkout 中執行；範例中的變數由受控流程提供。

```sh
python3 scripts/release/release.py pack \
  --source dist/client --commit "$RELEASE_COMMIT" --output "$ARTIFACT_DIR"

python3 scripts/release/release.py verify \
  --artifact "$ARTIFACT_DIR" --commit "$RELEASE_COMMIT" \
  --manifest-sha256 "$REVIEWED_MANIFEST_SHA256"
```

`pack` 輸出 JSON，包含 `commit`、`files`、`manifestSha256`、`archiveSha256`。輸出目錄必須尚不存在，內含 `client.tar.gz` 與 `manifest.json`。相同 bytes／commit 產生相同封裝與 manifest。

只封裝 `dist/client` 的靜態檔案。白名單由本次實際檔案動態產生，校驗時 tar 與 manifest 的路徑、大小和 SHA-256 必須逐一完全一致，不固定頁數或資產檔名。只有根目錄 `.assetsignore` 會被精確略過；其他隱藏檔、敏感名稱、未知副檔名、source map、symlink、hardlink、特殊檔案與路徑穿越皆拒絕。單檔上限 32 MiB，總 bytes／archive 上限 128 MiB，最多 10,000 檔。這些檢查不取代秘密掃描或程式碼審查。

## 正式啟用與回復

兩個命令預設都是**唯讀 dry-run**；必須加 `--apply` 才切換 live。首次正式啟用仍須人工批准，以下不是目前已有的部署授權。

```sh
python3 scripts/release/release.py activate \
  --artifact "$ARTIFACT_DIR" --commit "$RELEASE_COMMIT" \
  --manifest-sha256 "$REVIEWED_MANIFEST_SHA256" \
  --expected-current "$EXPECTED_CURRENT_COMMIT"

# 僅在已獲核准的受控環境，對同一組參數加 --apply。

python3 scripts/release/release.py rollback \
  --to "$APPROVED_PREVIOUS_COMMIT" \
  --expected-current "$FAILED_RELEASE_COMMIT"
```

啟用前須存在可信的 current symlink，以及舊版對應的 JSON manifest，且舊版 bytes 必須吻合。現有正式站只有舊 `SHA256SUMS` 的情況不會被自動當作可信基準：必須另行核准基準，取得可追溯的同版 artifact／manifest，逐檔比對現有 releases 內容後，才由受控部署流程安裝基準 manifest。本工具不遷移 Nginx、不推定既有 61 commits 已通過審查，也不支援直接覆蓋舊的實體 live 目錄。

啟用會把已驗證的普通檔案寫入 staging，固定檔案 0644、目錄 0755，校驗後以 live 所在目錄的臨時 symlink 做原子 rename。舊 release 保留，不覆寫既有 commit 目錄。上線後另外核對 public HTTPS 實際資產／功能輸出；命令成功只證明本機檔案與 live 指向，不能代替公開網站檢查。

回復必須指定仍在線上的失敗 commit；若別人已發布另一版，命令拒絕，不能覆蓋新版。回復目標的 manifest／檔案必須吻合；當前版本的 bytes 已損壞仍可回復。rollback 不等於功能驗收，完成後仍要驗證 HTTPS 與關鍵輸出。

如果啟用在安裝 release 後、切換前失敗，live 保持原版，但可能留下未啟用的 release／manifest 供檢查。腳本不自動刪除這些證據，也不覆蓋重跑；先確認 live、失敗原因和該 release 的歸屬，再由已授權的復原流程處理。不以刪 lock 檔解鎖；`flock` 會在程序退出時釋放。

## 暫存演練

```sh
node --test tests/release.test.ts
```

測試使用固定 `/tmp` 下的獨立 `--sandbox-root`（macOS canonical path 是 `/private/tmp`，不採信 `TMPDIR`），live 固定為其 `current`，可以用 `--expected-current none` 建立第一版。正式模式拒絕 `none`。測試涵蓋動態檔案清單、惡意 tar／manifest、hash 不符、symlink／hardlink、dry-run、互斥鎖、錯誤 previous、發布→驗證→rollback，以及 live 被第三版取代後拒絕回復；不讀取正式憑證、不連正式主機。
