import { useMemo, useState } from 'react';
import { Download, Eraser, FileText } from 'lucide-react';
import { cleanupList } from '../../features/tools/listCleanup';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './list-cleanup.css';

const sampleList = '  甲公司\n乙公司\n\n甲公司\n丙公司  \n乙公司';

export function ListCleanupTool() {
  const [input, setInput] = useState('');
  const [copyVersion, setCopyVersion] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const result = useMemo(() => cleanupList(input), [input]);
  const canExport = result.valid && result.keptRows > 0;

  function updateInput(value: string) {
    setInput(value);
    setCopyVersion((version) => version + 1);
    setDownloadStatus('');
  }

  function downloadList() {
    if (!canExport) return;
    setDownloadStatus('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = '清單整理.txt';
      document.body.appendChild(link);
      link.click();
      setDownloadStatus('已產生 TXT，請查看瀏覽器下載。');
    } catch {
      setDownloadStatus('無法產生 TXT，請重試，或直接複製整理後清單。');
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
      title="清單整理與去重"
      description="貼上多行清單，去除首尾空白、空白行與重複項目，保留第一次出現的順序。"
    >
      <dl className="list-cleanup-stats" aria-label="清單整理統計" aria-live="polite">
        <div>
          <dt>輸入行</dt>
          <dd>{result.valid ? result.inputRows.toLocaleString('zh-TW') : '—'}</dd>
        </div>
        <div>
          <dt>保留項目</dt>
          <dd>{result.valid ? result.keptRows.toLocaleString('zh-TW') : '—'}</dd>
        </div>
        <div>
          <dt>移除空行</dt>
          <dd>{result.valid ? result.blankRows.toLocaleString('zh-TW') : '—'}</dd>
        </div>
        <div>
          <dt>移除重複行</dt>
          <dd>{result.valid ? result.duplicateRows.toLocaleString('zh-TW') : '—'}</dd>
        </div>
      </dl>

      <div className="list-cleanup-layout">
        <section
          className="tool-form list-cleanup-input-panel"
          aria-labelledby="list-cleanup-input-title"
        >
          <h2 className="numbered-title" id="list-cleanup-input-title">
            <span>01</span>貼上清單
          </h2>
          <label className="tool-field" htmlFor="list-cleanup-input">
            <span>原始清單</span>
            <textarea
              id="list-cleanup-input"
              className="list-cleanup-textarea"
              value={input}
              rows={12}
              placeholder={'每行一個項目，例如：\n甲公司\n乙公司\n甲公司'}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-describedby={`list-cleanup-limits${result.valid ? '' : ' list-cleanup-error'}`}
              aria-invalid={!result.valid}
              onChange={(event) => updateInput(event.target.value)}
            />
          </label>
          <p className="list-cleanup-note" id="list-cleanup-limits">
            上限 100,000 個字元（依 Unicode 碼點計算）、5,000
            行；最後一個換行也會多計一行。超過上限時整份暫停整理，原文保留。
          </p>
          {!result.valid && (
            <p className="list-cleanup-error" id="list-cleanup-error" role="alert">
              {result.error}
            </p>
          )}
          <div className="list-cleanup-input-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                if (input !== '' && !window.confirm('載入範例會取代目前的原始清單，確定繼續？'))
                  return;
                updateInput(sampleList);
              }}
            >
              <FileText size={17} aria-hidden="true" />
              載入範例
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={input === ''}
              onClick={() => {
                if (window.confirm('確定清空原始清單與整理結果？')) updateInput('');
              }}
            >
              <Eraser size={17} aria-hidden="true" />
              清空
            </button>
          </div>
          <SessionNote />
        </section>

        <section
          className="tool-result list-cleanup-output-panel"
          aria-labelledby="list-cleanup-output-title"
        >
          <h2 className="list-cleanup-output-title" id="list-cleanup-output-title">
            整理結果
          </h2>
          <label className="tool-field" htmlFor="list-cleanup-output">
            <span>整理後清單</span>
            <textarea
              id="list-cleanup-output"
              className="list-cleanup-textarea"
              value={result.text}
              rows={12}
              readOnly
              spellCheck={false}
              placeholder="整理後的項目會顯示在這裡"
              aria-describedby="list-cleanup-result-note"
            />
          </label>
          <p className="list-cleanup-note" id="list-cleanup-result-note">
            {!result.valid
              ? '請先縮短原始清單，符合上限後會重新整理。'
              : input === ''
                ? '貼上清單即可即時整理，原始內容不會被覆寫。'
                : result.keptRows === 0
                  ? '目前只有空白，沒有可複製或下載的項目。'
                  : `已保留 ${result.keptRows.toLocaleString('zh-TW')} 個項目，依第一次出現的順序排列。`}
          </p>
          <div className="list-cleanup-output-actions">
            <CopyAction
              key={copyVersion}
              text={result.text}
              disabled={!canExport}
              label="複製整理後清單"
            />
            <div className="list-cleanup-download-action">
              <button
                type="button"
                className="button button-secondary"
                disabled={!canExport}
                onClick={downloadList}
              >
                <Download size={17} aria-hidden="true" />
                下載 TXT
              </button>
              <p className="list-cleanup-download-status" role="status">
                {downloadStatus}
              </p>
            </div>
          </div>
          <p className="list-cleanup-note">TXT 使用 UTF-8，只包含整理後清單，每行一個項目。</p>
        </section>
      </div>

      <aside className="list-cleanup-rules" aria-label="整理規則">
        <h2>哪些內容會被視為重複？</h2>
        <p>
          先去掉每行首尾空白，再比對整行文字是否完全相同。大小寫、全半形、前導零、內部空白與不同
          Unicode 表示都維持原樣，例如「ABC」與「abc」、「001」與「1」會各自保留。
        </p>
        <p>逗號和引號視為一般文字，不解析 CSV、不判斷名稱是否相同，也不重新排序。</p>
      </aside>
    </ToolPage>
  );
}
