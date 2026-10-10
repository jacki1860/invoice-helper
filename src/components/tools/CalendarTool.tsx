import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  buildCalendarIcs,
  calendarSnapshots,
  getCalendarDayKind,
  getCalendarEventLabel,
  getCalendarEvents,
  getCalendarFilename,
  getCalendarMonth,
} from '../../domain/calendar';
import { getTaiwanDate } from '../../utils/dateUtils';
import {
  calendarRangeError,
  calendarRangeMax,
  calendarRangeMin,
  calendarToWorkdays,
  selectCalendarDate,
  type CalendarRangeSeed,
} from '../../features/tools/calendarHandoff';
import { SourceNote, ToolPage } from './ToolPage';
import './calendar.css';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarTool({
  onCalculateWorkdays,
}: {
  onCalculateWorkdays?: (seed: CalendarRangeSeed) => void;
}) {
  const today = getTaiwanDate();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  const todayIsAvailable = calendarSnapshots.some((item) => item.year === todayYear);
  const [year, setYear] = useState(todayIsAvailable ? todayYear : calendarSnapshots[0].year);
  const [month, setMonth] = useState(todayIsAvailable ? todayMonth : 1);
  const [range, setRange] = useState<CalendarRangeSeed>({ start: '', end: '' });
  const [rangeAttempted, setRangeAttempted] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<{
    scope: 'year' | 'month';
    message: string;
  } | null>(null);
  const calendar = calendarSnapshots.find((item) => item.year === year) ?? calendarSnapshots[0];
  const events = getCalendarEvents(calendar);
  const monthEvents = getCalendarEvents(calendar, month);
  const weeks = getCalendarMonth(calendar, month);
  const substitutes = events.filter((day) => day.note === '補假').length;
  const firstYear = calendarSnapshots[0].year;
  const lastYear = calendarSnapshots[calendarSnapshots.length - 1].year;
  const rangeError = calendarRangeError(range);
  const showRangeError = rangeAttempted || Boolean(range.start && range.end);
  const rangeDescription = range.start
    ? range.end
      ? `已選 ${range.start} 至 ${range.end}，包含開始日與結束日。再選一天可重新開始。`
      : `開始日：${range.start}。請選結束日；選同一天可計算單日。可切換月份或年份接續選取。`
    : '先選開始日，再選結束日。可用 Tab 移動、Enter 或空白鍵選日期，也可直接填寫日期。';

  function transferRange() {
    setRangeAttempted(true);
    const seed = calendarToWorkdays(range);
    if (seed) onCalculateWorkdays?.(seed);
  }

  function changeMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
    setDownloadStatus(null);
  }

  function downloadCalendar(scope: 'year' | 'month') {
    setDownloadStatus(null);
    const exportMonth = scope === 'month' ? month : undefined;
    const exportRange = scope === 'month' ? `${year} 年 ${month} 月` : `${year} 年`;
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const blob = new Blob([buildCalendarIcs(calendar, new Date(), exportMonth)], {
        type: 'text/calendar;charset=utf-8',
      });
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = getCalendarFilename(year, exportMonth);
      document.body.appendChild(link);
      link.click();
      const count = scope === 'month' ? monthEvents.length : events.length;
      setDownloadStatus({
        scope,
        message: `已產生 ${exportRange} ICS，共 ${count} 筆節日與補假。`,
      });
    } catch {
      setDownloadStatus({ scope, message: `無法產生 ${exportRange} ICS，請重試下載。` });
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
      title="國定假日行事曆"
      description="查看國定假日與政府機關補假，下載全年或指定月份的重要日期，帶進你的行事曆。"
    >
      <div className="calendar-toolbar">
        <div className="calendar-year-field">
          <label htmlFor="calendar-year">選擇年份</label>
          <select
            id="calendar-year"
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setDownloadStatus(null);
            }}
          >
            {calendarSnapshots.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year} 年（民國 {item.year - 1911} 年）
              </option>
            ))}
          </select>
        </div>
        <div className="calendar-export">
          <button
            className="button button-primary calendar-download"
            type="button"
            onClick={() => downloadCalendar('year')}
          >
            <Download size={17} aria-hidden="true" />
            下載 {year} 全年 ICS
          </button>
          <p className="calendar-export-note" role="status">
            {downloadStatus?.scope === 'year'
              ? downloadStatus.message
              : `全年 ${events.length} 筆；不含一般週末。下載後可匯入行事曆。`}
          </p>
        </div>
      </div>

      <dl className="calendar-facts" aria-label={`${year} 年政府行政機關日曆統計`}>
        <div>
          <dt>國定假日原日期</dt>
          <dd>
            {events.length - substitutes}
            <span> 天</span>
          </dd>
        </div>
        <div>
          <dt>政府機關補假</dt>
          <dd>
            {substitutes}
            <span> 天</span>
          </dd>
        </div>
        <div>
          <dt>總放假日，含週末</dt>
          <dd>
            {calendar.days.filter((day) => day.isDayOff).length}
            <span> 天</span>
          </dd>
        </div>
      </dl>

      <section className="calendar-range" aria-labelledby="calendar-range-title">
        <h2 id="calendar-range-title">選一段時間，計算工作天</h2>
        <p id="calendar-range-instructions" className="calendar-range-note">
          選好日期後帶到工作天工具，再確認套用。計算會沿用工作天工具目前的政府日曆或自訂休息日設定。
        </p>
        <div className="calendar-range-fields">
          <label className="tool-field">
            <span>區間開始日期</span>
            <input
              type="date"
              min={calendarRangeMin}
              max={calendarRangeMax}
              value={range.start}
              aria-describedby="calendar-range-status calendar-range-error"
              onChange={(event) => setRange({ ...range, start: event.target.value })}
            />
          </label>
          <label className="tool-field">
            <span>區間結束日期</span>
            <input
              type="date"
              min={calendarRangeMin}
              max={calendarRangeMax}
              value={range.end}
              aria-describedby="calendar-range-status calendar-range-error"
              onChange={(event) => setRange({ ...range, end: event.target.value })}
            />
          </label>
        </div>
        <p id="calendar-range-status" className="calendar-range-note" role="status">
          {rangeDescription}
        </p>
        <p id="calendar-range-error" className="field-error" role="alert">
          {showRangeError ? rangeError : ''}
        </p>
        <div className="calendar-range-actions">
          <button className="button button-primary" type="button" onClick={transferRange}>
            帶入工作天計算
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setRange({ start: '', end: '' });
              setRangeAttempted(false);
            }}
          >
            清除日期區間
          </button>
        </div>
      </section>

      <div className="calendar-layout">
        <section className="calendar-panel" aria-labelledby="calendar-month-title">
          <div className="calendar-month-toolbar">
            <h2 id="calendar-month-title" aria-live="polite">
              {year}
              <span> 年 </span>
              {month}
              <span> 月</span>
            </h2>
            <div className="calendar-month-controls">
              <button
                className="calendar-arrow"
                type="button"
                aria-label="上一個月"
                disabled={year === firstYear && month === 1}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <label className="sr-only" htmlFor="calendar-month">
                選擇月份
              </label>
              <select
                id="calendar-month"
                value={month}
                onChange={(event) => {
                  setMonth(Number(event.target.value));
                  setDownloadStatus(null);
                }}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1} 月
                  </option>
                ))}
              </select>
              <button
                className="calendar-arrow"
                type="button"
                aria-label="下一個月"
                disabled={year === lastYear && month === 12}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={19} aria-hidden="true" />
              </button>
              {todayIsAvailable && (
                <button
                  className="calendar-today-button"
                  type="button"
                  onClick={() => {
                    setYear(todayYear);
                    setMonth(todayMonth);
                    setDownloadStatus(null);
                  }}
                >
                  本月
                </button>
              )}
            </div>
          </div>
          <table className="holiday-calendar">
            <caption className="sr-only">
              {year} 年 {month} 月，政府行政機關辦公日曆
            </caption>
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th key={day} scope="col">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) =>
                    day ? (
                      <td
                        key={day.date}
                        className={`calendar-day calendar-day--${getCalendarDayKind(day)}${day.date === today ? ' calendar-day--today' : ''}${day.date === range.start || day.date === range.end || (!rangeError && day.date > range.start && day.date < range.end) ? ' calendar-day--selected' : ''}`}
                        title={`${day.date} 星期${weekdays[day.weekday]}${day.note ? `・${getCalendarEventLabel(day)}` : day.isDayOff ? '・週末' : ''}`}
                      >
                        <button
                          className="calendar-day-button"
                          type="button"
                          aria-label={`${day.date} 星期${weekdays[day.weekday]}${day.note ? `，${getCalendarEventLabel(day)}` : day.isDayOff ? '，週末' : ''}${day.date === range.start ? '，開始日' : ''}${day.date === range.end ? '，結束日' : ''}${!rangeError && day.date > range.start && day.date < range.end ? '，區間內' : ''}`}
                          aria-pressed={
                            day.date === range.start ||
                            day.date === range.end ||
                            (!rangeError && day.date > range.start && day.date < range.end)
                          }
                          aria-describedby="calendar-range-status"
                          onClick={() => {
                            setRange((current) => selectCalendarDate(current, day.date));
                            setRangeAttempted(false);
                          }}
                        >
                          <time
                            dateTime={day.date}
                            aria-current={day.date === today ? 'date' : undefined}
                          >
                            {Number(day.date.slice(8))}
                          </time>
                          {(day.date === range.start || day.date === range.end) && (
                            <span className="calendar-range-marker">
                              {day.date === range.start && day.date === range.end
                                ? '起迄'
                                : day.date === range.start
                                  ? '開始'
                                  : '結束'}
                            </span>
                          )}
                          {day.note && (
                            <span className="calendar-day-label">
                              {day.note === '補假' ? '補假' : day.note}
                            </span>
                          )}
                        </button>
                      </td>
                    ) : (
                      <td className="calendar-day calendar-day--empty" key={`empty-${dayIndex}`} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="calendar-legend" aria-label="日曆圖例">
            <li>
              <span className="calendar-key calendar-key--holiday" aria-hidden="true" />
              國定假日原日期
            </li>
            <li>
              <span className="calendar-key calendar-key--substitute" aria-hidden="true" />
              政府機關補假
            </li>
            <li>
              <span className="calendar-key calendar-key--weekend" aria-hidden="true" />
              一般週末
            </li>
          </ul>
        </section>

        <section className="calendar-agenda" aria-labelledby="calendar-agenda-title">
          <div className="calendar-agenda-heading">
            <h2 id="calendar-agenda-title">{month} 月節日與補假</h2>
            <span>{monthEvents.length} 筆</span>
          </div>
          <div className="calendar-month-export">
            <button
              className="button button-outline calendar-download"
              type="button"
              onClick={() => downloadCalendar('month')}
              disabled={monthEvents.length === 0}
              aria-describedby="calendar-month-export-note"
            >
              <Download size={17} aria-hidden="true" />
              下載 {year} 年 {month} 月 ICS
            </button>
            <p id="calendar-month-export-note" className="calendar-export-note" role="status">
              {downloadStatus?.scope === 'month'
                ? downloadStatus.message
                : monthEvents.length
                  ? `只下載目前選定月份的 ${monthEvents.length} 筆節日與補假。`
                  : '本月沒有節日與補假可下載；可切換月份或下載全年。'}
            </p>
          </div>
          {monthEvents.length ? (
            <ol className="calendar-event-list">
              {monthEvents.map((day) => (
                <li key={day.date}>
                  <time dateTime={day.date}>
                    <strong>{day.date.slice(8)}</strong>
                    <span>週{weekdays[day.weekday]}</span>
                  </time>
                  <div>
                    <p>{getCalendarEventLabel(day)}</p>
                    <span
                      className={`calendar-event-type calendar-event-type--${getCalendarDayKind(day)}`}
                    >
                      {day.note === '補假' ? '政府機關補假' : '國定假日原日期'}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="calendar-empty-month">這個月沒有國定假日或政府機關補假。</p>
          )}
          <p className="calendar-agenda-note">一般週末顯示在月曆中，不列入節日清單與 ICS。</p>
          {year === 2027 && (
            <p className="calendar-agenda-note">
              2027 年 12 月 31 日為 2028 年元旦的政府機關補假，已納入全年及 12 月下載。
            </p>
          )}
        </section>
      </div>

      <SourceNote
        checkedOn={calendar.fetchedOn}
        sources={[
          { label: '人事行政總處開放資料', url: 'https://data.gov.tw/dataset/14718' },
          {
            label: `${year} 年官方公告`,
            url:
              year === 2026
                ? 'https://www.dgpa.gov.tw/information?pid=12574&uid=41'
                : 'https://www.dgpa.gov.tw/information?pid=12983&uid=2',
          },
          {
            label: '勞動部：國定假日及補假',
            url: 'https://www.mol.gov.tw/1607/28162/28166/28218/28226/81488/',
          },
        ]}
      >
        <p>
          補假及總放假日依政府行政機關辦公日曆。民間企業的實際休假與補假，須依適用法令及勞資協商排定；輪班、學校與特殊機關另依主管規定。
        </p>
        <p>目前提供 2026、2027 年公告資料；不含因身分或個別情況而適用的歲時祭儀、投票日等假日。</p>
      </SourceNote>
    </ToolPage>
  );
}
