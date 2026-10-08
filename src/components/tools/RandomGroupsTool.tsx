import { useMemo, useState } from 'react';
import { Download, Eraser, FileText, Shuffle } from 'lucide-react';
import {
  createRandomGroups,
  emptyRandomGroups,
  exampleRandomGroups,
  validateRandomGroups,
  type RandomGroupsDraft,
  type RandomGroupsOutput,
} from '../../features/tools/randomGroups';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './random-groups.css';

export function RandomGroupsTool() {
  const [draft, setDraft] = useState(emptyRandomGroups);
  const [output, setOutput] = useState<RandomGroupsOutput | null>(null);
  const [revision, setRevision] = useState(0);
  const [drawCount, setDrawCount] = useState(0);
  const [randomError, setRandomError] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const validation = useMemo(() => validateRandomGroups(draft), [draft]);
  const hasInput = draft.names !== '' || draft.groupCountRaw !== '2';

  const changeDraft = (next: RandomGroupsDraft) => {
    setDraft(next);
    setOutput(null);
    setRevision((current) => current + 1);
    setDrawCount(0);
    setRandomError('');
    setDownloadStatus('');
  };

  const generate = () => {
    setOutput(null);
    setRandomError('');
    setDownloadStatus('');
    setRevision((current) => current + 1);
    if (!validation.valid) return;
    try {
      setOutput(createRandomGroups(draft));
      setDrawCount((current) => current + 1);
    } catch {
      setRandomError(
        '瀏覽器無法取得可用亂數，這次沒有產生結果。請重試；若仍失敗，請更新瀏覽器或換一個瀏覽器。名單與組數已保留。',
      );
    }
  };

  const download = () => {
    if (!output) return;
    setDownloadStatus('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([output.text], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = '隨機分組結果.txt';
      document.body.appendChild(link);
      link.click();
      setDownloadStatus('已產生完整 TXT 分組結果，請查看瀏覽器下載。');
    } catch {
      setDownloadStatus('無法產生 TXT，請重試或複製完整分組結果。');
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
      title="隨機分組器"
      description="貼上活動或工作坊名單，指定組數，隨機排出人數均衡的分組。"
    >
      <div className="random-groups">
        <div className="tool-columns">
          <section className="tool-form" aria-labelledby="random-groups-input-title">
            <h2 className="numbered-title" id="random-groups-input-title">
              <span>01</span>準備參與者
            </h2>
            <label className="tool-field" htmlFor="random-groups-names">
              <span id="random-groups-names-label">參與者名單</span>
              <textarea
                id="random-groups-names"
                aria-labelledby="random-groups-names-label"
                value={draft.names}
                rows={12}
                placeholder={'每行一名，例如\n小安\n小晴\n阿哲\n小岑'}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={
                  hasInput && validation.errors.some((error) => error.field === 'names')
                }
                aria-describedby={`random-groups-names-hint${hasInput && !validation.valid ? ' random-groups-errors' : ''}`}
                onChange={(event) => changeDraft({ ...draft, names: event.target.value })}
              />
              <small id="random-groups-names-hint">
                每行一名，共 2–500 人；刪除首尾空白、略過空白行。每名最多 80 個 Unicode
                碼點（不含首尾空白），整份最多 100,000 個碼點。不可含控制字元或 Tab。
              </small>
            </label>
            <label className="tool-field" htmlFor="random-groups-count">
              <span id="random-groups-count-label">組數</span>
              <input
                id="random-groups-count"
                aria-labelledby="random-groups-count-label"
                type="text"
                inputMode="numeric"
                value={draft.groupCountRaw}
                aria-invalid={
                  hasInput && validation.errors.some((error) => error.field === 'groupCountRaw')
                }
                aria-describedby={`random-groups-count-hint${hasInput && !validation.valid ? ' random-groups-errors' : ''}`}
                onChange={(event) => changeDraft({ ...draft, groupCountRaw: event.target.value })}
              />
              <small id="random-groups-count-hint">
                2–100 組，且不可超過人數；各組人數最多相差 1 人。
              </small>
            </label>
            <div className="random-groups-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  if (hasInput && !window.confirm('載入範例會取代目前名單、組數與結果，確定繼續？'))
                    return;
                  changeDraft(exampleRandomGroups());
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
                  if (window.confirm('確定清空名單與分組結果，並重設組數？'))
                    changeDraft(emptyRandomGroups());
                }}
              >
                <Eraser size={17} aria-hidden="true" />
                清空
              </button>
            </div>
            <p className="random-groups-note">
              同名者請加識別，例如「小安（設計）」「小安（企劃）」。姓名以 NFC
              正規化後比對，區分大小寫；重複時整份停止，不會自動刪人。
            </p>
            {hasInput && !validation.valid && (
              <div className="random-groups-errors" id="random-groups-errors" role="alert">
                <p>請修正以下問題後再分組；原始輸入會完整保留。</p>
                <ul>
                  {validation.errors.map((error, index) => (
                    <li key={index}>
                      {error.line !== undefined ? `第 ${error.line} 行：` : ''}
                      {error.message}
                    </li>
                  ))}
                </ul>
                {validation.errorCount > validation.errors.length && (
                  <p>
                    另有 {validation.errorCount - validation.errors.length}{' '}
                    項輸入問題未逐一列出；整份名單仍停止分組，請依規則修正（僅允許 2–500 人）。
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              className="button button-primary random-groups-generate"
              disabled={!validation.valid}
              onClick={generate}
            >
              <Shuffle size={17} aria-hidden="true" />
              {output ? '重新分組' : '產生分組'}
            </button>
            {randomError && (
              <p className="random-groups-errors" role="alert">
                {randomError}
              </p>
            )}
            <p className="random-groups-note">
              只有按下分組才產生結果；修改名單或組數後，需要重新按下分組。重抽可能恰好得到相同結果。
            </p>
            <SessionNote />
          </section>
          <section
            className="tool-result random-groups-results"
            aria-labelledby="random-groups-result-title"
          >
            <h2 className="numbered-title" id="random-groups-result-title">
              <span>02</span>分組結果
            </h2>
            <p className="random-groups-summary" role="status">
              {output
                ? `已完成第 ${drawCount} 次分組，共 ${output.participantCount} 人、${output.groups.length} 組。`
                : validation.valid
                  ? `${validation.names.length} 人已就緒，略過 ${validation.blankLines} 個空白行；按「產生分組」開始。`
                  : '尚未產生分組結果。'}
            </p>
            {output ? (
              <div className="random-groups-grid">
                {output.groups.map((group, index) => (
                  <section
                    className="random-groups-card"
                    key={index}
                    aria-labelledby={`random-groups-group-${index}`}
                  >
                    <h3 id={`random-groups-group-${index}`}>
                      第 {index + 1} 組 <span>{group.length} 人</span>
                    </h3>
                    <ul>
                      {group.map((name) => (
                        <li key={name} dir="auto">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="random-groups-empty">
                在左側貼上名單或載入範例，再指定需要的組數。結果會完整列出每一組的成員。
              </p>
            )}
            <div className="random-groups-output-actions">
              <CopyAction
                key={revision}
                text={output?.text ?? ''}
                disabled={!output}
                label="複製完整分組"
              />
              <div>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!output}
                  onClick={download}
                >
                  <Download size={17} aria-hidden="true" />
                  下載分組 TXT
                </button>
                <p className="random-groups-download-status action-status" role="status">
                  {downloadStatus}
                </p>
              </div>
            </div>
            <details className="random-groups-output-text">
              <summary>查看可選取的完整文字</summary>
              <label className="tool-field" htmlFor="random-groups-report">
                <span>完整分組文字</span>
                <textarea
                  id="random-groups-report"
                  readOnly
                  rows={10}
                  value={output?.text ?? ''}
                  spellCheck={false}
                />
              </label>
            </details>
            <p className="random-groups-note">
              複製與下載包含全部分組及所有參與者。TXT 使用 UTF-8、無 BOM、LF
              換行且末尾保留一個換行。
            </p>
          </section>
        </div>
        <aside className="random-groups-rules" aria-label="分組方式與資料處理">
          <h2>先核對名單，再帶走分組</h2>
          <p>
            每位參與者恰好出現一次，多出的人數依組號分配到前幾組。這裡依人數平均分組，不考慮能力、部門或其他條件。
          </p>
          <p>
            使用瀏覽器產生隨機順序，再依組數平均分配，適合日常活動安排，沒有提供抽獎公平認證。名單不保存、不外傳；站內切換後返回可繼續查看，重新整理後清空。
          </p>
        </aside>
      </div>
    </ToolPage>
  );
}
