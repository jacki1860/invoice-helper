import { useRef, useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import {
  calculateProfit,
  costCategoryLabels,
  formatCents,
  formatPercent,
  profitText,
  profitToQuote,
  type CostCategory,
  type CostInput,
  type ProfitInput,
} from '../../domain/profit';
import type { ToolHandoff } from '../../features/tools/handoff';
import type { CostSeed, QuoteSeed } from '../../features/tools/workflowHandoff';
import { calculateInvoice } from '../../domain/invoice';
import { getTaiwanDate } from '../../utils/dateUtils';
import {
  TradeActions,
  TradeField,
  TradePreview,
  TradeErrors,
  SampleButton,
} from './TradeDocuments';
import { SourceNote, ToolPage } from './ToolPage';
import './business-calculators.css';

const blankCost = (): CostInput => ({
  id: crypto.randomUUID(),
  name: '',
  category: 'material',
  amount: '',
});
export function ProfitCalculator({
  incoming,
  onCreateQuote,
}: {
  incoming?: ToolHandoff<CostSeed>;
  onCreateQuote?: (seed: QuoteSeed) => void;
}) {
  const [lines, setLines] = useState<CostInput[]>(() => [blankCost()]);
  const [projectName, setProjectName] = useState('');
  const [mode, setMode] = useState<ProfitInput['mode']>('price');
  const [salePrice, setSalePrice] = useState('');
  const [targetMargin, setTargetMargin] = useState('30');
  const [handledId, setHandledId] = useState('');
  const [notice, setNotice] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const input = { lines, mode, salePrice, targetMargin };
  const result = calculateProfit(input);
  const quote = profitToQuote(input, projectName);
  const quoteCalculation = quote
    ? calculateInvoice(quote.lines, quote.priceMode, quote.taxType)
    : null;
  const quoteProfit = quoteCalculation
    ? calculateProfit({ ...input, mode: 'price', salePrice: String(quoteCalculation.subtotal) })
    : null;
  const text = profitText(input, projectName);
  const touched = Boolean(salePrice || lines.some((line) => line.name || line.amount));
  const patch = (id: string, update: Partial<CostInput>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...update } : line)));
  const receive = (append: boolean) => {
    if (!incoming) return;
    const current = append
      ? lines.filter((line) => line.name || line.amount || line.category !== 'material')
      : [];
    if (current.length + incoming.data.lines.length > 50) {
      setNotice('帶入後超過 50 筆，請先減少項目，或使用取代成本。');
      return;
    }
    if (
      !window.confirm(
        append
          ? `將工時費用追加為 ${incoming.data.lines.length} 筆成本，原成本會保留。確定追加？`
          : '將以這次工時費用取代所有成本列，售價設定會保留。確定取代？',
      )
    )
      return;
    setLines([
      ...current,
      ...incoming.data.lines.map((line) => ({
        id: crypto.randomUUID(),
        name: line.name,
        amount: line.amount,
        category: 'labor' as const,
      })),
    ]);
    setHandledId(incoming.id);
    setNotice('已帶入工時成本。');
  };
  const sample = () => {
    if (!window.confirm('載入範例會取代目前專案、成本與售價設定。確定載入？')) return;
    setProjectName('展示專案製作');
    setLines([
      { ...blankCost(), name: '展示材料', amount: '12000.00' },
      { ...blankCost(), name: '設計與製作工時', category: 'labor', amount: '18000.00' },
      { ...blankCost(), name: '輸出加工', category: 'outsource', amount: '6000.00' },
      { ...blankCost(), name: '交通與雜支', category: 'other', amount: '2000.00' },
    ]);
    setMode('margin');
    setTargetMargin('30');
    setSalePrice('');
    setNotice('已載入範例。');
  };
  return (
    <ToolPage title="成本與利潤試算" description="先算清楚投入成本，再決定專案售價。">
      <div className="document-workspace business-calculator-workspace">
        <section className="document-editor">
          {incoming && incoming.id !== handledId && (
            <section className="trade-handoff" aria-label="工時成本帶入確認">
              <h2>收到 {incoming.data.lines.length} 筆工時費用</h2>
              <p>
                以未稅工時成本帶入。取代會移除全部成本列；追加會保留已有成本。重複追加相同工作會重複計算。
              </p>
              <div>
                <button className="button button-primary" onClick={() => receive(false)}>
                  確認取代成本
                </button>
                <button className="button button-outline" onClick={() => receive(true)}>
                  確認追加成本
                </button>
                <button className="text-button" onClick={() => setHandledId(incoming.id)}>
                  略過
                </button>
              </div>
            </section>
          )}
          <SampleButton onClick={sample} />
          <TradeField
            label="專案名稱（帶入報價單時必填）"
            value={projectName}
            onChange={setProjectName}
          />
          <h2 className="numbered-title">
            <span>01</span>成本明細
          </h2>
          <p className="trade-hint">
            每筆填寫未稅新臺幣金額，最多 2 位小數；工時可由「工時費用」工具帶入。
          </p>
          {lines.map((line, index) => (
            <fieldset className="business-cost-row" key={line.id}>
              <legend>成本 {index + 1}</legend>
              <div className="business-cost-fields">
                <label className="tool-field">
                  <span>分類 {index + 1}</span>
                  <select
                    value={line.category}
                    onChange={(event) =>
                      patch(line.id, { category: event.target.value as CostCategory })
                    }
                  >
                    {Object.entries(costCategoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tool-field">
                  <span>成本名稱 {index + 1}</span>
                  <input
                    value={line.name}
                    maxLength={100}
                    onChange={(event) => patch(line.id, { name: event.target.value })}
                  />
                </label>
                <label className="tool-field">
                  <span>未稅成本 {index + 1}（元）</span>
                  <input
                    inputMode="decimal"
                    value={line.amount}
                    placeholder="0.00"
                    onChange={(event) => patch(line.id, { amount: event.target.value })}
                  />
                </label>
              </div>
              <div className="business-row-end">
                <span className="field-error">
                  {(line.name || line.amount) &&
                    Object.entries(result.errors)
                      .filter(([key]) => key.startsWith(`${line.id}.`))
                      .map(([, error]) => error)
                      .join(' ')}
                </span>
                <button
                  className="icon-button"
                  aria-label={`刪除成本 ${index + 1}`}
                  disabled={lines.length <= 1}
                  onClick={() =>
                    setLines((current) => current.filter((entry) => entry.id !== line.id))
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </fieldset>
          ))}
          <button
            className="button button-outline"
            disabled={lines.length >= 50}
            onClick={() => setLines((current) => [...current, blankCost()])}
          >
            <Plus size={17} /> 新增成本
          </button>
          <h2 className="numbered-title">
            <span>02</span>售價設定
          </h2>
          <div className="tab-buttons" role="group" aria-label="售價試算方式">
            <button aria-pressed={mode === 'price'} onClick={() => setMode('price')}>
              輸入售價
            </button>
            <button aria-pressed={mode === 'margin'} onClick={() => setMode('margin')}>
              目標毛利率反推
            </button>
          </div>
          {mode === 'price' ? (
            <label className="tool-field">
              <span>未稅售價（元）</span>
              <input
                inputMode="decimal"
                value={salePrice}
                placeholder="例如 50000.00"
                onChange={(event) => setSalePrice(event.target.value)}
              />
            </label>
          ) : (
            <label className="tool-field">
              <span>目標毛利率（%）</span>
              <input
                inputMode="decimal"
                value={targetMargin}
                onChange={(event) => setTargetMargin(event.target.value)}
              />
              <small>0 至 99.99%。反推售價無條件進位至分，避免低於目標毛利率。</small>
            </label>
          )}
          <TradeErrors
            show={touched}
            errors={Object.entries(result.errors)
              .filter(([key]) => !key.includes('.'))
              .map(([, error]) => error)}
          />
          <p className="calculation-note">
            毛利率＝（售價－成本）÷ 售價；成本加成率＝（售價－成本）÷ 成本。分母為 0
            時顯示「未定義」。此處只計入你輸入的成本，未扣除其他費用與所得稅。
          </p>
          {onCreateQuote && (
            <section className="business-next-step">
              <h3>接著建立報價單</h3>
              <p>
                只帶入專案名稱與一筆未稅售價；內部成本與毛利不會帶入。報價單會依既有整元規則取整並加計
                5% 稅額，可再調整稅別。
              </p>
              {quoteCalculation && (
                <p className="business-quote-rounding">
                  報價依整元規則為未稅 NT$ {quoteCalculation.subtotal.toLocaleString('zh-TW')}，含稅
                  NT$ {quoteCalculation.amount.toLocaleString('zh-TW')}
                  。取整可能改變試算毛利率；以此報價未稅額計算為{' '}
                  {quoteProfit?.valid ? formatPercent(quoteProfit.marginBasisPoints) : '未定義'}。
                </p>
              )}
              <button
                className="button button-outline"
                disabled={!quote}
                onClick={() => {
                  if (quote) onCreateQuote(quote);
                }}
              >
                以售價建立報價單 <ArrowRight size={17} />
              </button>
              {result.valid && !quote && (
                <p className="field-hint">
                  請填專案名稱、設定取整後至少 1 元的售價，並確保加稅後不超過 999,999,999 元。
                </p>
              )}
            </section>
          )}
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="成本與利潤試算"
            date={getTaiwanDate()}
            text={text}
            valid={result.valid}
          />
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: 'BDC 毛利率公式',
                url: 'https://www.bdc.ca/en/articles-tools/entrepreneur-toolkit/templates-business-guides/glossary/gross-profit-margin-ratio',
              },
            ]}
          />
        </section>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target business-calculator-paper"
            aria-label="成本與利潤試算結果"
          >
            <header>
              <p className="trade-paper-kicker">內部試算 · 未稅新臺幣</p>
              <h2>成本與利潤試算</h2>
              <p>{projectName || '專案名稱待填'}</p>
            </header>
            {result.valid ? (
              <>
                <table className="business-line-table business-cost-table">
                  <thead>
                    <tr>
                      <th>成本項目</th>
                      <th>分類</th>
                      <th>未稅金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.name}</td>
                        <td>{costCategoryLabels[line.category]}</td>
                        <td>
                          {Number(line.amount).toLocaleString('zh-TW', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="business-calculation-totals">
                  <div>
                    <dt>成本合計</dt>
                    <dd>NT$ {formatCents(result.costCents)}</dd>
                  </div>
                  <div>
                    <dt>未稅售價</dt>
                    <dd>NT$ {formatCents(result.saleCents)}</dd>
                  </div>
                  <div className="business-grand-total">
                    <dt>毛利</dt>
                    <dd>NT$ {formatCents(result.profitCents)}</dd>
                  </div>
                  <div>
                    <dt>毛利率（毛利 ÷ 售價）</dt>
                    <dd>{formatPercent(result.marginBasisPoints)}</dd>
                  </div>
                  <div>
                    <dt>成本加成率（毛利 ÷ 成本）</dt>
                    <dd>{formatPercent(result.markupBasisPoints)}</dd>
                  </div>
                </dl>
                {result.profitCents < 0 && <p className="field-error">目前售價低於成本。</p>}
              </>
            ) : (
              <p className="empty-result">填寫成本與售價設定後，這裡會呈現完整試算。</p>
            )}
            <footer>本表包含內部成本；僅依輸入資料試算，未扣除未列入的費用與所得稅。</footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
