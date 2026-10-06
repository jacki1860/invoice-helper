import { useMemo, useState } from 'react';
import { Download, Eraser, FileText } from 'lucide-react';
import { compareLists, listCompareGroups } from '../../features/tools/listCompare';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './list-compare.css';

const sample = {
  a: '  投影機\nHDMI 線\n延長線\n\nHDMI 線\n麥克風',
  b: '麥克風\n投影機\nHDMI 線\n轉接頭\nHDMI 線',
};

export function ListCompareTool() {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [copyVersion, setCopyVersion] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const result = useMemo(() => compareLists(inputA, inputB), [inputA, inputB]);
  const hasInput = inputA !== '' || inputB !== '';
  const canExport = result.valid && result.text !== '';

  function updateInputs(a: string, b: string) {
    setInputA(a);
    setInputB(b);
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
      link.download = '雙清單比對.txt';
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
      title="雙清單比對"
      description="貼上預定與實際清單，找出缺漏、共有與額外項目。每項只計一次，清單順序不同也能核對。"
    >
      <section className="list-compare-inputs" aria-label="預定與實際清單">
        {(
          [
            ['a', 'A：預定清單', inputA],
            ['b', 'B：實際清單', inputB],
          ] as const
        ).map(([side, label, value], index) => {
          const error = result.valid ? undefined : result.errors[side];
          const stats = result.valid ? result[side] : undefined;
          return (
            <div className="tool-form list-compare-input-panel" key={side}>
              <h2 className="numbered-title">
                <span>0{index + 1}</span>
                {label}
              </h2>
              <label className="tool-field" htmlFor={`list-compare-${side}`}>
                <span>{label}（每行一個項目）</span>
                <textarea
                  id={`list-compare-${side}`}
                  className="list-compare-textarea"
                  value={value}
                  rows={9}
                  placeholder={
                    side === 'a'
                      ? '例如：預定交付的器材\n投影機\nHDMI 線\n延長線'
                      : '例如：實際收到的器材\n投影機\nHDMI 線\n轉接頭'
                  }
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-invalid={Boolean(error)}
                  aria-describedby={`list-compare-limits${error ? ` list-compare-${side}-error` : ''}`}
                  onChange={(event) =>
                    side === 'a'
                      ? updateInputs(event.target.value, inputB)
                      : updateInputs(inputA, event.target.value)
                  }
                />
              </label>
              {error && (
                <p className="list-compare-error" id={`list-compare-${side}-error`} role="alert">
                  {error}
                </p>
              )}
              <dl className="list-compare-input-stats" aria-label={`${label}統計`}>
                {[
                  ['輸入行', stats?.inputRows],
                  ['不重複項目', stats?.keptRows],
                  ['移除空行', stats?.blankRows],
                  ['移除重複行', stats?.duplicateRows],
                ].map(([name, count]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{count === undefined ? '—' : count.toLocaleString('zh-TW')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </section>
      <p className="list-compare-note" id="list-compare-limits">
        每欄上限 100,000 個 Unicode 碼點、5,000 行，依輸入框內文字計算；瀏覽器會先統一換行。
        空字串為 0 行，最後換行會多計一行。任一欄超限即暫停全部結果，原文保留。
      </p>
      <div className="list-compare-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            if (hasInput && !window.confirm('載入範例會取代目前的兩份清單，確定繼續？')) return;
            updateInputs(sample.a, sample.b);
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
            if (window.confirm('確定清空兩份清單與比對結果？')) updateInputs('', '');
          }}
        >
          <Eraser size={17} aria-hidden="true" />
          清空雙欄
        </button>
      </div>
      <SessionNote />
      <p className="list-compare-note">
        清單不會上傳；在站內切換工具可保留本次內容，重新整理即清空。
      </p>

      <section className="list-compare-results" aria-labelledby="list-compare-result-title">
        <h2 id="list-compare-result-title">三組比對結果</h2>
        <p className="list-compare-note" role="status">
          {!result.valid
            ? '請先修正超限的清單；全部結果已暫停，沒有可複製或下載的內容。'
            : !hasInput
              ? '貼上至少一份清單即可比對；單邊留空時，項目會全部列入另一側。'
              : !canExport
                ? '目前只有空白，沒有可比對、複製或下載的項目。'
                : result.onlyA.length === 0 && result.onlyB.length === 0
                  ? '兩份清單的項目相同；順序與重複次數不影響比對結果。'
                  : `只在 A ${result.onlyA.length} 項、雙方都有 ${result.common.length} 項、只在 B ${result.onlyB.length} 項。`}
        </p>
        <div className="list-compare-groups">
          {listCompareGroups.map(({ id, label, description }) => {
            const items = result.valid ? result[id] : [];
            return (
              <section
                className={`tool-result list-compare-group list-compare-${id}`}
                key={id}
                aria-label={label}
              >
                <h3>
                  {label}
                  <span className="list-compare-count">{result.valid ? items.length : '—'} 項</span>
                </h3>
                <p className="list-compare-note">{description}</p>
                <label className="tool-field" htmlFor={`list-compare-${id}`}>
                  <span>{label}清單</span>
                  <textarea
                    id={`list-compare-${id}`}
                    className="list-compare-textarea"
                    rows={7}
                    readOnly
                    value={items.join('\n')}
                    spellCheck={false}
                    placeholder={
                      !result.valid
                        ? '全部結果暫停'
                        : canExport
                          ? '這組沒有項目'
                          : '比對後的項目會顯示在這裡'
                    }
                  />
                </label>
                <CopyAction
                  key={`${copyVersion}-${id}`}
                  text={items.join('\n')}
                  disabled={!canExport || items.length === 0}
                  label={`複製${label}`}
                />
              </section>
            );
          })}
        </div>
        <div className="list-compare-actions">
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
            <p className="list-compare-download-status" role="status">
              {downloadStatus}
            </p>
          </div>
        </div>
        <details className="list-compare-report">
          <summary>查看可選取的完整報告</summary>
          <label className="tool-field" htmlFor="list-compare-report">
            <span>完整報告文字</span>
            <textarea
              id="list-compare-report"
              className="list-compare-textarea"
              rows={10}
              readOnly
              value={result.text}
              spellCheck={false}
              placeholder="比對後可在這裡選取完整報告"
            />
          </label>
        </details>
        <p className="list-compare-note">
          完整報告包含規則、兩欄統計及三組清單；複製與 TXT 內容相同。TXT 使用 UTF-8 與 LF
          換行，單組複製只含該組項目。
        </p>
      </section>

      <aside className="list-compare-rules" aria-label="雙清單比對規則">
        <h2>比較項目是否存在，忽略清單順序</h2>
        <p>
          先去除每行首尾空白與空行，同欄重複項目只計一次。大小寫、全半形、前導零、內部空白與不同
          Unicode 表示都精確區分，不做模糊比對或文字正規化。
        </p>
        <p>
          「只在 A」與「雙方都有」依 A 第一次出現的順序排列；「只在 B」依 B
          第一次出現的順序排列。逗號與引號視為一般文字，每行是一個完整項目，不解析
          CSV，也不計算數量差異。
        </p>
      </aside>
    </ToolPage>
  );
}
