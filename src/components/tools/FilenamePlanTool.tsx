import { useMemo, useState } from 'react';
import { Download, Eraser, FileText } from 'lucide-react';
import {
  emptyFilenamePlan,
  exampleFilenamePlan,
  planFilenames,
  type FilenamePlanDraft,
} from '../../features/tools/filenamePlan';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './filename-plan.css';

const PAGE_SIZE = 100;

export function FilenamePlanTool() {
  const [draft, setDraft] = useState(emptyFilenamePlan);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const result = useMemo(() => planFilenames(draft), [draft]);
  const hasInput =
    draft.original !== '' ||
    draft.prefix !== '' ||
    draft.startRaw !== '1' ||
    draft.paddingRaw !== '3' ||
    !draft.keepExtension;
  const pageCount = Math.ceil(result.rows.length / PAGE_SIZE);
  const visibleRows = result.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const changeDraft = (next: FilenamePlanDraft) => {
    setDraft(next);
    setRevision((current) => current + 1);
    setPage(0);
    setDownloadStatus('');
  };

  const download = () => {
    if (!result.valid) return;
    setDownloadStatus('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(
        new Blob([result.mappingText], { type: 'text/plain;charset=utf-8' }),
      );
      link = document.createElement('a');
      link.href = url;
      link.download = '批次檔名對照表.txt';
      document.body.appendChild(link);
      link.click();
      setDownloadStatus('已產生完整 TXT 對照表，請查看瀏覽器下載。');
    } catch {
      setDownloadStatus('無法產生 TXT，請重試或複製完整對照表。');
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  return (
    <ToolPage
      title="批次檔名規劃器"
      description="替交付檔案排好前綴與流水號，核對原檔名與新檔名，再帶走完整對照表。"
    >
      <div className="filename-plan">
        <div className="tool-columns">
          <section className="tool-form" aria-labelledby="filename-plan-input-title">
            <h2 className="numbered-title" id="filename-plan-input-title">
              <span>01</span>安排檔名
            </h2>
            <label className="tool-field" htmlFor="filename-plan-original">
              <span id="filename-plan-original-label">原始檔名</span>
              <textarea
                id="filename-plan-original"
                aria-labelledby="filename-plan-original-label"
                value={draft.original}
                rows={10}
                placeholder={'每行一個檔名，例如\n原圖.JPG\n報告.final.pdf\n.env'}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={hasInput && result.errors.some((error) => error.field === 'original')}
                aria-describedby="filename-plan-input-hint"
                onChange={(event) => changeDraft({ ...draft, original: event.target.value })}
              />
              <small id="filename-plan-input-hint">
                只貼檔名，不含資料夾路徑；每個檔名最多 200 個 Unicode
                碼點，保留原始順序及首尾文字，不自動去重或刪除首尾空白。
              </small>
            </label>
            <label className="tool-field" htmlFor="filename-plan-prefix">
              <span id="filename-plan-prefix-label">檔名前綴</span>
              <textarea
                id="filename-plan-prefix"
                aria-labelledby="filename-plan-prefix-label"
                value={draft.prefix}
                rows={1}
                placeholder="例如 交件_"
                spellCheck={false}
                aria-invalid={result.errors.some((error) => error.field === 'prefix')}
                aria-describedby="filename-plan-prefix-hint"
                onChange={(event) => changeDraft({ ...draft, prefix: event.target.value })}
              />
              <small id="filename-plan-prefix-hint">
                選填，最多 80 個 Unicode 碼點；前綴內的空格照原樣保留。
              </small>
            </label>
            <div className="filename-plan-number-fields">
              <label className="tool-field" htmlFor="filename-plan-start">
                <span>起始編號</span>
                <input
                  id="filename-plan-start"
                  type="text"
                  inputMode="numeric"
                  value={draft.startRaw}
                  aria-invalid={result.errors.some((error) => error.field === 'startRaw')}
                  aria-describedby="filename-plan-number-hint"
                  onChange={(event) => changeDraft({ ...draft, startRaw: event.target.value })}
                />
              </label>
              <label className="tool-field" htmlFor="filename-plan-padding">
                <span>編號位數</span>
                <select
                  id="filename-plan-padding"
                  value={draft.paddingRaw}
                  onChange={(event) => changeDraft({ ...draft, paddingRaw: event.target.value })}
                >
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={String(value)}>
                      {value} 位
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="filename-plan-note" id="filename-plan-number-hint">
              起號及最後編號均須在 1–999999。位數是最少位數，不足才補零，例如 3 位的 9 會成為
              009；超過位數時不截斷。
            </p>
            <label className="filename-plan-checkbox">
              <input
                type="checkbox"
                checked={draft.keepExtension}
                onChange={(event) => changeDraft({ ...draft, keepExtension: event.target.checked })}
              />
              保留最後副檔名
            </label>
            <p className="filename-plan-note">
              只保留最後一個句點後的副檔名及原大小寫，例如 報告.final.pdf 保留 .pdf；.env
              沒有副檔名。取消勾選時全部移除。
            </p>
            <p className="filename-plan-note">
              上限 1,000 個原始行、100,000 個 Unicode
              碼點，依輸入框內文字計算；瀏覽器會統一換行。最後換行多計一行，空白行略過並計數，含 Tab
              的行仍會報錯。
            </p>
            <div className="filename-plan-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  if (hasInput && !window.confirm('載入範例會取代目前檔名及全部設定，確定繼續？'))
                    return;
                  changeDraft(exampleFilenamePlan());
                }}
              >
                <FileText size={17} aria-hidden="true" />
                載入範例
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={!hasInput}
                onClick={() => {
                  if (window.confirm('確定清空檔名與結果，並重設全部設定？'))
                    changeDraft(emptyFilenamePlan());
                }}
              >
                <Eraser size={17} aria-hidden="true" />
                清空
              </button>
            </div>
            {hasInput && !result.valid && (
              <div className="filename-plan-errors" id="filename-plan-errors" role="alert">
                <p>請修正以下問題；目前整份結果已停止，無法複製或下載。</p>
                <ul>
                  {result.errors.map((error, index) => (
                    <li key={index}>
                      {error.line !== undefined ? `第 ${error.line} 行：` : ''}
                      {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SessionNote />
          </section>

          <section
            className="tool-result filename-plan-results"
            aria-labelledby="filename-plan-result-title"
          >
            <h2 className="numbered-title" id="filename-plan-result-title">
              <span>02</span>檔名對照預覽
            </h2>
            <dl className="filename-plan-stats" aria-label="檔名規劃統計" aria-live="polite">
              <div>
                <dt>原始行數</dt>
                <dd>{result.originalLines}</dd>
              </div>
              <div>
                <dt>略過空白行</dt>
                <dd>{result.blankLines}</dd>
              </div>
              <div>
                <dt>規劃檔名</dt>
                <dd>{result.valid ? result.rows.length : '—'}</dd>
              </div>
            </dl>
            {result.valid ? (
              <>
                {result.warnings.length > 0 && (
                  <div className="filename-plan-warnings" role="status">
                    <p>更名順序可能衝突，請先核對：</p>
                    <ul>
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <table className="filename-plan-table">
                  <caption>
                    原始行號與檔名對照（第 {page * PAGE_SIZE + 1}–
                    {Math.min((page + 1) * PAGE_SIZE, result.rows.length)} 筆，共{' '}
                    {result.rows.length} 筆）
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">行</th>
                      <th scope="col">原檔名</th>
                      <th scope="col">新檔名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.line}>
                        <td>{row.line}</td>
                        <td>
                          <span dir="auto">{row.original}</span>
                        </td>
                        <td>
                          <span dir="auto">{row.planned}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pageCount > 1 && (
                  <nav className="filename-plan-pagination" aria-label="檔名對照分頁">
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={page === 0}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      上一頁
                    </button>
                    <span aria-live="polite">
                      第 {page + 1} / {pageCount} 頁
                    </span>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      下一頁
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <p className="filename-plan-empty">
                {hasInput
                  ? '請先修正輸入，這裡才會顯示完整規劃。'
                  : '貼上檔名或載入範例，開始規劃新檔名。'}
              </p>
            )}
            <p className="filename-plan-note">
              預覽每頁最多 100 筆；以下複製與下載一律包含全部有效檔名，不受目前頁數影響。
            </p>
            <div className="filename-plan-output-actions">
              <CopyAction
                key={`names-${revision}`}
                text={result.namesText}
                disabled={!result.valid}
                label="複製新檔名清單"
              />
              <CopyAction
                key={`mapping-${revision}`}
                text={result.mappingText}
                disabled={!result.valid}
                label="複製完整對照表"
              />
              <div>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!result.valid}
                  onClick={download}
                >
                  <Download size={17} aria-hidden="true" />
                  下載 TXT 對照表
                </button>
                <p className="filename-plan-download-status action-status" role="status">
                  {downloadStatus}
                </p>
              </div>
            </div>
            <details className="filename-plan-output-text">
              <summary>查看可選取的完整文字</summary>
              <label className="tool-field" htmlFor="filename-plan-names">
                <span>完整新檔名清單</span>
                <textarea
                  id="filename-plan-names"
                  readOnly
                  rows={5}
                  value={result.namesText}
                  spellCheck={false}
                />
              </label>
              <label className="tool-field" htmlFor="filename-plan-report">
                <span>完整檔名對照表</span>
                <textarea
                  id="filename-plan-report"
                  readOnly
                  rows={6}
                  value={result.mappingText}
                  spellCheck={false}
                />
              </label>
            </details>
            <p className="filename-plan-note">
              對照表首行為「原檔名 ⇥ 新檔名」，⇥ 代表一個 Tab 分隔符。複製與 TXT 內容相同；TXT 使用
              UTF-8、無 BOM、LF 換行且末尾保留一個換行。新檔名清單同樣以 LF 分行並保留最後換行。
            </p>
          </section>
        </div>
        <aside className="filename-plan-rules" aria-label="檔名規劃規則">
          <h2>先核對對照表，再自行更名</h2>
          <p>
            這裡只規劃文字，不讀取、上傳或更改實際檔案，也不檢查磁碟內已有檔案。200
            碼點是本工具上限，不保證符合所有檔案系統限制。使用前仍需確認目標資料夾及更名順序；同一行新舊名稱相同時會保留該筆。
          </p>
          <p>
            原檔名與產生的新檔名都限制 200 個 Unicode 碼點，不接受路徑、控制字元、&lt; &gt; : &quot;
            | ? *、結尾空格或句點、. / .. 及 Windows 保留名稱（例如
            CON、COM1、LPT1，包含副檔名與上標數字形式）。前綴可含空格，不能含路徑、控制字元或上述特殊符號。
          </p>
          <p>
            原檔名以 NFC
            正規化後轉成小寫比較，以檢查碰撞，只用於判斷重複，輸出仍保留原文。原名重複或任一項無效時，整份停止；新名與另一筆原名相同會提醒更名順序可能衝突，不代表實際檔案可安全更名。
          </p>
        </aside>
      </div>
    </ToolPage>
  );
}
