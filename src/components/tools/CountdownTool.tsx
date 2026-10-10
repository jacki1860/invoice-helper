import { useEffect, useReducer, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  countdownReducer,
  countdownResult,
  countdownStatusLabels,
  countdownSummary,
  emptyCountdownDraft,
  emptyCountdownState,
  formatCountdownMs,
  type CountdownDraft,
} from '../../features/tools/countdown';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './countdown.css';

export function CountdownTool() {
  const [draft, setDraft] = useState(emptyCountdownDraft);
  const [timer, dispatch] = useReducer(countdownReducer, undefined, emptyCountdownState);
  const result = countdownResult(draft);
  const idle = timer.status === 'idle';
  const remaining = idle ? (result.valid ? result.settings.durationMs : null) : timer.remainingMs;
  const summary = countdownSummary(timer);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const update = () => dispatch({ type: 'tick', now: Date.now(), version: timer.version });
    const interval = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [timer.status, timer.version]);

  function patch(update: Partial<CountdownDraft>) {
    if (idle) setDraft((current) => ({ ...current, ...update }));
  }

  function reset() {
    if (
      (timer.status === 'running' || timer.status === 'paused') &&
      !window.confirm('重設會結束本次倒數，回到原設定時間。確定重設？')
    )
      return;
    dispatch({ type: 'reset' });
  }

  return (
    <ToolPage title="工作與會議倒數" description="為一段討論、休息或專注工作留一段時間。">
      <div className="countdown-tool tool-columns">
        <section className="tool-form" aria-labelledby="countdown-settings-heading">
          <h2 className="numbered-title" id="countdown-settings-heading">
            <span>01</span>設定這次倒數
          </h2>
          <fieldset className="countdown-settings" disabled={!idle}>
            <legend className="sr-only">倒數設定</legend>
            <label className="tool-field" htmlFor="countdown-name">
              <span id="countdown-name-label">本次名稱（選填）</span>
              <textarea
                id="countdown-name"
                aria-labelledby="countdown-name-label"
                aria-describedby="countdown-name-hint"
                aria-invalid={result.errors.some((error) => error.field === 'name')}
                rows={2}
                value={draft.name}
                placeholder="例如 提案討論、休息一下"
                onChange={(event) => patch({ name: event.target.value })}
              />
              <small id="countdown-name-hint">單行、最多 60 字；留白使用「本次倒數」。</small>
            </label>
            <div className="countdown-duration-fields">
              <label className="tool-field" htmlFor="countdown-minutes">
                <span>分鐘</span>
                <input
                  id="countdown-minutes"
                  inputMode="numeric"
                  value={draft.minutes}
                  aria-describedby="countdown-limits"
                  aria-invalid={result.errors.some(
                    (error) => error.field === 'minutes' || error.field === 'duration',
                  )}
                  onChange={(event) => patch({ minutes: event.target.value })}
                />
              </label>
              <label className="tool-field" htmlFor="countdown-seconds">
                <span>秒數</span>
                <input
                  id="countdown-seconds"
                  inputMode="numeric"
                  value={draft.seconds}
                  aria-describedby="countdown-limits"
                  aria-invalid={result.errors.some(
                    (error) => error.field === 'seconds' || error.field === 'duration',
                  )}
                  onChange={(event) => patch({ seconds: event.target.value })}
                />
              </label>
            </div>
            <p id="countdown-limits" className="countdown-note">
              分鐘 0–1,440、秒數 0–59，總時長 1 秒至 24 小時；1,440 分鐘請搭配 0 秒。
            </p>
            <div className="countdown-presets" role="group" aria-label="快捷時間">
              {[5, 15, 25].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="button button-quiet"
                  onClick={() => patch({ minutes: String(minutes), seconds: '0' })}
                >
                  {minutes} 分鐘
                </button>
              ))}
            </div>
          </fieldset>
          {!idle && <p className="countdown-note">要調整名稱或時間，請先重設本次倒數。</p>}
          {!result.valid && (
            <ul id="countdown-errors" className="countdown-errors" role="alert">
              {result.errors.map((error) => (
                <li key={error.field}>{error.message}</li>
              ))}
            </ul>
          )}
          <SessionNote />
        </section>
        <section
          className={`tool-result countdown-panel is-${timer.status}`}
          aria-labelledby="countdown-display-heading"
        >
          <p className="result-eyebrow">這一段時間</p>
          <h2 id="countdown-display-heading">
            {idle ? (result.valid ? result.settings.name : '本次倒數') : timer.name}
          </h2>
          <p className="countdown-status" role="status" aria-atomic="true">
            {countdownStatusLabels[timer.status]}
          </p>
          <div id="countdown-clock" role="timer" aria-label="剩餘時間" aria-live="off">
            {remaining === null ? '—:—:—' : formatCountdownMs(remaining)}
          </div>
          <p className="countdown-time-label">時：分：秒</p>
          <div className="countdown-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={(idle && !result.valid) || timer.status === 'finished'}
              onClick={() => {
                if (idle && result.valid) {
                  dispatch({
                    type: 'start',
                    settings: result.settings,
                    now: Date.now(),
                    version: timer.version,
                  });
                } else if (timer.status === 'running' || timer.status === 'paused') {
                  dispatch({
                    type: timer.status === 'running' ? 'pause' : 'resume',
                    now: Date.now(),
                    version: timer.version,
                  });
                }
              }}
            >
              {timer.status === 'running' ? (
                <Pause size={17} aria-hidden="true" />
              ) : timer.status !== 'finished' ? (
                <Play size={17} aria-hidden="true" />
              ) : null}
              {idle
                ? '開始倒數'
                : timer.status === 'running'
                  ? '暫停'
                  : timer.status === 'paused'
                    ? '繼續倒數'
                    : '倒數已結束'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={idle}
              onClick={reset}
            >
              <RotateCcw size={17} aria-hidden="true" />
              重設倒數
            </button>
          </div>
          {timer.status === 'finished' && (
            <p className="countdown-finished">這段時間已結束。重設後可再開始，不會自動重跑。</p>
          )}
          <div className="countdown-summary">
            <CopyAction key={timer.version} text={summary} disabled={idle} label="複製當次摘要" />
            {!idle && (
              <details>
                <summary>查看可選取的摘要</summary>
                <textarea aria-label="當次倒數摘要" readOnly value={summary} rows={6} />
              </details>
            )}
          </div>
        </section>
      </div>
      <aside className="countdown-notes" aria-label="計時說明">
        <p>計時中切換站內工具仍會繼續；重新整理或關閉頁面後不保留。</p>
        <p>
          倒數依裝置系統時間計算，修改系統時間可能影響結果。背景分頁或裝置休眠時畫面可能延後更新，返回頁面會重新核對時間；沒有音效、通知或背景叫醒功能。
        </p>
      </aside>
    </ToolPage>
  );
}
