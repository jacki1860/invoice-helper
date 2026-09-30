import { useState } from 'react';
import { gregorianToRoc, rocToGregorian } from '../../domain/adminTools';
import { formatChineseAmountText } from '../../utils/numberUtils';
import { getTaiwanDate } from '../../utils/dateUtils';
import { MAX_AMOUNT } from '../../domain/invoice';
import { ToolPage, SessionNote } from './ToolPage';
import { CopyAction } from './CopyAction';

export function AdminConverter() {
  const [tab, setTab] = useState<'amount' | 'date'>('amount');
  const [amount, setAmount] = useState('');
  const amountValid = /^\d+$/.test(amount.trim()) && Number(amount) <= MAX_AMOUNT;
  const [direction, setDirection] = useState<'gregorian' | 'roc'>('gregorian');
  const [date, setDate] = useState(getTaiwanDate);
  const [rocYear, setRocYear] = useState(() => String(Number(date.slice(0, 4)) - 1911));
  const [month, setMonth] = useState(() => String(Number(date.slice(5, 7))));
  const [day, setDay] = useState(() => String(Number(date.slice(8, 10))));
  const [before, setBefore] = useState(false);
  const converted = direction === 'gregorian' ? date : rocToGregorian(rocYear, month, day, before);
  const roc = converted ? gregorianToRoc(converted) : null;
  const dateText = roc
    ? `${roc.before ? '民國前' : '民國'} ${roc.year} 年 ${roc.month} 月 ${roc.day} 日`
    : '';
  const amountText = amountValid ? formatChineseAmountText(Number(amount)) : '';
  return (
    <ToolPage title="金額與日期轉換" description="需要的寫法，轉好就能用。">
      <div className="tab-buttons" role="group" aria-label="轉換工具">
        <button aria-pressed={tab === 'amount'} onClick={() => setTab('amount')}>
          金額中文大寫
        </button>
        <button aria-pressed={tab === 'date'} onClick={() => setTab('date')}>
          民國／西元日期
        </button>
      </div>
      {tab === 'amount' ? (
        <div className="tool-columns">
          <section className="tool-form">
            <h2 className="numbered-title">
              <span>01</span>填入金額
            </h2>
            <label className="tool-field">
              <span>新臺幣金額（整元）</span>
              <input
                value={amount}
                inputMode="numeric"
                placeholder="例如 11550"
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <p className="field-hint">支援 0 至 999,999,999 元，不含小數。</p>
            {amount && !amountValid && (
              <p className="field-error" role="alert">
                請輸入範圍內的非負整數，不含逗號或其他符號。
              </p>
            )}
            <SessionNote />
          </section>
          <section className="tool-result">
            <p className="result-eyebrow">中文大寫金額</p>
            <p className="converted-text">{amountText || '金額待填'}</p>
            <CopyAction text={amountText} />
          </section>
        </div>
      ) : (
        <div className="tool-columns">
          <section className="tool-form">
            <h2 className="numbered-title">
              <span>01</span>日期寫法
            </h2>
            <div className="tab-buttons" role="group" aria-label="日期輸入方式">
              <button
                aria-pressed={direction === 'gregorian'}
                onClick={() => setDirection('gregorian')}
              >
                輸入西元
              </button>
              <button aria-pressed={direction === 'roc'} onClick={() => setDirection('roc')}>
                輸入民國
              </button>
            </div>
            {direction === 'gregorian' ? (
              <label className="tool-field">
                <span>西元日期</span>
                <input
                  type="date"
                  min="0001-01-01"
                  max="9999-12-31"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="tool-field">
                  <span>紀年</span>
                  <select
                    value={before ? 'before' : 'after'}
                    onChange={(event) => setBefore(event.target.value === 'before')}
                  >
                    <option value="after">民國</option>
                    <option value="before">民國前</option>
                  </select>
                </label>
                <div className="tool-form-grid three">
                  <label className="tool-field">
                    <span>年</span>
                    <input
                      inputMode="numeric"
                      value={rocYear}
                      onChange={(event) => setRocYear(event.target.value)}
                    />
                  </label>
                  <label className="tool-field">
                    <span>月</span>
                    <input
                      inputMode="numeric"
                      value={month}
                      onChange={(event) => setMonth(event.target.value)}
                    />
                  </label>
                  <label className="tool-field">
                    <span>日</span>
                    <input
                      inputMode="numeric"
                      value={day}
                      onChange={(event) => setDay(event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
            {!roc && (
              <p className="field-error" role="alert">
                請輸入有效日期；民國與民國前都從 1 年開始。
              </p>
            )}
            <p className="calculation-note">
              民國 1 年為西元 1912 年；民國前 1 年為西元 1911 年。依日期直接換算，不因時區改變日子。
            </p>
            <SessionNote />
          </section>
          <section className="tool-result">
            <p className="result-eyebrow">轉換結果</p>
            <p className="converted-text">
              {roc ? (direction === 'gregorian' ? dateText : converted) : '日期待確認'}
            </p>
            {roc && (
              <p className="conversion-pair">{direction === 'gregorian' ? converted : dateText}</p>
            )}
            <CopyAction text={roc ? `${converted}\n${dateText}` : ''} />
          </section>
        </div>
      )}
    </ToolPage>
  );
}
