export const MAX_COUNTDOWN_SECONDS = 86_400;
export const MAX_COUNTDOWN_NAME_LENGTH = 60;

export interface CountdownDraft {
  name: string;
  minutes: string;
  seconds: string;
}

export interface CountdownSettings {
  name: string;
  durationMs: number;
}

export interface CountdownError {
  field: keyof CountdownDraft | 'duration';
  message: string;
}

export type CountdownResult =
  | { valid: true; errors: []; settings: CountdownSettings }
  | { valid: false; errors: CountdownError[]; settings: null };

export function emptyCountdownDraft(): CountdownDraft {
  return { name: '', minutes: '25', seconds: '0' };
}

export function countdownResult(draft: CountdownDraft): CountdownResult {
  const errors: CountdownError[] = [];
  if (
    Array.from(draft.name).length > MAX_COUNTDOWN_NAME_LENGTH ||
    /[\p{Cc}\u2028\u2029]/u.test(draft.name)
  ) {
    errors.push({ field: 'name', message: '本次名稱最多 60 字，不可包含換行或控制字元。' });
  }
  const minutes = /^\d+$/.test(draft.minutes) ? Number(draft.minutes) : NaN;
  const seconds = /^\d+$/.test(draft.seconds) ? Number(draft.seconds) : NaN;
  const validMinutes = Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440;
  const validSeconds = Number.isInteger(seconds) && seconds >= 0 && seconds <= 59;
  if (!validMinutes) {
    errors.push({ field: 'minutes', message: '分鐘請填 0–1,440 的整數，不含空白或其他符號。' });
  }
  if (!validSeconds) {
    errors.push({ field: 'seconds', message: '秒數請填 0–59 的整數，不含空白或其他符號。' });
  }
  const totalSeconds = minutes * 60 + seconds;
  if (validMinutes && validSeconds && (totalSeconds < 1 || totalSeconds > MAX_COUNTDOWN_SECONDS)) {
    errors.push({
      field: 'duration',
      message: '總時長需為 1 秒至 24 小時；1,440 分鐘只能搭配 0 秒。',
    });
  }
  return errors.length
    ? { valid: false, errors, settings: null }
    : {
        valid: true,
        errors: [],
        settings: { name: draft.name.trim() || '本次倒數', durationMs: totalSeconds * 1000 },
      };
}

export type CountdownStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface CountdownState {
  status: CountdownStatus;
  name: string;
  durationMs: number;
  remainingMs: number;
  deadline: number | null;
  version: number;
}

export type CountdownAction =
  | { type: 'start'; settings: CountdownSettings; now: number; version: number }
  | { type: 'tick' | 'pause' | 'resume'; now: number; version: number }
  | { type: 'reset' };

export function emptyCountdownState(): CountdownState {
  return { status: 'idle', name: '', durationMs: 0, remainingMs: 0, deadline: null, version: 0 };
}

function updateRunning(state: CountdownState, now: number): CountdownState {
  if (state.status !== 'running' || state.deadline === null) return state;
  const remainingMs = Math.max(0, Math.min(state.durationMs, state.deadline - now));
  if (remainingMs === 0) {
    return {
      ...state,
      status: 'finished',
      remainingMs: 0,
      deadline: null,
      version: state.version + 1,
    };
  }
  return remainingMs === state.remainingMs ? state : { ...state, remainingMs };
}

export function countdownReducer(state: CountdownState, action: CountdownAction): CountdownState {
  if (action.type === 'reset') return { ...emptyCountdownState(), version: state.version + 1 };
  // A queued callback from an older timer must not change a reset or resumed run.
  if (action.version !== state.version || !Number.isFinite(action.now)) return state;
  if (action.type === 'start') {
    const { durationMs, name } = action.settings;
    if (
      state.status !== 'idle' ||
      !Number.isInteger(durationMs) ||
      durationMs < 1000 ||
      durationMs > MAX_COUNTDOWN_SECONDS * 1000 ||
      durationMs % 1000 !== 0
    )
      return state;
    return {
      status: 'running',
      name,
      durationMs,
      remainingMs: durationMs,
      deadline: action.now + durationMs,
      version: state.version + 1,
    };
  }
  if (action.type === 'tick') return updateRunning(state, action.now);
  if (action.type === 'pause') {
    const current = updateRunning(state, action.now);
    return current.status === 'running'
      ? { ...current, status: 'paused', deadline: null, version: current.version + 1 }
      : current;
  }
  if (state.status !== 'paused') return state;
  return {
    ...state,
    status: 'running',
    deadline: action.now + state.remainingMs,
    version: state.version + 1,
  };
}

export function formatCountdownMs(milliseconds: number): string {
  const total = Math.ceil(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export const countdownStatusLabels: Record<CountdownStatus, string> = {
  idle: '準備開始',
  running: '倒數進行中',
  paused: '已暫停',
  finished: '時間到',
};

export function countdownSummary(state: CountdownState): string {
  if (state.status === 'idle') return '';
  return [
    '工作與會議倒數',
    `名稱：${state.name}`,
    `設定時間：${formatCountdownMs(state.durationMs)}`,
    `狀態：${countdownStatusLabels[state.status]}`,
    `剩餘時間：${formatCountdownMs(state.remainingMs)}`,
  ].join('\n');
}
