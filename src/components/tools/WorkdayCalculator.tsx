import { useState } from 'react';
import {
  countWorkdays,
  defaultWorkdayOptions,
  shiftWorkdays,
  workdaySummary,
  type WorkdayOptions,
} from '../../domain/workdays';
import { calendarSnapshots } from '../../data/calendar';
import { getTaiwanDate } from '../../utils/dateUtils';
import { CopyAction } from './CopyAction';
import { SessionNote, SourceNote, ToolPage } from './ToolPage';
import './workdays.css';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const PAGE_SIZE = 31;

export function WorkdayCalculator() {
  const [mode, setMode] = useState<'interval' | 'shift'>('interval');
  const [start, setStart] = useState(getTaiwanDate);
  const [end, setEnd] = useState(getTaiwanDate);
  const [includeStart, setIncludeStart] = useState(true);
  const [count, setCount] = useState('10');
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [options, setOptions] = useState<WorkdayOptions>(defaultWorkdayOptions);
  const [page, setPage] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const result =
    mode === 'interval'
      ? countWorkdays(start, end, includeStart, options)
      : shiftWorkdays(start, count, direction, options);
  const pageCount = Math.max(1, Math.ceil(result.entries.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const detailRows = result.entries.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const calculationLabel =
    mode === 'interval'
      ? `區間計算：${includeStart ? '包含' : '不含'}開始日、包含結束日`
      : `自起始日${direction === 'forward' ? '向後' : '向前'} ${count} 個工作天（不計起始日）`;
  const patchOptions = (patch: Partial<WorkdayOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
    setPage(0);
  };
  return (
    <ToolPage
      title="工作天與交期"
      description="選好你的工作日，把一段時間算清楚，或推算下一個交件日期。"
    >
      <div className="tool-columns workdays-layout">
        <div className="tool-form">
          <h2 className="numbered-title">
            <span>01</span>從哪一天開始
          </h2>
          <div className="tab-buttons" aria-label="計算方式">
            <button
              aria-pressed={mode === 'interval'}
              onClick={() => {
                setMode('interval');
                setPage(0);
              }}
            >
              計算區間
            </button>
            <button
              aria-pressed={mode === 'shift'}
              onClick={() => {
                setMode('shift');
                setPage(0);
              }}
            >
              推算交期
            </button>
          </div>
          <div className="tool-form-grid">
            <label className="tool-field">
              <span>起始日期</span>
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            {mode === 'interval' ? (
              <label className="tool-field">
                <span>結束日期</span>
                <input
                  type="date"
                  min={start || '0001-01-01'}
                  max="9999-12-31"
                  value={end}
                  onChange={(event) => {
                    setEnd(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
            ) : (
              <label className="tool-field">
                <span>工作天數</span>
                <input
                  inputMode="numeric"
                  value={count}
                  maxLength={5}
                  onChange={(event) => {
                    setCount(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
            )}
          </div>
          {mode === 'interval' ? (
            <label className="workdays-check">
              <input
                type="checkbox"
                checked={includeStart}
                onChange={(event) => {
                  setIncludeStart(event.target.checked);
                  setPage(0);
                }}
              />
              包含開始日（結束日固定包含）
            </label>
          ) : (
            <>
              <label className="tool-field">
                <span>推算方向</span>
                <select
                  value={direction}
                  onChange={(event) => {
                    setDirection(event.target.value as 'forward' | 'backward');
                    setPage(0);
                  }}
                >
                  <option value="forward">向後推算（未來）</option>
                  <option value="backward">向前回推（過去）</option>
                </select>
              </label>
              <p className="workdays-hint">
                從起始日的隔日開始；向前回推從前一日開始。填 0 天會保留起始日期。
              </p>
            </>
          )}
          <h2 className="numbered-title">
            <span>02</span>哪些日子算工作日
          </h2>
          <label className="tool-field">
            <span>日曆規則</span>
            <select
              value={options.calendar}
              onChange={(event) =>
                patchOptions({ calendar: event.target.value as WorkdayOptions['calendar'] })
              }
            >
              <option value="government">政府辦公日曆（2026／2027）</option>
              <option value="custom">自訂工作週</option>
            </select>
          </label>
          {options.calendar === 'custom' ? (
            <fieldset className="workdays-week">
              <legend>每週休息日</legend>
              <div className="workdays-week-options">
                {weekdays.map((name, day) => (
                  <label className="workdays-day" key={day}>
                    <input
                      type="checkbox"
                      checked={options.restWeekdays.includes(day)}
                      onChange={(event) =>
                        patchOptions({
                          restWeekdays: event.target.checked
                            ? [0, 1, 2, 3, 4, 5, 6].filter(
                                (value) => value === day || options.restWeekdays.includes(value),
                              )
                            : options.restWeekdays.filter((value) => value !== day),
                        })
                      }
                    />
                    週{name}
                  </label>
                ))}
              </div>
              <label className="workdays-check">
                <input
                  type="checkbox"
                  checked={options.excludeHolidays}
                  onChange={(event) => patchOptions({ excludeHolidays: event.target.checked })}
                />
                排除政府日曆的節日原日期
              </label>
              <label className="workdays-check">
                <input
                  type="checkbox"
                  checked={options.excludeSubstitutes}
                  onChange={(event) => patchOptions({ excludeSubstitutes: event.target.checked })}
                />
                一併排除政府機關補假
              </label>
              <p className="workdays-hint">
                民間補假可能另有約定。兩個排除選項都關閉時，只依你勾選的每週休息日計算。
              </p>
            </fieldset>
          ) : (
            <p className="workdays-hint">
              逐日依人事行政總處公布的上班／放假標記計算，包含政府補假。這份日曆不直接代表每一家公司的排班。
            </p>
          )}
          <p className="workdays-hint">
            單次最多跨越 3,660 個日曆天。使用政府節日或補假資料時，僅計算已核對的 2026／2027 年。
          </p>
          <SessionNote />
        </div>
        <section
          className="tool-result workdays-result"
          aria-label="工作天計算結果"
          aria-live="polite"
        >
          <p className="result-eyebrow">
            {mode === 'interval' ? '這段期間可以安排的工作日' : '依所選工作規則推算'}
          </p>
          {!result.valid ? (
            <p className="field-error" role="alert">
              {result.error}
            </p>
          ) : (
            <>
              <p className="result-number">
                {mode === 'interval' ? result.workdays : result.end}
                <small>{mode === 'interval' ? '個工作天' : ''}</small>
              </p>
              <p className="workdays-hint">{calculationLabel}</p>
              <dl className="workdays-breakdown">
                <div>
                  <dt>計入的日曆天數</dt>
                  <dd>{result.calendarDays} 天</dd>
                </div>
                <div>
                  <dt>工作日</dt>
                  <dd>{result.workdays} 天</dd>
                </div>
                <div>
                  <dt>例行休息日</dt>
                  <dd>{result.restDays} 天</dd>
                </div>
                <div>
                  <dt>節日原日期</dt>
                  <dd>{result.holidayDays} 天</dd>
                </div>
                <div>
                  <dt>政府機關補假</dt>
                  <dd>{result.substituteDays} 天</dd>
                </div>
              </dl>
              <p className="workdays-hint">
                同一天符合多個休假條件時只扣一次，明細優先顯示節日或補假。
              </p>
              <CopyAction
                text={workdaySummary(result, options, calculationLabel)}
                label="複製計算與每日明細"
              />
              <details
                className="workdays-details"
                open={detailsOpen}
                onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
              >
                <summary>逐日核對 · {result.entries.length} 筆</summary>
                {detailsOpen && (
                  <>
                    {result.entries.length === 0 ? (
                      <p className="workdays-hint">依目前起算設定，沒有需要計入的日期。</p>
                    ) : (
                      <table>
                        <caption className="sr-only">依推算順序列出每日工作狀態</caption>
                        <thead>
                          <tr>
                            <th>日期</th>
                            <th>星期</th>
                            <th>計算依據</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRows.map((day) => (
                            <tr key={day.date} className={day.working ? 'is-working' : ''}>
                              <td>{day.date}</td>
                              <td>{weekdays[day.weekday]}</td>
                              <td>{day.label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {pageCount > 1 && (
                      <div className="workdays-pagination">
                        <button
                          className="button button-secondary"
                          disabled={activePage === 0}
                          onClick={() => setPage(activePage - 1)}
                        >
                          前 31 筆
                        </button>
                        <span>
                          {activePage + 1} / {pageCount}
                        </span>
                        <button
                          className="button button-secondary"
                          disabled={activePage + 1 === pageCount}
                          onClick={() => setPage(activePage + 1)}
                        >
                          後 31 筆
                        </button>
                      </div>
                    )}
                  </>
                )}
              </details>
            </>
          )}
        </section>
      </div>
      <SourceNote
        checkedOn="2026-09-30"
        sources={[
          { label: '人事行政總處・政府日曆資料集', url: 'https://data.gov.tw/dataset/14718' },
          ...calendarSnapshots.map((snapshot) => ({
            label: `${snapshot.year} 年官方 CSV`,
            url: snapshot.sourceUrl,
          })),
          { label: '政府資料開放授權條款', url: 'https://data.gov.tw/license' },
          {
            label: '勞動部・補假如何約定',
            url: 'https://www.mol.gov.tw/1607/28162/28166/28218/28226/81488/',
          },
        ]}
      >
        <p>
          原始資料提供：行政院人事行政總處，依政府資料開放授權條款第 1
          版利用；本站整理為排程計算。資料為發布時快照，沒有即時更新。
        </p>
        <p>
          政府機關日曆、自訂工作週與契約約定可能不同；此工具不判定法定期限、個別勞工假日或加班費。
        </p>
      </SourceNote>
    </ToolPage>
  );
}
