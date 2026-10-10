import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countdownReducer,
  countdownResult,
  countdownSummary,
  emptyCountdownDraft,
  emptyCountdownState,
  formatCountdownMs,
  type CountdownDraft,
  type CountdownState,
} from '../src/features/tools/countdown.ts';

function start(seconds = 60, now = 10_000): CountdownState {
  return countdownReducer(emptyCountdownState(), {
    type: 'start',
    settings: { name: '本次測試', durationMs: seconds * 1000 },
    now,
    version: 0,
  });
}

function transition(state: CountdownState, type: 'tick' | 'pause' | 'resume', now: number) {
  return countdownReducer(state, { type, now, version: state.version });
}

test('countdown parsing accepts exact endpoints, leading zeros and Unicode names without mutation', () => {
  assert.deepEqual(emptyCountdownDraft(), { name: '', minutes: '25', seconds: '0' });
  for (const [minutes, seconds, durationMs] of [
    ['0', '1', 1000],
    ['1440', '0', 86_400_000],
    ['0005', '09', 309_000],
  ] as const) {
    const draft = Object.freeze({ name: '  討論😀  ', minutes, seconds });
    assert.deepEqual(countdownResult(draft), {
      valid: true,
      errors: [],
      settings: { name: '討論😀', durationMs },
    });
  }
  assert.equal(countdownResult({ name: '😀'.repeat(60), minutes: '0', seconds: '1' }).valid, true);
  assert.deepEqual(countdownResult({ ...emptyCountdownDraft(), name: '  ' }), {
    valid: true,
    errors: [],
    settings: { name: '本次倒數', durationMs: 1_500_000 },
  });
});

test('invalid input is rejected whole and retained exactly', () => {
  const cases: Partial<CountdownDraft>[] = [
    { minutes: '', seconds: '0' },
    { minutes: '0', seconds: '0' },
    { minutes: '1440', seconds: '1' },
    ...['-1', '1.5', '1e2', '+5', ' 5', '5 ', '５', '1441', '9'.repeat(400)].map((minutes) => ({
      minutes,
    })),
    ...['', '-1', '1.5', '60', '1e1', ' 1', '９'].map((seconds) => ({ seconds })),
    ...['😀'.repeat(61), 'a\nb', 'a\tb', 'a\u0000b', 'a\u2028b', 'a\u2029b'].map((name) => ({
      name,
    })),
  ];
  for (const patch of cases) {
    const draft = Object.freeze({ ...emptyCountdownDraft(), ...patch });
    const original = JSON.stringify(draft);
    const result = countdownResult(draft);
    assert.equal(result.valid, false, original);
    assert.equal(result.settings, null);
    assert.ok(result.errors.length > 0);
    assert.equal(JSON.stringify(draft), original);
  }
});

test('remaining time uses the deadline, rounds display upward, and late callbacks finish directly', () => {
  const running = start(10);
  assert.equal(running.deadline, 20_000);
  assert.equal(formatCountdownMs(transition(running, 'tick', 10_001).remainingMs), '00:00:10');
  assert.equal(formatCountdownMs(transition(running, 'tick', 18_200).remainingMs), '00:00:02');
  assert.equal(formatCountdownMs(transition(running, 'tick', 19_999).remainingMs), '00:00:01');
  const done = transition(running, 'tick', 25_000);
  assert.equal(done.status, 'finished');
  assert.equal(done.remainingMs, 0);
  assert.equal(done.deadline, null);
  assert.equal(formatCountdownMs(done.remainingMs), '00:00:00');
  assert.equal(transition(done, 'tick', 26_000), done);
});

test('pause captures the actual remaining milliseconds and resume excludes the paused period', () => {
  const paused = transition(start(10), 'pause', 12_750);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remainingMs, 7250);
  assert.equal(paused.deadline, null);
  assert.equal(transition(paused, 'tick', 50_000), paused);
  const resumed = transition(paused, 'resume', 50_000);
  assert.equal(resumed.deadline, 57_250);
  assert.equal(transition(resumed, 'tick', 57_249).status, 'running');
  assert.equal(transition(resumed, 'pause', 57_250).status, 'finished');
  assert.equal(transition(start(1), 'pause', 12_000).status, 'finished');
});

test('reset, duplicate start and queued old callbacks cannot modify a new run', () => {
  const first = start(10);
  const duplicate = countdownReducer(first, {
    type: 'start',
    settings: { name: 'other', durationMs: 3000 },
    now: 10_100,
    version: first.version,
  });
  assert.equal(duplicate, first);
  const reset = countdownReducer(first, { type: 'reset' });
  assert.equal(reset.status, 'idle');
  assert.equal(countdownSummary(reset), '');
  const second = countdownReducer(reset, {
    type: 'start',
    settings: { name: 'second', durationMs: 3000 },
    now: 30_000,
    version: reset.version,
  });
  for (const type of ['tick', 'pause', 'resume'] as const) {
    assert.equal(countdownReducer(second, { type, now: 99_000, version: first.version }), second);
  }
  const paused = transition(second, 'pause', 31_000);
  const resumed = transition(paused, 'resume', 60_000);
  assert.equal(
    countdownReducer(resumed, { type: 'tick', now: 99_000, version: second.version }),
    resumed,
  );
});

test('clock changes never produce a negative display or more than the configured duration', () => {
  const running = start(90);
  const beforeStart = transition(running, 'tick', 5000);
  assert.equal(beforeStart.remainingMs, 90_000);
  assert.equal(transition(running, 'pause', 5000).remainingMs, 90_000);
  assert.equal(transition(running, 'tick', 1_000_000).remainingMs, 0);
  for (const now of [NaN, Infinity, -Infinity])
    assert.equal(transition(running, 'tick', now), running);
  for (const durationMs of [0, -1000, 999, 1001, NaN, Infinity, 86_401_000]) {
    const initial = emptyCountdownState();
    assert.equal(
      countdownReducer(initial, {
        type: 'start',
        settings: { name: 'test', durationMs },
        now: 10,
        version: 0,
      }),
      initial,
    );
  }
});

test('summaries reflect the frozen run name, duration and state; full-day display is preserved', () => {
  assert.equal(formatCountdownMs(86_400_000), '24:00:00');
  assert.equal(formatCountdownMs(3_661_000), '01:01:01');
  assert.equal(formatCountdownMs(-1), '00:00:00');
  const paused = transition(start(10), 'pause', 12_100);
  assert.equal(
    countdownSummary(paused),
    '工作與會議倒數\n名稱：本次測試\n設定時間：00:00:10\n狀態：已暫停\n剩餘時間：00:00:08',
  );
  const done = transition(start(10), 'tick', 20_000);
  assert.match(countdownSummary(done), /狀態：時間到\n剩餘時間：00:00:00$/);
});
