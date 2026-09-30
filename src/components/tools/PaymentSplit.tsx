import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { splitPayment } from '../../domain/adminTools';
import { formatMoney } from '../workspace/Totals';
import { ToolPage, SessionNote } from './ToolPage';
import { CopyAction } from './CopyAction';

export function PaymentSplit() {
  const [mode, setMode] = useState<'installments' | 'equal'>('installments');
  const [total, setTotal] = useState('');
  const [count, setCount] = useState('3');
  const [shares, setShares] = useState(['30', '40', '30']);
  const countValue = /^\d+$/.test(count) ? Number(count) : NaN;
  const result = splitPayment(total, mode === 'equal' ? countValue : shares);
  const text = result.valid
    ? `總金額：NT$ ${formatMoney(result.total)}\n${result.amounts.map((amount, index) => `${mode === 'equal' ? '第' + (index + 1) + '份' : '第' + (index + 1) + '期（' + shares[index] + '%）'}：NT$ ${formatMoney(amount)}`).join('\n')}`
    : '';
  return (
    <ToolPage title="款項分攤" description="訂金、尾款與每一份金額，分得剛剛好。">
      <div className="tool-columns">
        <section className="tool-form">
          <h2 className="numbered-title">
            <span>01</span>分配方式
          </h2>
          <div className="tab-buttons" role="group" aria-label="款項分配方式">
            <button aria-pressed={mode === 'installments'} onClick={() => setMode('installments')}>
              按比例分期
            </button>
            <button aria-pressed={mode === 'equal'} onClick={() => setMode('equal')}>
              平均分攤
            </button>
          </div>
          <label className="tool-field">
            <span>總金額（新臺幣整元）</span>
            <input
              inputMode="numeric"
              placeholder="例如 10000"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </label>
          {mode === 'equal' ? (
            <label className="tool-field">
              <span>均分份數</span>
              <input
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
              <small>可分為 2 至 100 份。</small>
            </label>
          ) : (
            <div className="installment-inputs">
              {shares.map((share, index) => (
                <div className="installment-row" key={index}>
                  <label className="tool-field">
                    <span>第 {index + 1} 期比例（%）</span>
                    <input
                      inputMode="decimal"
                      value={share}
                      onChange={(event) =>
                        setShares((current) =>
                          current.map((value, row) => (row === index ? event.target.value : value)),
                        )
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`移除第 ${index + 1} 期`}
                    disabled={shares.length <= 2}
                    onClick={() =>
                      setShares((current) => current.filter((_, row) => row !== index))
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                className="button button-outline"
                disabled={shares.length >= 12}
                onClick={() => setShares((current) => [...current, '0'])}
              >
                <Plus size={17} />
                新增期數
              </button>
              <p className="field-hint">每期可輸入至小數點後兩位，比例合計須為 100%。</p>
            </div>
          )}
          {total && !result.valid && (
            <p className="field-error" role="alert">
              {result.error}
            </p>
          )}
          <p className="calculation-note">
            以整元分配；不足一元的尾差優先分給小數餘額較大的期數或份數。同額時依順序分配，合計一定等於總金額。
          </p>
          <SessionNote />
        </section>
        <section className="tool-result" aria-label="分攤結果">
          <p className="result-eyebrow">分配結果</p>
          <h2 className="result-number">
            <small>NT$</small>
            {result.valid ? formatMoney(result.total) : '—'}
          </h2>
          {result.valid ? (
            <dl className="result-list">
              {result.amounts.map((amount, index) => (
                <div key={index}>
                  <dt>
                    {mode === 'equal'
                      ? `第 ${index + 1} 份`
                      : `第 ${index + 1} 期 · ${shares[index]}%`}
                  </dt>
                  <dd>{formatMoney(amount)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="empty-result">填入總金額，就能看到每一份的數字。</p>
          )}
          <CopyAction text={text} />
        </section>
      </div>
    </ToolPage>
  );
}
