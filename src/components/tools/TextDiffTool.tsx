import { useMemo, useState } from 'react';
import { Download, Eraser, FileText } from 'lucide-react';
import { compareText, textDiffLabels } from '../../features/tools/textDiff';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './text-diff.css';

const sample = {
  original: '專案交付通知\n交付日期：10 月 15 日\n\n請提供收件人姓名。\n謝謝。',
  revised:
    '專案交付通知\n交付日期：10 月 18 日\n\n請提供收件人姓名。\n請一併提供聯絡電話。\n謝謝。',
};

export function TextDiffTool() {
  const [original, setOriginal] = useState('');
  const [revised, setRevised] = useState('');
  const [copyVersion, setCopyVersion] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const result = useMemo(() => compareText(original, revised), [original, revised]);
  const canExport = result.valid && result.rows.length > 0;
  const hasInput = original !== '' || revised !== '';

  function updateInputs(before: string, after: string) {
    setOriginal(before);
    setRevised(after);
    setCopyVersion((version) => version + 1);
    setDownloadStatus('');
  }

  function downloadReport() {
    if (!canExport) return;
    setDownloadStatus('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = '文字版本差異.txt';
      document.body.appendChild(link);
      link.click();
      setDownloadStatus('已產生 TXT，請查看瀏覽器下載。');
    } catch {
      setDownloadStatus('無法產生 TXT，請重試，或複製完整報告。');
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }

  return (
    <ToolPage
      title="文字版本差異"
      description="貼上兩版通知或流程文字，逐行核對相同、新增與刪除內容，再帶走完整比對報告。"
    >
      <section className="text-diff-inputs" aria-label="兩版原始文字">
        {(
          [
            ['original', '原版文字', original, result.valid ? undefined : result.errors.original],
            ['revised', '新版文字', revised, result.valid ? undefined : result.errors.revised],
          ] as const
        ).map(([side, label, value, error], index) => (
          <div className="tool-form text-diff-input-panel" key={side}>
            <h2 className="numbered-title">
              <span>0{index + 1}</span>
              {label}
            </h2>
            <label className="tool-field" htmlFor={`text-diff-${side}`}>
              <span>{label}</span>
              <textarea
                id={`text-diff-${side}`}
                className="text-diff-textarea"
                value={value}
                rows={10}
                wrap="off"
                placeholder={side === 'original' ? '貼上修改前的文字' : '貼上修改後的文字'}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={Boolean(error)}
                aria-describedby={`text-diff-limits${error ? ` text-diff-${side}-error` : ''}`}
                onChange={(event) =>
                  side === 'original'
                    ? updateInputs(event.target.value, revised)
                    : updateInputs(original, event.target.value)
                }
              />
            </label>
            {error && (
              <p className="text-diff-error" id={`text-diff-${side}-error`} role="alert">
                {error}
              </p>
            )}
          </div>
        ))}
      </section>
      <p className="text-diff-note" id="text-diff-limits">
        每份上限 100,000 個 Unicode 碼點、1,000 行，依輸入框內文字計算；瀏覽器會先統一換行。
        空字串為 0 行，最後換行會多計一個空白行；任一份超限便停止整份比對，原文保留。
      </p>
      <div className="text-diff-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            if (hasInput && !window.confirm('載入範例會取代目前的兩版文字，確定繼續？')) return;
            updateInputs(sample.original, sample.revised);
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
            if (window.confirm('確定清空兩版文字與比對結果？')) updateInputs('', '');
          }}
        >
          <Eraser size={17} aria-hidden="true" />
          清空雙欄
        </button>
      </div>
      <SessionNote />

      <section className="text-diff-results" aria-labelledby="text-diff-result-title">
        <h2 id="text-diff-result-title">逐行比對結果</h2>
        <dl className="text-diff-stats" aria-label="文字差異統計" aria-live="polite">
          <div>
            <dt>相同行</dt>
            <dd>{result.valid ? result.unchangedRows : '—'}</dd>
          </div>
          <div>
            <dt>新增行</dt>
            <dd>{result.valid ? result.addedRows : '—'}</dd>
          </div>
          <div>
            <dt>刪除行</dt>
            <dd>{result.valid ? result.removedRows : '—'}</dd>
          </div>
        </dl>
        <p className="text-diff-note" id="text-diff-result-note">
          {!result.valid
            ? '請先修正超限的文字；目前沒有可複製或下載的結果。'
            : !hasInput
              ? '貼上至少一份文字即可比對；單邊留空時，會列出另一版的所有新增或刪除行。'
              : `原版 ${result.originalLines} 行、新版 ${result.revisedLines} 行。${result.addedRows + result.removedRows === 0 ? '兩版逐行相同。' : '替換以刪除及新增表示。'}空白行的提示只用於畫面，匯出保留原文。`}
        </p>
        {canExport && (
          <table className="text-diff-table" aria-describedby="text-diff-result-note">
            <caption className="sr-only">完整逐行差異與兩側行號</caption>
            <thead>
              <tr>
                <th scope="col">原版行</th>
                <th scope="col">新版行</th>
                <th scope="col">標記與內容</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr className={`text-diff-row text-diff-${row.kind}`} key={index}>
                  <td>{row.originalLine ?? '—'}</td>
                  <td>{row.revisedLine ?? '—'}</td>
                  <td>
                    <span className="text-diff-kind">{textDiffLabels[row.kind]}</span>
                    {/^\s*$/u.test(row.text) && (
                      <span className="text-diff-blank">
                        {row.text === ''
                          ? '空白行（0 字元）'
                          : `空白行（${Array.from(row.text).length} 個空白字元）`}
                      </span>
                    )}
                    <span className="text-diff-content" dir="auto">
                      {row.text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="text-diff-actions">
          <CopyAction
            key={copyVersion}
            text={result.text}
            disabled={!canExport}
            label="複製完整報告"
          />
          <div>
            <button
              type="button"
              className="button button-secondary"
              disabled={!canExport}
              onClick={downloadReport}
            >
              <Download size={17} aria-hidden="true" />
              下載 TXT
            </button>
            <p className="text-diff-download-status" role="status">
              {downloadStatus}
            </p>
          </div>
        </div>
        <details className="text-diff-report">
          <summary>查看可選取的完整報告</summary>
          <label className="tool-field" htmlFor="text-diff-report">
            <span>完整報告文字</span>
            <textarea
              id="text-diff-report"
              rows={8}
              readOnly
              value={result.text}
              spellCheck={false}
              placeholder="比對後可在這裡選取完整報告"
            />
          </label>
        </details>
        <p className="text-diff-note">
          複製與 TXT 使用同一份完整報告，包含統計、標記、兩側行號及每行原文。TXT 為
          UTF-8，換行統一使用 LF。
        </p>
      </section>

      <aside className="text-diff-rules" aria-label="文字比對規則">
        <h2>逐行核對，保留每個差異</h2>
        <p>
          只將 CRLF／CR 換行統一為 LF；首尾與內部空白、大小寫、全半形、前導零及不同 Unicode
          表示都嚴格比對，不自動修正文句。
        </p>
        <p>
          依前後順序保留最多相同行；重複行有多種對齊方式時，優先刪除原版行。替換及重排顯示為刪除與新增，不標示移動，也不做逐字差異或法律判斷。
        </p>
      </aside>
    </ToolPage>
  );
}
