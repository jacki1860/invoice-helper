import { useRef, useState, type RefObject, type ReactNode } from 'react';
import { Download, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import type {
  InvoiceCalculation,
  InvoiceLineInput,
  PriceMode,
  TaxType,
} from '../../domain/invoice';
import { emptyLine } from '../../features/invoice/draft';
import type { ReceiptSeed, ToolHandoff } from '../../features/tools/handoff';
import {
  deliveryToAcceptance,
  type AcceptanceSeed,
  type PurchaseSeed,
} from '../../features/tools/workflowHandoff';
import {
  type ReceiptDraft,
  type PurchaseOrderDraft,
  type DeliveryNoteDraft,
  receiptFromSeed,
  receiptResult,
  receiptText,
  purchaseOrderResult,
  purchaseOrderText,
  deliveryNoteResult,
  deliveryNoteText,
  hasReceiptContent,
  hasPurchaseOrderContent,
  hasDeliveryNoteContent,
} from '../../features/tools/tradeDocuments';
import { getTaiwanDate } from '../../utils/dateUtils';
import { downloadInvoice } from '../../utils/exportInvoice';
import { formatChineseAmountText } from '../../utils/numberUtils';
import { PricingControls, taxLabels } from '../workspace/PricingControls';
import { formatMoney, Totals } from '../workspace/Totals';
import { CopyAction } from './CopyAction';
import { ToolPage, SessionNote, SourceNote } from './ToolPage';
import './trade-documents.css';

export function TradeField({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  maxLength = 100,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'amount';
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="tool-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={type === 'date' ? 'date' : 'text'}
          inputMode={type === 'amount' ? 'numeric' : undefined}
          min={type === 'date' ? '0001-01-01' : undefined}
          max={type === 'date' ? '9999-12-31' : undefined}
          maxLength={type === 'amount' ? undefined : maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SampleButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="trade-sample-row">
      <button className="text-button" onClick={onClick}>
        <RotateCcw size={16} /> 載入文件範例
      </button>
    </div>
  );
}

export function TradeErrors({ errors, show }: { errors: string[]; show: boolean }) {
  return show && errors.length ? (
    <ul className="document-errors field-error" role="alert">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  ) : null;
}

export function TradeActions({
  paper,
  title,
  date,
  text,
  valid,
}: {
  paper: RefObject<HTMLDivElement | null>;
  title: string;
  date: string;
  text: string;
  valid: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ documentText: '', message: '' });
  const exportPng = async () => {
    if (!valid || !paper.current || busy) return;
    setBusy(true);
    setStatus({ documentText: text, message: '正在製作圖片…' });
    try {
      await downloadInvoice(paper.current, `${title}_${date}.png`);
      setStatus({ documentText: text, message: 'PNG 已產生，請查看瀏覽器下載項目。' });
    } catch {
      setStatus({
        documentText: text,
        message: '圖片製作失敗，請稍後重試，或使用列印／另存 PDF。',
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
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
        {!valid
          ? '填妥必填資料與有效品項後，即可匯出。'
          : (status.documentText === text && status.message) || '列印視窗可選擇另存為 PDF。'}
      </p>
      <CopyAction text={text} disabled={!valid || busy} label="複製文件文字" />
      <SessionNote />
    </>
  );
}

export function TradePreview({ children }: { children: ReactNode }) {
  return (
    <aside className="document-preview-stage" aria-label="文件預覽">
      <p className="document-preview-label">文件預覽</p>
      {children}
    </aside>
  );
}

export function PaperData({ pairs }: { pairs: [string, string][] }) {
  return (
    <dl className="trade-paper-data">
      {pairs
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function PaperNotes({ title = '備註', text }: { title?: string; text: string }) {
  return text ? (
    <section className="business-notes">
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  ) : null;
}

export function Signatures({ labels }: { labels: string[] }) {
  return (
    <div className="trade-signatures">
      {labels.map((label) => (
        <div key={label}>
          <span>{label}</span>
          <div className="trade-signature-blank" />
        </div>
      ))}
    </div>
  );
}

function emptyReceipt(): ReceiptDraft {
  return {
    payer: '',
    payee: '',
    amount: '',
    purpose: '',
    reference: '',
    date: getTaiwanDate(),
    method: '現金',
    notes: '',
  };
}

export function ReceiptTool({ incoming }: { incoming?: ToolHandoff<ReceiptSeed> }) {
  const [draft, setDraft] = useState(emptyReceipt);
  const [initialDate] = useState(draft.date);
  const [resolvedHandoff, setResolvedHandoff] = useState('');
  const [notice, setNotice] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const { amount, errors, valid } = receiptResult(draft);
  const hasContent = hasReceiptContent(draft, initialDate);
  const patch = (update: Partial<ReceiptDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
  };
  const sample = () => {
    if (hasContent && !window.confirm('載入範例會取代目前收據內容。確定取代？')) return;
    setDraft({
      ...emptyReceipt(),
      payer: '範例商行',
      payee: '小事務工作室',
      amount: '12600',
      purpose: '展場道具製作尾款',
      reference: 'RC-001',
      method: '銀行轉帳',
      notes: '此為示範內容，請依實際收款情形修改。',
    });
    setNotice('已載入範例。');
  };
  return (
    <ToolPage title="收據產生器" description="把實際收到的款項記下來，留一份清楚的收款紀錄。">
      <div className="document-workspace trade-workspace">
        <div className="document-editor">
          {incoming && incoming.id !== resolvedHandoff && (
            <section className="trade-handoff" aria-label="待套用的收據資料">
              <h2>有一筆資料可以帶入</h2>
              <p>
                {incoming.data.payer || '付款人待填'} → {incoming.data.payee || '收款人待填'}，金額{' '}
                {incoming.data.amount || '待填'} 元
              </p>
              <p>套用後請核對實際收款金額、日期與付款方式，再交付收據。</p>
              <div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    if (hasContent && !window.confirm('套用帶入資料會取代目前收據內容。確定取代？'))
                      return;
                    setDraft(receiptFromSeed(incoming.data));
                    setResolvedHandoff(incoming.id);
                    setNotice('已套用帶入資料，請核對實際收款情形。');
                  }}
                >
                  套用帶入資料
                </button>
                <button className="text-button" onClick={() => setResolvedHandoff(incoming.id)}>
                  暫不套用
                </button>
              </div>
            </section>
          )}
          <SampleButton onClick={sample} />
          <h2 className="numbered-title">
            <span>01</span>收款資料
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="付款人 *"
              value={draft.payer}
              onChange={(payer) => patch({ payer })}
            />
            <TradeField
              label="收款人 *"
              value={draft.payee}
              onChange={(payee) => patch({ payee })}
            />
            <TradeField
              label="收款日期 *"
              type="date"
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            <TradeField
              label="收據／對應文件編號（選填）"
              value={draft.reference}
              maxLength={60}
              onChange={(reference) => patch({ reference })}
            />
            <TradeField
              label="實收金額（新臺幣）*"
              type="amount"
              value={draft.amount}
              maxLength={9}
              hint="請填實際收到的整元金額，不一定等於原文件總額。"
              onChange={(receivedAmount) => patch({ amount: receivedAmount })}
            />
            <TradeField
              label="付款方式 *"
              value={draft.method}
              maxLength={60}
              hint="例如現金、銀行轉帳、支票。"
              onChange={(method) => patch({ method })}
            />
          </div>
          <TradeField
            label="收款事由 *"
            multiline
            value={draft.purpose}
            maxLength={500}
            onChange={(purpose) => patch({ purpose })}
          />
          <TradeField
            label="備註（選填）"
            multiline
            value={draft.notes}
            maxLength={1000}
            onChange={(notes) => patch({ notes })}
          />
          <p className="trade-hint">簽章欄會留白，供收款人列印後確認。這份收據不會取代統一發票。</p>
          <TradeErrors errors={errors} show={hasContent} />
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="收據"
            date={draft.date}
            text={receiptText(draft)}
            valid={valid}
          />
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: '營業稅法第 32 條',
                url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=FL006082',
              },
              {
                label: '印花稅法第 5、6、7 條',
                url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=FL006125',
              },
            ]}
          >
            <p>
              本工具記錄實際收款，不代替依法應開立的統一發票。收據是否涉及印花稅，請依憑證性質與免稅規定判斷；此處不計算或代繳印花稅。
            </p>
          </SourceNote>
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper trade-receipt"
            data-valid={valid}
          >
            <header>
              <p className="business-issuer">{draft.payee || '收款人名稱'}</p>
              <h2>收據</h2>
              <p className="trade-paper-kicker">款項收訖紀錄</p>
            </header>
            <PaperData
              pairs={[
                ['收款日期', draft.date || '—'],
                ['收據／對應編號', draft.reference],
                ['付款人', draft.payer || '付款人待填'],
                ['收款人', draft.payee || '收款人待填'],
                ['付款方式', draft.method || '—'],
              ]}
            />
            <div className="trade-receipt-amount">
              <span>實收新臺幣</span>
              <strong>{amount === null ? '金額待填' : `NT$ ${formatMoney(amount)}`}</strong>
              <p>{amount === null ? '中文大寫待填' : formatChineseAmountText(amount)}</p>
            </div>
            <PaperNotes title="收款事由" text={draft.purpose || '收款事由待填'} />
            <PaperNotes text={draft.notes} />
            <Signatures labels={['收款人簽章']} />
            <footer>本收據用於記錄實際收款，非統一發票。</footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}

function TradeLineEditor({
  lines,
  calculation,
  showPrices,
  onChange,
}: {
  lines: InvoiceLineInput[];
  calculation: InvoiceCalculation;
  showPrices: boolean;
  onChange: (lines: InvoiceLineInput[]) => void;
}) {
  const [deleted, setDeleted] = useState<{ line: InvoiceLineInput; index: number } | null>(null);
  const patch = (id: string, update: Partial<InvoiceLineInput>) =>
    onChange(lines.map((line) => (line.id === id ? { ...line, ...update } : line)));
  return (
    <div className="trade-lines-editor">
      {lines.map((line, index) => {
        const errors = ['name', 'quantity', ...(showPrices ? ['unitPrice'] : [])]
          .map((field) => calculation.errors[`${line.id}.${field}`])
          .filter(Boolean);
        const touched = Boolean(line.name || line.unitPrice || line.quantity !== '1');
        return (
          <div className="trade-line-card" key={line.id}>
            <div className="trade-line-title">
              <span>品項 {index + 1}</span>
              <button
                className="icon-button"
                aria-label={`刪除品項 ${index + 1}`}
                onClick={() => {
                  setDeleted({ line, index });
                  onChange(lines.filter((item) => item.id !== line.id));
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className={`trade-line-fields${showPrices ? ' with-prices' : ''}`}>
              <TradeField
                label={`品名 ${index + 1} *`}
                value={line.name}
                onChange={(name) => patch(line.id, { name })}
              />
              <TradeField
                label={`數量 ${index + 1} *`}
                type="amount"
                maxLength={4}
                value={line.quantity}
                onChange={(quantity) => patch(line.id, { quantity })}
              />
              {showPrices && (
                <label className="tool-field">
                  <span>單價 {index + 1} *</span>
                  <input
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => patch(line.id, { unitPrice: event.target.value })}
                  />
                </label>
              )}
            </div>
            {touched && errors.length > 0 && <p className="field-error">{errors.join('；')}</p>}
          </div>
        );
      })}
      <div className="trade-line-actions">
        <button className="button button-outline" onClick={() => onChange([...lines, emptyLine()])}>
          <Plus size={18} />
          新增品項
        </button>
        {deleted && (
          <button
            className="text-button"
            onClick={() => {
              const restored = [...lines];
              restored.splice(deleted.index, 0, deleted.line);
              onChange(restored);
              setDeleted(null);
            }}
          >
            復原最近刪除的品項
          </button>
        )}
      </div>
      {calculation.errors.total && (
        <p className="field-error" role="alert">
          {calculation.errors.total.replace('發票總額', '文件總額')}
        </p>
      )}
    </div>
  );
}

function PaperLines({
  calculation,
  showPrices,
  priceMode,
  taxType,
}: {
  calculation: InvoiceCalculation;
  showPrices: boolean;
  priceMode: PriceMode;
  taxType: TaxType;
}) {
  return (
    <>
      <table
        className={`business-line-table trade-line-table${showPrices ? '' : ' without-prices'}`}
      >
        <thead>
          <tr>
            <th>品項</th>
            <th>數量</th>
            {showPrices && (
              <>
                <th>單價（{priceMode === 'total' ? '含稅' : '未稅'}）</th>
                <th>金額</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {calculation.lines.length ? (
            calculation.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.name || '品名待填'}</td>
                <td>{line.quantity}</td>
                {showPrices && (
                  <>
                    <td>{line.unitPrice.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</td>
                    <td>{formatMoney(line.inputAmount)}</td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showPrices ? 4 : 2} className="business-empty">
                填入品項後，內容會出現在這裡。
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {showPrices && (
        <>
          <dl className="business-totals">
            <div>
              <dt>未稅金額</dt>
              <dd>{calculation.valid ? formatMoney(calculation.subtotal) : '—'}</dd>
            </div>
            <div>
              <dt>{taxLabels[taxType]}</dt>
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
        </>
      )}
    </>
  );
}

function emptyPurchase(): PurchaseOrderDraft {
  return {
    buyer: '',
    supplier: '',
    buyerContact: '',
    supplierContact: '',
    reference: '',
    date: getTaiwanDate(),
    deliveryDate: '',
    deliveryPlace: '',
    notes: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [emptyLine()],
  };
}

export function PurchaseOrderTool({ incoming }: { incoming?: ToolHandoff<PurchaseSeed> }) {
  const [draft, setDraft] = useState(emptyPurchase);
  const [initialDate] = useState(draft.date);
  const [lineEditorVersion, setLineEditorVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const [resolvedHandoff, setResolvedHandoff] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const { calculation, errors, valid } = purchaseOrderResult(draft);
  const hasContent = hasPurchaseOrderContent(draft, initialDate);
  const patch = (update: Partial<PurchaseOrderDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
  };
  const sample = () => {
    if (hasContent && !window.confirm('載入範例會取代目前採購單內容。確定取代？')) return;
    setDraft({
      ...emptyPurchase(),
      buyer: '小事務工作室',
      supplier: '範例材料行',
      buyerContact: '採購窗口：林小姐',
      supplierContact: '業務窗口：陳先生',
      reference: 'PO-001',
      deliveryPlace: '雙方約定的收貨地點',
      notes: '出貨前請先確認交期。此為示範內容，請依實際約定修改。',
      lines: [
        { ...emptyLine(), name: '展示層板', quantity: '6', unitPrice: '1200' },
        { ...emptyLine(), name: '固定五金組', quantity: '12', unitPrice: '85.5' },
      ],
    });
    setNotice('已載入範例。');
    setLineEditorVersion((version) => version + 1);
  };
  return (
    <ToolPage title="採購單產生器" description="列好要買的品項、價格與交貨安排，讓雙方逐項確認。">
      {incoming && incoming.id !== resolvedHandoff && (
        <section className="trade-handoff" aria-label="帶入採購資料">
          <h2>帶入 {incoming.data.supplier} 的報價</h2>
          <p>套用會取代目前採購單，請補上採購方並核對交貨安排與付款條件。</p>
          <div>
            <button
              className="button button-primary"
              onClick={() => {
                if (hasContent && !window.confirm('套用會取代目前採購單內容，確定繼續？')) return;
                setDraft({
                  ...emptyPurchase(),
                  ...incoming.data,
                  lines: incoming.data.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
                });
                setLineEditorVersion((version) => version + 1);
                setResolvedHandoff(incoming.id);
                setNotice('已帶入選定供應商，請補上採購方並確認交貨日期。');
              }}
            >
              確認帶入採購
            </button>
            <button className="text-button" onClick={() => setResolvedHandoff(incoming.id)}>
              略過這次帶入
            </button>
          </div>
        </section>
      )}
      <div className="document-workspace trade-workspace">
        <div className="document-editor">
          <SampleButton onClick={sample} />
          <h2 className="numbered-title">
            <span>01</span>採購與交貨
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="採購方 *"
              value={draft.buyer}
              onChange={(buyer) => patch({ buyer })}
            />
            <TradeField
              label="供應商 *"
              value={draft.supplier}
              onChange={(supplier) => patch({ supplier })}
            />
            <TradeField
              label="採購聯絡資訊（選填）"
              value={draft.buyerContact}
              maxLength={200}
              onChange={(buyerContact) => patch({ buyerContact })}
            />
            <TradeField
              label="供應商聯絡資訊（選填）"
              value={draft.supplierContact}
              maxLength={200}
              onChange={(supplierContact) => patch({ supplierContact })}
            />
            <TradeField
              label="採購日期 *"
              type="date"
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            <TradeField
              label="採購編號（選填）"
              value={draft.reference}
              maxLength={60}
              onChange={(reference) => patch({ reference })}
            />
            <TradeField
              label="預定交貨日期（選填）"
              type="date"
              value={draft.deliveryDate}
              onChange={(deliveryDate) => patch({ deliveryDate })}
            />
            <TradeField
              label="交貨地點（選填）"
              value={draft.deliveryPlace}
              maxLength={300}
              onChange={(deliveryPlace) => patch({ deliveryPlace })}
            />
          </div>
          <h2 className="numbered-title">
            <span>02</span>採購明細
          </h2>
          <PricingControls
            id="purchase-order"
            priceMode={draft.priceMode}
            taxType={draft.taxType}
            onModeChange={(priceMode) => {
              patch({ priceMode });
              setNotice('已依目前單價重新計算；切換模式不會換算單價。');
            }}
            onTaxChange={(taxType) => patch({ taxType })}
          />
          <TradeLineEditor
            key={lineEditorVersion}
            lines={draft.lines}
            calculation={calculation}
            showPrices
            onChange={(lines) => patch({ lines })}
          />
          <Totals {...calculation} invalid={!calculation.valid} />
          <TradeField
            label="採購備註／付款條件（選填）"
            multiline
            value={draft.notes}
            maxLength={1000}
            onChange={(notes) => patch({ notes })}
          />
          <TradeErrors errors={errors} show={hasContent} />
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="採購單"
            date={draft.date}
            text={purchaseOrderText(draft)}
            valid={valid}
          />
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper"
            data-valid={valid}
          >
            <header>
              <p className="business-issuer">{draft.buyer || '採購方名稱'}</p>
              <h2>採購單</h2>
              <p className="trade-paper-kicker">品項與交貨安排</p>
            </header>
            <PaperData
              pairs={[
                ['採購日期', draft.date || '—'],
                ['採購編號', draft.reference],
                ['採購方', draft.buyer || '採購方待填'],
                ['採購聯絡資訊', draft.buyerContact],
                ['供應商', draft.supplier || '供應商待填'],
                ['供應商聯絡資訊', draft.supplierContact],
                ['預定交貨日期', draft.deliveryDate],
                ['交貨地點', draft.deliveryPlace],
              ]}
            />
            <PaperLines
              calculation={calculation}
              showPrices
              priceMode={draft.priceMode}
              taxType={draft.taxType}
            />
            <PaperNotes title="採購備註／付款條件" text={draft.notes} />
            <Signatures labels={['採購方確認', '供應商確認']} />
            <footer>本單記錄採購需求；品項、交期與付款條件請由雙方確認。非統一發票。</footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}

function emptyDelivery(): DeliveryNoteDraft {
  return {
    sender: '',
    recipient: '',
    senderContact: '',
    recipientContact: '',
    reference: '',
    date: getTaiwanDate(),
    address: '',
    notes: '',
    showPrices: false,
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [emptyLine()],
  };
}

export function DeliveryNoteTool({
  onCreateAcceptance,
}: {
  onCreateAcceptance?: (seed: AcceptanceSeed) => void;
}) {
  const [draft, setDraft] = useState(emptyDelivery);
  const [initialDate] = useState(draft.date);
  const [lineEditorVersion, setLineEditorVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const { calculation, errors, valid } = deliveryNoteResult(draft);
  const hasContent = hasDeliveryNoteContent(draft, initialDate);
  const patch = (update: Partial<DeliveryNoteDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
  };
  const sample = () => {
    if (hasContent && !window.confirm('載入範例會取代目前送貨單內容。確定取代？')) return;
    setDraft({
      ...emptyDelivery(),
      sender: '小事務工作室',
      recipient: '範例展覽空間',
      senderContact: '出貨窗口：林小姐',
      recipientContact: '收貨窗口：王先生',
      reference: 'DN-001',
      address: '雙方約定的展場收貨處',
      notes: '請依實際點收情形填寫簽收欄。此為示範內容。',
      lines: [
        { ...emptyLine(), name: '展示層板', quantity: '6', unitPrice: '' },
        { ...emptyLine(), name: '固定五金組', quantity: '12', unitPrice: '' },
      ],
    });
    setNotice('已載入範例。');
    setLineEditorVersion((version) => version + 1);
  };
  return (
    <ToolPage title="送貨／簽收單" description="把送達品項列清楚，留下點收與簽收的位置。">
      <div className="document-workspace trade-workspace">
        <div className="document-editor">
          <SampleButton onClick={sample} />
          <h2 className="numbered-title">
            <span>01</span>送貨資料
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="出貨方 *"
              value={draft.sender}
              onChange={(sender) => patch({ sender })}
            />
            <TradeField
              label="收貨方 *"
              value={draft.recipient}
              onChange={(recipient) => patch({ recipient })}
            />
            <TradeField
              label="出貨聯絡資訊（選填）"
              value={draft.senderContact}
              maxLength={200}
              onChange={(senderContact) => patch({ senderContact })}
            />
            <TradeField
              label="收貨聯絡資訊（選填）"
              value={draft.recipientContact}
              maxLength={200}
              onChange={(recipientContact) => patch({ recipientContact })}
            />
            <TradeField
              label="送貨日期 *"
              type="date"
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            <TradeField
              label="送貨／對應文件編號（選填）"
              value={draft.reference}
              maxLength={60}
              onChange={(reference) => patch({ reference })}
            />
          </div>
          <TradeField
            label="送達地址（選填）"
            value={draft.address}
            maxLength={300}
            onChange={(address) => patch({ address })}
          />
          <h2 className="numbered-title">
            <span>02</span>送貨明細
          </h2>
          <label className="trade-price-toggle">
            <input
              type="checkbox"
              checked={draft.showPrices}
              onChange={(event) => patch({ showPrices: event.target.checked })}
            />
            <span>在送貨單顯示單價與金額</span>
          </label>
          <p className="trade-hint">關閉時只列品名與數量；已填單價會保留，方便之後切回。</p>
          {draft.showPrices && (
            <PricingControls
              id="delivery-note"
              priceMode={draft.priceMode}
              taxType={draft.taxType}
              onModeChange={(priceMode) => {
                patch({ priceMode });
                setNotice('已依目前單價重新計算；切換模式不會換算單價。');
              }}
              onTaxChange={(taxType) => patch({ taxType })}
            />
          )}
          <TradeLineEditor
            key={lineEditorVersion}
            lines={draft.lines}
            calculation={calculation}
            showPrices={draft.showPrices}
            onChange={(lines) => patch({ lines })}
          />
          {draft.showPrices && <Totals {...calculation} invalid={!calculation.valid} />}
          <TradeField
            label="送貨備註（選填）"
            multiline
            value={draft.notes}
            maxLength={1000}
            onChange={(notes) => patch({ notes })}
          />
          <TradeErrors errors={errors} show={hasContent} />
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="送貨簽收單"
            date={draft.date}
            text={deliveryNoteText(draft)}
            valid={valid}
          />
          {onCreateAcceptance && (
            <div className="document-actions">
              <button
                className="button button-secondary"
                disabled={!valid}
                onClick={() => {
                  const seed = deliveryToAcceptance(draft);
                  if (seed) onCreateAcceptance(seed);
                }}
              >
                帶入驗收確認
              </button>
            </div>
          )}
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper"
            data-valid={valid}
          >
            <header>
              <p className="business-issuer">{draft.sender || '出貨方名稱'}</p>
              <h2>送貨／簽收單</h2>
              <p className="trade-paper-kicker">點收後，請於下方簽收</p>
            </header>
            <PaperData
              pairs={[
                ['送貨日期', draft.date || '—'],
                ['送貨／對應編號', draft.reference],
                ['出貨方', draft.sender || '出貨方待填'],
                ['出貨聯絡資訊', draft.senderContact],
                ['收貨方', draft.recipient || '收貨方待填'],
                ['收貨聯絡資訊', draft.recipientContact],
                ['送達地址', draft.address],
              ]}
            />
            <PaperLines
              calculation={calculation}
              showPrices={draft.showPrices}
              priceMode={draft.priceMode}
              taxType={draft.taxType}
            />
            <PaperNotes title="送貨備註" text={draft.notes} />
            <Signatures labels={['送貨人', '收貨人簽章', '簽收日期／時間', '點收情形／差異']} />
            <footer>請於點收時記錄數量與外觀差異。本單非統一發票。</footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
