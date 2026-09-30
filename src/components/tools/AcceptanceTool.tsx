import { useRef, useState } from 'react';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import type { ToolHandoff } from '../../features/tools/handoff';
import type { AcceptanceSeed, QuoteSeed } from '../../features/tools/workflowHandoff';
import {
  acceptanceFromSeed,
  acceptanceResult,
  acceptanceStatusLabels,
  acceptanceText,
  acceptanceToPayment,
  emptyAcceptance,
  hasAcceptanceContent,
  newAcceptanceLine,
  type AcceptanceDraft,
  type AcceptanceLine,
  type AcceptanceStatus,
} from '../../features/tools/acceptance';
import { getTaiwanDate } from '../../utils/dateUtils';
import { formatMoney } from '../workspace/Totals';
import {
  TradeField,
  SampleButton,
  TradeErrors,
  TradeActions,
  TradePreview,
  PaperData,
  PaperNotes,
  Signatures,
} from './TradeDocuments';
import { SourceNote, ToolPage } from './ToolPage';
import './acceptance.css';

export function AcceptanceTool({
  incoming,
  onCreatePayment,
}: {
  incoming?: ToolHandoff<AcceptanceSeed>;
  onCreatePayment?: (seed: QuoteSeed) => void;
}) {
  const [draft, setDraft] = useState(emptyAcceptance);
  const [resolvedHandoff, setResolvedHandoff] = useState('');
  const [notice, setNotice] = useState('');
  const [deleted, setDeleted] = useState<{ line: AcceptanceLine; index: number } | null>(null);
  const paper = useRef<HTMLDivElement>(null);
  const result = acceptanceResult(draft);
  const hasContent = hasAcceptanceContent(draft);
  const patch = (update: Partial<AcceptanceDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
  };
  const patchLine = (id: string, update: Partial<AcceptanceLine>) =>
    patch({ lines: draft.lines.map((line) => (line.id === id ? { ...line, ...update } : line)) });
  const sample = () => {
    if (hasContent && !window.confirm('載入範例會取代目前驗收內容。確定取代？')) return;
    const sampleLines = [
      { id: crypto.randomUUID(), name: '展示層板', quantity: '6', unitPrice: '1200' },
      { id: crypto.randomUUID(), name: '固定五金組', quantity: '12', unitPrice: '85.5' },
    ];
    setDraft({
      ...acceptanceFromSeed({
        issuer: '小事務工作室',
        customer: '範例展覽空間',
        reference: 'QT-001',
        lines: sampleLines,
        pricing: { priceMode: 'subtotal', taxType: 'regular', lines: sampleLines },
      }),
      title: '展示道具交付',
      date: getTaiwanDate(),
      notes: '此為示範內容。請實際檢查每個品項，再選擇驗收結果。',
    });
    setDeleted(null);
    setNotice('已載入範例，各項仍為待驗收。');
  };
  const priceNote = !draft.pricing
    ? '這份資料沒有附帶價格，可到報價／請款單手動填寫金額。'
    : !result.pricingMatches
      ? '目前品項與來源價格資料無法對應，請到報價／請款單重新核對品項及金額。'
      : result.canCreatePayment
        ? '各項已通過，可將原報價資料帶入新的請款單，再核對本次金額與付款條件。'
        : '來源價格資料已保留；填妥資料並逐項選為通過後，才能帶入請款單。';
  return (
    <ToolPage
      title="驗收／結案確認單"
      description="逐項記錄交付檢查，確認完成的部分與需要改善的內容。"
    >
      <div className="document-workspace trade-workspace acceptance-workspace">
        <div className="document-editor">
          {incoming && incoming.id !== resolvedHandoff && (
            <section className="trade-handoff" aria-label="待套用的驗收資料">
              <h2>有 {incoming.data.lines.length} 個交付項目可以帶入</h2>
              <p>
                {incoming.data.issuer || '交付方待填'} → {incoming.data.customer || '驗收方待填'}
              </p>
              <p>套用後各項維持待驗收，請填寫實際驗收日期與逐項結果。</p>
              <div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    if (hasContent && !window.confirm('套用帶入資料會取代目前驗收內容。確定取代？'))
                      return;
                    setDraft(acceptanceFromSeed(incoming.data));
                    setResolvedHandoff(incoming.id);
                    setDeleted(null);
                    setNotice('已套用交付項目，各項仍為待驗收。');
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
            <span>01</span>交付與驗收資料
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="交付方 *"
              value={draft.issuer}
              onChange={(issuer) => patch({ issuer })}
            />
            <TradeField
              label="驗收方 *"
              value={draft.customer}
              onChange={(customer) => patch({ customer })}
            />
            <TradeField
              label="專案／交付名稱（選填）"
              value={draft.title}
              onChange={(title) => patch({ title })}
            />
            <TradeField
              label="對應文件編號（選填）"
              value={draft.reference}
              maxLength={60}
              onChange={(reference) => patch({ reference })}
            />
            <TradeField
              label="驗收日期 *"
              type="date"
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            <TradeField
              label="交付日期（選填）"
              type="date"
              value={draft.deliveryDate}
              onChange={(deliveryDate) => patch({ deliveryDate })}
            />
          </div>
          <h2 className="numbered-title">
            <span>02</span>逐項檢查
          </h2>
          <p className="trade-hint">
            新增或帶入的項目都從待驗收開始；請依實際檢查結果逐項選擇。需要改善時，請寫下要處理的內容。
          </p>
          {draft.lines.map((line, index) => (
            <div className="acceptance-item" key={line.id}>
              <div className="acceptance-item-heading">
                <h3>項目 {index + 1}</h3>
                <button
                  className="icon-button"
                  aria-label={`刪除驗收項目 ${index + 1}`}
                  onClick={() => {
                    setDeleted({ line, index });
                    patch({ lines: draft.lines.filter((item) => item.id !== line.id) });
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="acceptance-item-fields">
                <TradeField
                  label={`品名 ${index + 1} *`}
                  value={line.name}
                  onChange={(name) => patchLine(line.id, { name })}
                />
                <TradeField
                  label={`數量 ${index + 1} *`}
                  type="amount"
                  value={line.quantity}
                  onChange={(quantity) => patchLine(line.id, { quantity })}
                />
                <label className="tool-field">
                  <span>驗收結果 {index + 1} *</span>
                  <select
                    value={line.status}
                    onChange={(event) =>
                      patchLine(line.id, { status: event.target.value as AcceptanceStatus })
                    }
                  >
                    {Object.entries(acceptanceStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <TradeField
                label={`檢查／改善說明 ${index + 1}${line.status === 'needs-fix' ? ' *' : '（選填）'}`}
                multiline
                value={line.improvement}
                maxLength={500}
                onChange={(improvement) => patchLine(line.id, { improvement })}
              />
              {result.lineErrors[line.id] &&
                (line.name || line.status !== 'pending' || line.quantity !== '1') && (
                  <p className="field-error">{result.lineErrors[line.id].join('；')}</p>
                )}
            </div>
          ))}
          <div className="acceptance-item-actions">
            <button
              className="button button-outline"
              onClick={() => patch({ lines: [...draft.lines, newAcceptanceLine()] })}
            >
              <Plus size={18} />
              新增驗收項目
            </button>
            {deleted && (
              <button
                className="text-button"
                onClick={() => {
                  const lines = [...draft.lines];
                  lines.splice(deleted.index, 0, deleted.line);
                  patch({ lines });
                  setDeleted(null);
                }}
              >
                復原最近刪除的項目
              </button>
            )}
          </div>
          <section
            className="acceptance-summary"
            data-state={result.summary.status}
            aria-label="驗收結果摘要"
            aria-live="polite"
          >
            <span>整體結果</span>
            <strong>{result.summary.label}</strong>
            <p>
              通過 {result.summary.accepted} 項 · 待驗收 {result.summary.pending} 項 · 待改善{' '}
              {result.summary.needsFix} 項
            </p>
          </section>
          <TradeField
            label="驗收備註（選填）"
            multiline
            value={draft.notes}
            maxLength={1000}
            onChange={(notes) => patch({ notes })}
          />
          <TradeErrors errors={result.errors} show={hasContent} />
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="驗收結案確認單"
            date={draft.date}
            text={acceptanceText(draft)}
            valid={result.valid}
          />
          <section className="acceptance-next-step" aria-label="下一步請款">
            <h2>整理下一份請款單</h2>
            <p>{priceNote}</p>
            {result.pricingMatches && result.sourceCalculation && (
              <p className="trade-hint">
                來源報價總額 NT$ {formatMoney(result.sourceCalculation.amount)}
                ，驗收單不列金額，也不表示款項已收。
              </p>
            )}
            {onCreatePayment && (
              <button
                className="button button-secondary"
                disabled={!result.canCreatePayment}
                onClick={() => {
                  const seed = acceptanceToPayment(draft);
                  if (seed) onCreatePayment(seed);
                }}
              >
                帶入請款單
                <ArrowUpRight size={17} />
              </button>
            )}
            {!result.pricingMatches && (
              <a href="#quote" className="text-button">
                前往報價／請款單手動整理 <ArrowUpRight size={15} />
              </a>
            )}
          </section>
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: '工程會・驗收紀錄參考表',
                url: 'https://www.pcc.gov.tw/content/index?eid=9853&lang=1&type=C',
              },
            ]}
          >
            <p>
              工程會範本供政府採購參考；本工具依一般合作需求設計，文件內容與驗收結果仍須由雙方確認，簽章欄保留空白。
            </p>
          </SourceNote>
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper acceptance-paper"
            data-valid={result.valid}
          >
            <header>
              <p className="business-issuer">{draft.issuer || '交付方名稱'}</p>
              <h2>驗收／結案確認單</h2>
              <p className="trade-paper-kicker">逐項確認交付內容</p>
            </header>
            <PaperData
              pairs={[
                ['專案／交付名稱', draft.title],
                ['對應文件編號', draft.reference],
                ['交付方', draft.issuer || '交付方待填'],
                ['驗收方', draft.customer || '驗收方待填'],
                ['驗收日期', draft.date || '待填'],
                ['交付日期', draft.deliveryDate],
              ]}
            />
            <div className="acceptance-paper-summary">
              <strong>整體結果：{result.summary.label}</strong>
              <p>
                通過 {result.summary.accepted} 項 · 待驗收 {result.summary.pending} 項 · 待改善{' '}
                {result.summary.needsFix} 項
              </p>
            </div>
            <table className="business-line-table acceptance-table">
              <thead>
                <tr>
                  <th>交付項目</th>
                  <th>數量</th>
                  <th>驗收結果</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.length ? (
                  draft.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.name || '品名待填'}</strong>
                        {line.improvement && (
                          <p className="acceptance-line-note">{line.improvement}</p>
                        )}
                      </td>
                      <td>{/^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : '—'}</td>
                      <td>{acceptanceStatusLabels[line.status] || '待驗收'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="business-empty">
                      新增交付項目後，內容會出現在這裡。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaperNotes title="驗收備註" text={draft.notes} />
            <Signatures labels={['交付方確認', '驗收方確認']} />
            <footer>
              本單記錄逐項檢查結果，確認與簽章由雙方完成；非統一發票，不表示款項已收。
            </footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
