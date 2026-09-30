import { useRef, useState } from 'react';
import { Download, Printer, RotateCcw } from 'lucide-react';
import {
  type BusinessDocumentDraft,
  documentResult,
  businessDocumentText,
  hasBusinessDocumentContent,
} from '../../features/tools/documents';
import { emptyLine } from '../../features/invoice/draft';
import { getTaiwanDate } from '../../utils/dateUtils';
import { formatChineseAmountText } from '../../utils/numberUtils';
import { downloadInvoice } from '../../utils/exportInvoice';
import { InvoiceLines } from '../workspace/InvoiceLines';
import { PricingControls, taxLabels } from '../workspace/PricingControls';
import { Totals, formatMoney } from '../workspace/Totals';
import { ToolPage, SessionNote } from './ToolPage';
import { CopyAction } from './CopyAction';

function emptyDocument(): BusinessDocumentDraft {
  return {
    kind: 'quote',
    issuer: '',
    issuerNumber: '',
    issuerContact: '',
    customer: '',
    customerNumber: '',
    number: '',
    date: getTaiwanDate(),
    dueDate: '',
    paymentDetails: '',
    notes: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [emptyLine()],
  };
}

export function DocumentBuilder() {
  const [draft, setDraft] = useState(emptyDocument);
  const [initialDate] = useState(getTaiwanDate);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState<{
    line: BusinessDocumentDraft['lines'][number];
    index: number;
  } | null>(null);
  const paper = useRef<HTMLDivElement>(null);
  const { calculation, errors, valid } = documentResult(draft);
  const title = draft.kind === 'quote' ? '報價單' : '請款單';
  const patch = (update: Partial<BusinessDocumentDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setStatus('');
  };
  const sample = () => {
    if (
      hasBusinessDocumentContent(draft, initialDate) &&
      !window.confirm('載入範例會取代目前文件內容。確定取代？')
    )
      return;
    setDraft({
      ...emptyDocument(),
      kind: draft.kind,
      issuer: '小事務工作室',
      customer: '範例客戶',
      number: draft.kind === 'quote' ? 'QT-001' : 'PAY-001',
      paymentDetails: '確認後依約定方式付款。',
      notes: '此為示範內容，請依實際合作條件修改。',
      lines: [
        { ...emptyLine(), name: '設計服務', quantity: '1', unitPrice: '10000' },
        { ...emptyLine(), name: '印刷製作', quantity: '2', unitPrice: '500' },
      ],
    });
    setAttempted(false);
    setDeleted(null);
    setStatus('已載入範例。');
  };
  const exportPng = async () => {
    setAttempted(true);
    if (!valid || !paper.current || busy) return;
    setBusy(true);
    setStatus('正在製作圖片…');
    try {
      await downloadInvoice(paper.current, `${title}_${draft.date}.png`);
      setStatus('PNG 已產生，請查看瀏覽器下載項目。');
    } catch {
      setStatus('圖片製作失敗，請稍後重試，或使用列印／另存 PDF。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolPage title="報價與請款單" description="把合作內容整理好，交給對方一份清楚的文件。">
      <div className="document-workspace">
        <div className="document-editor">
          <div className="document-type-row">
            <div className="tab-buttons" role="group" aria-label="文件類型">
              <button
                aria-pressed={draft.kind === 'quote'}
                onClick={() => patch({ kind: 'quote' })}
              >
                報價單
              </button>
              <button
                aria-pressed={draft.kind === 'payment'}
                onClick={() => patch({ kind: 'payment' })}
              >
                請款單
              </button>
            </div>
            <button className="text-button" onClick={sample}>
              <RotateCcw size={16} />
              載入文件範例
            </button>
          </div>
          <h2 className="numbered-title">
            <span>01</span>雙方資料
          </h2>
          <div className="tool-form-grid">
            <label className="tool-field">
              <span>開立方 *</span>
              <input
                value={draft.issuer}
                maxLength={100}
                placeholder="公司、工作室或姓名"
                onChange={(event) => patch({ issuer: event.target.value })}
              />
            </label>
            <label className="tool-field">
              <span>開立方統編（選填）</span>
              <input
                value={draft.issuerNumber}
                inputMode="numeric"
                maxLength={8}
                onChange={(event) => patch({ issuerNumber: event.target.value })}
              />
            </label>
            <label className="tool-field">
              <span>客戶名稱 *</span>
              <input
                value={draft.customer}
                maxLength={100}
                onChange={(event) => patch({ customer: event.target.value })}
              />
            </label>
            <label className="tool-field">
              <span>客戶統編（選填）</span>
              <input
                value={draft.customerNumber}
                inputMode="numeric"
                maxLength={8}
                onChange={(event) => patch({ customerNumber: event.target.value })}
              />
            </label>
          </div>
          <label className="tool-field">
            <span>聯絡資訊（選填）</span>
            <input
              value={draft.issuerContact}
              maxLength={150}
              placeholder="電話、Email 或地址"
              onChange={(event) => patch({ issuerContact: event.target.value })}
            />
          </label>
          <div className="tool-form-grid">
            <label className="tool-field">
              <span>文件編號（選填）</span>
              <input
                value={draft.number}
                maxLength={40}
                placeholder="例如 QT-001"
                onChange={(event) => patch({ number: event.target.value })}
              />
            </label>
            <label className="tool-field">
              <span>文件日期 *</span>
              <input
                type="date"
                value={draft.date}
                min="0001-01-01"
                max="9999-12-31"
                onChange={(event) => patch({ date: event.target.value })}
              />
            </label>
            <label className="tool-field">
              <span>{draft.kind === 'quote' ? '報價有效期限' : '付款期限'}（選填）</span>
              <input
                type="date"
                value={draft.dueDate}
                min={draft.date || '0001-01-01'}
                max="9999-12-31"
                onChange={(event) => patch({ dueDate: event.target.value })}
              />
            </label>
          </div>
          <div className="document-lines-heading">
            <h2 className="numbered-title">
              <span>02</span>品項與金額
            </h2>
            <PricingControls
              id="business-document"
              priceMode={draft.priceMode}
              taxType={draft.taxType}
              onModeChange={(priceMode) => {
                patch({ priceMode });
                setStatus('已依目前單價重新計算；切換模式不會換算單價。');
              }}
              onTaxChange={(taxType) => patch({ taxType })}
            />
          </div>
          <InvoiceLines
            caption="文件品項，可以直接編輯每個欄位"
            lines={draft.lines}
            calculation={calculation}
            priceMode={draft.priceMode}
            selectedLine={selectedLine}
            onSelect={setSelectedLine}
            onChange={(id, update) =>
              patch({
                lines: draft.lines.map((line) => (line.id === id ? { ...line, ...update } : line)),
              })
            }
            onAdd={() => patch({ lines: [...draft.lines, emptyLine()] })}
            onDelete={(id) => {
              const index = draft.lines.findIndex((line) => line.id === id);
              setDeleted({ line: draft.lines[index], index });
              patch({ lines: draft.lines.filter((line) => line.id !== id) });
            }}
          />
          {deleted && (
            <button
              className="text-button document-undo"
              onClick={() => {
                const lines = [...draft.lines];
                lines.splice(deleted.index, 0, deleted.line);
                patch({ lines });
                setDeleted(null);
              }}
            >
              復原最近刪除的品項
            </button>
          )}
          <Totals {...calculation} invalid={!calculation.valid} />
          <label className="tool-field">
            <span>付款資訊／付款條件（選填）</span>
            <textarea
              value={draft.paymentDetails}
              maxLength={500}
              rows={3}
              placeholder="付款方式、匯款資訊或約定條件"
              onChange={(event) => patch({ paymentDetails: event.target.value })}
            />
          </label>
          <label className="tool-field">
            <span>備註（選填）</span>
            <textarea
              value={draft.notes}
              maxLength={1000}
              rows={3}
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </label>
          {(attempted || draft.issuer || draft.customer) && errors.length > 0 && (
            <ul className="document-errors field-error" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <div className="document-actions">
            <button className="button button-primary" disabled={!valid || busy} onClick={exportPng}>
              <Download size={18} />
              {busy ? '製作圖片中' : '下載文件 PNG'}
            </button>
            <button
              className="button button-secondary"
              disabled={!valid || busy}
              onClick={() => window.print()}
            >
              <Printer size={18} />
              列印／另存 PDF
            </button>
          </div>
          <p className="action-status" role="status">
            {status ||
              (!valid
                ? '填妥開立方、客戶、有效日期與品項後，即可匯出。'
                : '列印視窗可選擇另存為 PDF；此文件非統一發票。')}
          </p>
          <CopyAction text={businessDocumentText(draft)} label="複製文件文字" />
          <SessionNote />
        </div>
        <aside className="document-preview-stage" aria-label="文件預覽">
          <p className="document-preview-label">文件預覽</p>
          <div ref={paper} className="business-paper document-print-target">
            <header>
              <p className="business-issuer">{draft.issuer || '開立方名稱'}</p>
              <h2>{title}</h2>
              <p className="business-contact">{draft.issuerContact}</p>
            </header>
            <div className="business-details">
              <div>
                <span>致</span>
                <strong>{draft.customer || '客戶名稱'}</strong>
                {draft.customerNumber && <p>統編：{draft.customerNumber}</p>}
              </div>
              <dl>
                <div>
                  <dt>文件編號</dt>
                  <dd>{draft.number || '—'}</dd>
                </div>
                <div>
                  <dt>日期</dt>
                  <dd>{draft.date || '—'}</dd>
                </div>
                {draft.dueDate && (
                  <div>
                    <dt>{draft.kind === 'quote' ? '有效至' : '付款期限'}</dt>
                    <dd>{draft.dueDate}</dd>
                  </div>
                )}
                {draft.issuerNumber && (
                  <div>
                    <dt>開立方統編</dt>
                    <dd>{draft.issuerNumber}</dd>
                  </div>
                )}
              </dl>
            </div>
            <table className="business-line-table">
              <thead>
                <tr>
                  <th>品項</th>
                  <th>數量</th>
                  <th>單價{draft.priceMode === 'total' ? '（含稅）' : '（未稅）'}</th>
                  <th>金額</th>
                </tr>
              </thead>
              <tbody>
                {calculation.lines.length ? (
                  calculation.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.name || '品名待填'}</td>
                      <td>{line.quantity}</td>
                      <td>
                        {line.unitPrice.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}
                      </td>
                      <td>{formatMoney(line.inputAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="business-empty">
                      填入品項後，內容會出現在這裡。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <dl className="business-totals">
              <div>
                <dt>未稅金額</dt>
                <dd>{calculation.valid ? formatMoney(calculation.subtotal) : '—'}</dd>
              </div>
              <div>
                <dt>{taxLabels[draft.taxType]}</dt>
                <dd>{calculation.valid ? formatMoney(calculation.tax) : '—'}</dd>
              </div>
              <div className="business-grand-total">
                <dt>總計 NT$</dt>
                <dd>{calculation.valid ? formatMoney(calculation.amount) : '—'}</dd>
              </div>
            </dl>
            <p className="business-chinese">
              {calculation.valid ? formatChineseAmountText(calculation.amount) : '金額待填'}
            </p>
            {draft.paymentDetails && (
              <section className="business-notes">
                <h3>付款資訊／條件</h3>
                <p>{draft.paymentDetails}</p>
              </section>
            )}
            {draft.notes && (
              <section className="business-notes">
                <h3>備註</h3>
                <p>{draft.notes}</p>
              </section>
            )}
            <footer>
              本文件非統一發票。
              {draft.kind === 'quote'
                ? '合作內容與條件請由雙方確認。'
                : '實際付款與發票開立請另行確認。'}
            </footer>
          </div>
        </aside>
      </div>
    </ToolPage>
  );
}
