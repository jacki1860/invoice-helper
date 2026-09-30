import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { calculateHourly, type HourlyInput } from '../../domain/adminTools';
import { ToolPage, SessionNote } from './ToolPage';
import { CopyAction } from './CopyAction';

import { hourlyToCosts, type CostSeed } from '../../features/tools/workflowHandoff';

const blankWork = (): HourlyInput => ({
  id: crypto.randomUUID(),
  name: '',
  hours: '1',
  minutes: '0',
  rate: '',
});
const money = (cents: number) =>
  (cents / 100).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function HourlyCalculator({ onCreateCosts }: { onCreateCosts?: (seed: CostSeed) => void }) {
  const [lines, setLines] = useState<HourlyInput[]>(() => [blankWork()]);
  const result = calculateHourly(lines);
  const patch = (id: string, update: Partial<HourlyInput>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...update } : line)));
  const text = result.valid
    ? `${result.lines.map((line) => `${line.name}：${Math.floor(line.minutes / 60)} 小時 ${line.minutes % 60} 分鐘，NT$ ${money(line.cents)}`).join('\n')}\n總費用：NT$ ${money(result.cents)}（未加計稅額）`
    : '';
  return (
    <ToolPage title="工時費用" description="把投入的時間，整理成清楚的費用。">
      <div className="tool-columns">
        <section className="tool-form">
          <h2 className="numbered-title">
            <span>01</span>工作與時間
          </h2>
          {lines.map((line, index) => {
            const errors = ['name', 'time', 'rate']
              .map((key) => result.errors[`${line.id}.${key}`])
              .filter(Boolean);
            const touched = Boolean(line.name || line.rate);
            return (
              <fieldset className="hourly-row" key={line.id}>
                <legend>工作 {index + 1}</legend>
                <label className="tool-field">
                  <span>項目名稱 {index + 1}</span>
                  <input
                    value={line.name}
                    maxLength={100}
                    placeholder="例如 設計修改"
                    onChange={(event) => patch(line.id, { name: event.target.value })}
                  />
                </label>
                <div className="tool-form-grid three">
                  <label className="tool-field">
                    <span>小時 {index + 1}</span>
                    <input
                      inputMode="numeric"
                      value={line.hours}
                      onChange={(event) => patch(line.id, { hours: event.target.value })}
                    />
                  </label>
                  <label className="tool-field">
                    <span>分鐘 {index + 1}</span>
                    <input
                      inputMode="numeric"
                      value={line.minutes}
                      onChange={(event) => patch(line.id, { minutes: event.target.value })}
                    />
                  </label>
                  <label className="tool-field">
                    <span>時薪 {index + 1}（元）</span>
                    <input
                      inputMode="decimal"
                      value={line.rate}
                      placeholder="0"
                      onChange={(event) => patch(line.id, { rate: event.target.value })}
                    />
                  </label>
                </div>
                <div className="hourly-row-bottom">
                  <p className="field-error" role={touched && errors.length ? 'alert' : undefined}>
                    {touched ? errors.join(' ') : ''}
                  </p>
                  <button
                    className="icon-button"
                    aria-label={`刪除工作 ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => current.filter((entry) => entry.id !== line.id))
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </fieldset>
            );
          })}
          <button
            className="button button-outline"
            disabled={lines.length >= 50}
            onClick={() => setLines((current) => [...current, blankWork()])}
          >
            <Plus size={17} />
            新增工作
          </button>
          {result.errors.total && (
            <p className="field-error" role="alert">
              {result.errors.total}
            </p>
          )}
          <p className="calculation-note">
            費用＝時薪 × 分鐘 ÷
            60。每項四捨五入至小數點後兩位再加總；此處不加計稅額，也不套用加班費或法定工資規則。
          </p>
          <SessionNote />
        </section>
        <section className="tool-result" aria-label="工時費用結果">
          <p className="result-eyebrow">總費用 · 未加計稅額</p>
          <h2 className="result-number">
            <small>NT$</small>
            {result.valid ? money(result.cents) : '—'}
          </h2>
          {result.valid ? (
            <>
              <p className="time-summary">
                共 {Math.floor(result.minutes / 60)} 小時 {result.minutes % 60} 分鐘
              </p>
              <dl className="result-list">
                {result.lines.map((line) => (
                  <div key={line.id}>
                    <dt>{line.name}</dt>
                    <dd>{money(line.cents)}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="empty-result">填妥工作項目、時間與時薪，就能整理費用。</p>
          )}
          <CopyAction text={text} />
          {onCreateCosts && (
            <div className="document-actions">
              <button
                className="button button-secondary"
                disabled={!result.valid}
                onClick={() => {
                  const seed = hourlyToCosts(lines);
                  if (seed) onCreateCosts(seed);
                }}
              >
                帶入成本試算
              </button>
            </div>
          )}
        </section>
      </div>
    </ToolPage>
  );
}
