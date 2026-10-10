import { useRef, useState, type ClipboardEvent } from 'react';
import { Download, Printer, RotateCcw } from 'lucide-react';
import {
  attendanceRawLimitError,
  attendanceSheetResult,
  attendanceSheetText,
  emptyAttendanceSheet,
  exampleAttendanceSheet,
  type AttendanceSheetDraft,
} from '../../features/tools/attendanceSheet';
import { downloadInvoice } from '../../utils/exportInvoice';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './attendance-sheet.css';

export function AttendanceSheetTool() {
  const [draft, setDraft] = useState(emptyAttendanceSheet);
  const [revision, setRevision] = useState(0);
  const currentRevision = useRef(0);
  const [pasteError, setPasteError] = useState('');
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const paperRefs = useRef<(HTMLElement | null)[]>([]);
  const result = attendanceSheetResult(draft);
  const valid = result.valid && !pasteError;
  const sheet = valid ? result.sheet : null;
  const text = valid ? attendanceSheetText(result) : '';

  const changeDraft = (next: AttendanceSheetDraft) => {
    currentRevision.current += 1;
    setRevision(currentRevision.current);
    setDraft(next);
    setPasteError('');
    setStatus('');
  };
  const guardPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    // Match the native textarea newline normalization before checking the candidate.
    const pasted = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const candidate =
      input.value.slice(0, input.selectionStart) + pasted + input.value.slice(input.selectionEnd);
    const error = attendanceRawLimitError(candidate);
    if (!error) return;
    event.preventDefault();
    currentRevision.current += 1;
    setRevision(currentRevision.current);
    setStatus('');
    setPasteError(`${error} 這次貼上未套用，欄位原文仍保留；請修改名單後再輸出。`);
  };
  const exportPage = async (index: number) => {
    const paper = paperRefs.current[index];
    if (!valid || !paper || busyPage !== null) return;
    const exportRevision = currentRevision.current;
    setBusyPage(index);
    setStatus(`正在製作第 ${index + 1} 頁 PNG…`);
    try {
      await downloadInvoice(paper, `活動簽到表_${draft.date}_第${index + 1}頁.png`);
      if (exportRevision === currentRevision.current)
        setStatus(`第 ${index + 1} 頁 PNG 已產生，請查看瀏覽器下載項目。`);
    } catch {
      if (exportRevision === currentRevision.current)
        setStatus(`第 ${index + 1} 頁圖片製作失敗，請重試或使用列印／另存 PDF。`);
    } finally {
      setBusyPage(null);
    }
  };
  const invalidField = (field: keyof AttendanceSheetDraft) =>
    result.errors.some((error) => error.field === field);

  return (
    <ToolPage title="活動簽到表" description="先排好名單，留足手寫空間，帶著紙本迎接每位參與者。">
      <div className="attendance-sheet">
        <div className="attendance-layout">
          <section
            className="tool-form attendance-editor"
            aria-labelledby="attendance-editor-heading"
          >
            <div className="attendance-toolbar">
              <button
                className="button button-quiet"
                type="button"
                onClick={() => {
                  if (window.confirm('載入範例會取代目前全部簽到表內容。確定取代？'))
                    changeDraft(exampleAttendanceSheet());
                }}
              >
                載入範例
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      '清空會移除目前全部活動資料與名單，日期回到今天、總列數回到 20。確定清空？',
                    )
                  )
                    changeDraft(emptyAttendanceSheet());
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                清空
              </button>
            </div>
            <h2 className="numbered-title" id="attendance-editor-heading">
              <span>01</span>準備簽到資料
            </h2>
            {(
              [
                ['title', '活動名稱', '例如 社區手作交流日'],
                ['venue', '活動地點（選填）', '例如 社區活動中心一樓'],
                ['organizer', '主辦單位（選填）', '例如 巷口生活小組'],
              ] as const
            ).map(([field, label, placeholder]) => (
              <div className="tool-field" key={field}>
                <label id={`attendance-${field}-label`} htmlFor={`attendance-${field}`}>
                  {label}
                  {field === 'title' ? ' *' : ''}
                </label>
                <textarea
                  id={`attendance-${field}`}
                  rows={field === 'title' ? 2 : 1}
                  value={draft[field]}
                  placeholder={placeholder}
                  aria-labelledby={`attendance-${field}-label`}
                  aria-describedby={`attendance-${field}-hint`}
                  aria-invalid={invalidField(field)}
                  onChange={(event) => changeDraft({ ...draft, [field]: event.target.value })}
                />
                <small id={`attendance-${field}-hint`}>單行、最多 80 字，字數包含首尾空白。</small>
              </div>
            ))}
            <div className="tool-field">
              <label id="attendance-date-label" htmlFor="attendance-date">
                活動日期 *
              </label>
              <textarea
                id="attendance-date"
                rows={1}
                value={draft.date}
                placeholder="YYYY-MM-DD"
                aria-labelledby="attendance-date-label"
                aria-describedby="attendance-date-hint"
                aria-invalid={invalidField('date')}
                onChange={(event) => changeDraft({ ...draft, date: event.target.value })}
              />
              <small id="attendance-date-hint">
                西元 YYYY-MM-DD，例如 2026-10-09；0001–9999 年。
              </small>
            </div>
            <div className="tool-field">
              <label id="attendance-rows-label" htmlFor="attendance-rows">
                總列數 *
              </label>
              <textarea
                id="attendance-rows"
                rows={1}
                inputMode="numeric"
                value={draft.totalRowsRaw}
                aria-labelledby="attendance-rows-label"
                aria-describedby="attendance-rows-hint"
                aria-invalid={invalidField('totalRowsRaw')}
                onChange={(event) => changeDraft({ ...draft, totalRowsRaw: event.target.value })}
              />
              <small id="attendance-rows-hint">
                1–100 列，每 20 列一頁、最多 5 頁。姓名不足時補空白列。
              </small>
            </div>
            <div className="tool-field">
              <label id="attendance-names-label" htmlFor="attendance-names">
                姓名名單（選填）
              </label>
              <textarea
                id="attendance-names"
                rows={8}
                value={draft.namesRaw}
                placeholder={'每行一個姓名\n林小青\n陳文宇'}
                aria-labelledby="attendance-names-label"
                aria-describedby="attendance-names-hint"
                aria-invalid={invalidField('namesRaw') || Boolean(pasteError)}
                onPaste={guardPaste}
                onChange={(event) => changeDraft({ ...draft, namesRaw: event.target.value })}
              />
              <small id="attendance-names-hint">
                每行最多 24 字（含首尾空白），最多 100 人且不可超過總列數；原文最多 10,000 字、1,000
                行（含空白行）。輸出略過空白行、移除姓名首尾空白，保留順序與同名。
              </small>
            </div>
            {(!result.valid || pasteError) && (
              <div id="attendance-errors" className="attendance-errors" role="alert">
                <p>請修正以下資料後再輸出：</p>
                <ul>
                  {result.errors.slice(0, 20).map((error, index) => (
                    <li key={`${error.field}-${index}`}>{error.message}</li>
                  ))}
                  {result.errors.length > 20 && (
                    <li>共 {result.errors.length} 項錯誤，先列出前 20 項；請修正名單後再檢查。</li>
                  )}
                  {pasteError && <li>{pasteError}</li>}
                </ul>
              </div>
            )}
            <SessionNote />
          </section>
          <section className="attendance-preview" aria-labelledby="attendance-preview-heading">
            <div className="attendance-output-controls">
              <h2 className="numbered-title" id="attendance-preview-heading">
                <span>02</span>紙本簽到表
              </h2>
              <p className="attendance-summary">
                {sheet
                  ? `${sheet.namedRows} 筆姓名 · ${sheet.totalRows} 列 · 共 ${sheet.pages.length} 頁`
                  : '填妥活動名稱、有效日期與總列數後，即可預覽。'}
              </p>
              <p className="attendance-hint">
                單位、簽名與備註留白供現場手寫。窄螢幕可在每張預覽內左右滑動。
              </p>
              <div className="attendance-output-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!valid || busyPage !== null}
                  onClick={() => {
                    if (valid) window.print();
                  }}
                >
                  <Printer size={17} aria-hidden="true" />
                  列印全部／另存 PDF
                </button>
                <CopyAction
                  key={revision}
                  text={text}
                  disabled={!valid || busyPage !== null}
                  label="複製完整簽到表"
                />
              </div>
              <p className="action-status" role="status">
                {status}
              </p>
            </div>
            {sheet && (
              <div className="attendance-pages">
                {sheet.pages.map((rows, pageIndex) => (
                  <div className="attendance-page-block" key={pageIndex}>
                    <div className="attendance-page-controls">
                      <h3>第 {pageIndex + 1} 頁</h3>
                      <button
                        className="button button-quiet"
                        type="button"
                        disabled={busyPage !== null}
                        onClick={() => exportPage(pageIndex)}
                      >
                        <Download size={16} aria-hidden="true" />
                        {busyPage === pageIndex
                          ? `正在製作第 ${pageIndex + 1} 頁 PNG`
                          : `下載第 ${pageIndex + 1} 頁 PNG`}
                      </button>
                    </div>
                    <div
                      className="attendance-page-scroll"
                      role="region"
                      aria-label={`第 ${pageIndex + 1} 頁簽到表預覽`}
                      tabIndex={0}
                    >
                      <article
                        className="attendance-paper"
                        ref={(element) => {
                          paperRefs.current[pageIndex] = element;
                        }}
                        aria-label={`活動簽到表第 ${pageIndex + 1} 頁`}
                      >
                        <header>
                          <p className="attendance-paper-kicker">活動簽到表</p>
                          <h3>{sheet.title}</h3>
                          <dl>
                            <div>
                              <dt>活動日期</dt>
                              <dd>{sheet.date}</dd>
                            </div>
                            <div>
                              <dt>活動地點</dt>
                              <dd>{sheet.venue || '—'}</dd>
                            </div>
                            <div>
                              <dt>主辦單位</dt>
                              <dd>{sheet.organizer || '—'}</dd>
                            </div>
                          </dl>
                        </header>
                        <table className="attendance-table">
                          <colgroup>
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '26%' }} />
                            <col style={{ width: '16%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th scope="col">序號</th>
                              <th scope="col">姓名</th>
                              <th scope="col">單位</th>
                              <th scope="col">簽名</th>
                              <th scope="col">備註</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.number}>
                                <td>{row.number}</td>
                                <td>{row.name}</td>
                                <td></td>
                                <td></td>
                                <td></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <footer>
                          第 {pageIndex + 1} / {sheet.pages.length} 頁
                        </footer>
                      </article>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {valid && (
              <details className="attendance-text-output">
                <summary>查看完整文字</summary>
                <textarea readOnly rows={10} value={text} aria-label="完整簽到表文字" />
              </details>
            )}
          </section>
        </div>
      </div>
    </ToolPage>
  );
}
