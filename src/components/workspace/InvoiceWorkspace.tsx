import { useEffect, useRef, useState } from 'react';
import { Copy, Download, RotateCcw, LoaderCircle } from 'lucide-react';
import { calculateInvoice, type InvoiceLineInput } from '../../domain/invoice';
import {
  emptyLine,
  exampleDraft,
  hasEnteredData,
  type InvoiceDraft,
} from '../../features/invoice/draft';
import { isValidInvoiceDate } from '../../utils/dateUtils';
import { downloadInvoice, invoiceText } from '../../utils/exportInvoice';
import { CompanyFields } from './CompanyFields';
import { PricingControls } from './PricingControls';
import { InvoiceLines } from './InvoiceLines';
import { InvoiceDocument } from './InvoiceDocument';
import { formatMoney, Totals } from './Totals';

interface Props {
  draft: InvoiceDraft;
  onChange: (draft: InvoiceDraft) => void;
  onPatch: (patch: Partial<InvoiceDraft>) => void;
}

export function InvoiceWorkspace({ draft, onChange, onPatch }: Props) {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [deletedLine, setDeletedLine] = useState<{ line: InvoiceLineInput; index: number } | null>(
    null,
  );
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const exportRef = useRef<HTMLDivElement>(null);
  const calculation = calculateInvoice(draft.lines, draft.priceMode, draft.taxType);
  const canExport =
    calculation.valid &&
    isValidInvoiceDate(draft.date) &&
    (!draft.uniformNumber || /^\d{8}$/.test(draft.uniformNumber));

  useEffect(() => {
    if (focusLine) {
      document.getElementById(`line-${focusLine}`)?.focus();
      setFocusLine(null);
    }
  }, [focusLine]);

  const loadExample = () => {
    onChange(exampleDraft());
    setDeletedLine(null);
    setSelectedLine(null);
    setNotice('已載入範例，可直接修改欄位。');
    setError('');
    setShowReplace(false);
  };

  const updateLine = (id: string, patch: Partial<InvoiceLineInput>) => {
    onPatch({ lines: draft.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)) });
    setNotice('');
    setError('');
  };

  const addLine = () => {
    const line = emptyLine();
    onPatch({ lines: [...draft.lines, line] });
    setSelectedLine(line.id);
    setFocusLine(line.id);
    setNotice('');
  };

  const deleteLine = (id: string) => {
    const index = draft.lines.findIndex((line) => line.id === id);
    if (index === -1) return;
    setDeletedLine({ line: draft.lines[index], index });
    onPatch({ lines: draft.lines.filter((line) => line.id !== id) });
    setSelectedLine(null);
    setNotice('');
    setError('');
  };

  const undoDelete = () => {
    if (!deletedLine) return;
    const lines = [...draft.lines];
    lines.splice(Math.min(deletedLine.index, lines.length), 0, deletedLine.line);
    onPatch({ lines });
    setFocusLine(deletedLine.line.id);
    setDeletedLine(null);
  };

  const download = async () => {
    if (!canExport || !exportRef.current || downloading) return;
    setDownloading(true);
    setError('');
    setNotice('正在製作預覽圖片…');
    try {
      await downloadInvoice(
        exportRef.current,
        `發票預覽_${draft.uniformNumber || '未填統編'}_${draft.date}.png`,
      );
      setNotice('PNG 已產生，請在瀏覽器下載項目中查看。');
    } catch {
      setNotice('');
      setError('圖片未能產生，請重試。你的填寫內容仍保留在此頁。');
    } finally {
      setDownloading(false);
    }
  };

  const copy = async () => {
    if (!canExport) return;
    setError('');
    try {
      await navigator.clipboard.writeText(invoiceText(draft, calculation));
      setNotice('已複製品項與金額明細。');
    } catch {
      setNotice('');
      setError('瀏覽器未允許複製。請允許剪貼簿存取後重試，或下載 PNG。');
    }
  };

  return (
    <div className={`workspace invoice-workspace mobile-${mobileView}`}>
      <div className="mobile-workspace-switch" role="group" aria-label="發票視圖">
        <button aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>
          填寫
        </button>
        <button aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>
          預覽
        </button>
        <span>NT$ {calculation.valid ? formatMoney(calculation.amount) : '—'}</span>
      </div>
      <div className="editor-panel">
        <div className="workspace-heading">
          <div>
            <h1>發票填寫助手</h1>
            <p className="lead">把品項填好，讓數字自己就位。</p>
          </div>
          <button
            className="button button-quiet sample-button"
            onClick={() => (hasEnteredData(draft) ? setShowReplace(true) : loadExample())}
          >
            <Download size={17} strokeWidth={1.6} />
            載入範例
          </button>
        </div>
        {showReplace && (
          <div className="replace-confirm" role="alertdialog" aria-label="載入範例確認">
            <p>載入範例會取代目前表單。要繼續嗎？</p>
            <div>
              <button className="button button-small button-primary" onClick={loadExample}>
                取代為範例
              </button>
              <button
                className="button button-small button-quiet"
                onClick={() => setShowReplace(false)}
              >
                保留目前內容
              </button>
            </div>
          </div>
        )}
        <section className="editor-section" aria-labelledby="basic-heading">
          <div className="section-heading">
            <h2 id="basic-heading">
              <span>01</span>基本資料
            </h2>
          </div>
          <CompanyFields draft={draft} onPatch={onPatch} />
        </section>
        <section className="editor-section items-section" aria-labelledby="items-heading">
          <div className="section-heading items-heading">
            <h2 id="items-heading">
              <span>02</span>品項明細
            </h2>
            <PricingControls
              id="invoice"
              priceMode={draft.priceMode}
              taxType={draft.taxType}
              onModeChange={(priceMode) => {
                onPatch({ priceMode });
                setNotice('已依目前單價重新計算；切換輸入方式不會改寫單價。');
              }}
              onTaxChange={(taxType) => onPatch({ taxType })}
            />
          </div>
          <InvoiceLines
            lines={draft.lines}
            calculation={calculation}
            priceMode={draft.priceMode}
            selectedLine={selectedLine}
            onSelect={setSelectedLine}
            onChange={updateLine}
            onAdd={addLine}
            onDelete={deleteLine}
          />
          {deletedLine && (
            <div className="undo-notice" role="status">
              <span>已刪除「{deletedLine.line.name || '未命名品項'}」</span>
              <button className="text-button" onClick={undoDelete}>
                <RotateCcw size={14} />
                復原
              </button>
            </div>
          )}
        </section>
        <Totals {...calculation} invalid={!calculation.valid} />
        <div className="export-actions">
          <button
            className="button button-primary"
            disabled={!canExport || downloading}
            onClick={download}
          >
            {downloading ? (
              <LoaderCircle size={20} className="spin" />
            ) : (
              <Download size={20} strokeWidth={1.7} />
            )}
            {downloading ? '製作圖片中' : '下載 PNG'}
          </button>
          <button className="button button-quiet" disabled={!canExport} onClick={copy}>
            <Copy size={18} strokeWidth={1.7} />
            複製明細
          </button>
        </div>
        <div className="action-status" aria-live="polite">
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : notice ? (
            <p>{notice}</p>
          ) : !canExport ? (
            <p>填妥品名、數量、單價與日期後，即可下載或複製。</p>
          ) : null}
        </div>
        <footer className="workspace-footer">
          <p>表單僅留在本次頁面，重新整理後不保留。</p>
          <p>
            公司查詢會將統編送至{' '}
            <a href="https://company.g0v.ronny.tw/" target="_blank" rel="noreferrer">
              台灣公司資料
            </a>
            。
          </p>
        </footer>
      </div>
      <aside className="preview-stage">
        <h2 className="preview-heading">發票預覽</h2>
        <InvoiceDocument draft={draft} calculation={calculation} selectedLine={selectedLine} />
        <p className="preview-caption">預覽僅供填寫參考，非正式電子發票。</p>
        <button
          className="button button-primary mobile-download"
          disabled={!canExport || downloading}
          onClick={download}
        >
          <Download size={18} />
          {downloading ? '製作圖片中' : '下載 PNG'}
        </button>
        <div className="action-status mobile-export-status" aria-live="polite">
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : notice ? (
            <p>{notice}</p>
          ) : !canExport ? (
            <p>請先回到填寫頁，完成品項與日期。</p>
          ) : null}
        </div>
      </aside>
      <div className="export-surface" aria-hidden="true">
        <div ref={exportRef}>
          <InvoiceDocument draft={draft} calculation={calculation} />
        </div>
      </div>
    </div>
  );
}
