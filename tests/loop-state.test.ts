import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { taipeiDate } from '../scripts/loop-state.mjs';

const script = fileURLToPath(new URL('../scripts/loop-state.mjs', import.meta.url));
const date = '2026-10-01';
type Result = { status: number | null; stdout: string; stderr: string };

function temporary(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), 'invoice-loop-state-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function args(directory: string, command: string, extra: string[] = [], day = date) {
  return [script, command, '--state-dir', directory, '--date', day, ...extra];
}

function run(directory: string, command: string, extra: string[] = [], day = date): Result {
  return spawnSync(process.execPath, args(directory, command, extra, day), {
    encoding: 'utf8',
    cwd: directory,
  });
}

function successful(result: Result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function failed(result: Result, pattern: RegExp) {
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, pattern);
}

function acquire(directory: string, day = date) {
  return successful(run(directory, 'acquire', [], day));
}

function update(directory: string, token: string, patch: object, day = date) {
  return run(directory, 'update', ['--token', token, '--json', JSON.stringify(patch)], day);
}

function asyncRun(directory: string, command: string) {
  return new Promise<Result>((resolve, reject) => {
    const child = spawn(process.execPath, args(directory, command), { cwd: directory });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('two independent processes compete for one active lock and exactly one wins', async (t) => {
  const directory = temporary(t);
  const results = await Promise.all([
    asyncRun(directory, 'acquire'),
    asyncRun(directory, 'acquire'),
  ]);
  assert.deepEqual(results.map((result) => result.status).toSorted(), [0, 1]);
  const winner = successful(results.find((result) => result.status === 0)!);
  failed(
    results.find((result) => result.status === 1)!,
    /Another run owns/,
  );
  const owner = JSON.parse(readFileSync(join(directory, 'active.lock', 'owner.json'), 'utf8'));
  assert.equal(owner.token, winner.owner.token);
  assert.equal(owner.runKey, 'invoice-helper:2026-10-01');
  assert.equal(successful(run(directory, 'status')).owner.token, undefined);
});

test('wrong tokens, missing locks, and another day cannot mutate or release state', (t) => {
  const directory = temporary(t);
  failed(update(directory, 'wrong', { feature: 'example' }), /token and run key must match/);
  const { owner } = acquire(directory);
  const before = readFileSync(join(directory, `${date}.json`), 'utf8');
  failed(update(directory, 'wrong', { feature: 'example' }), /token and run key must match/);
  failed(run(directory, 'release', ['--token', 'wrong']), /token and run key must match/);
  failed(
    update(directory, owner.token, { feature: 'example' }, '2026-10-02'),
    /token and run key must match/,
  );
  assert.equal(readFileSync(join(directory, `${date}.json`), 'utf8'), before);
  successful(run(directory, 'release', ['--token', owner.token]));
  failed(update(directory, owner.token, { feature: 'example' }), /token and run key must match/);
  failed(run(directory, 'release', ['--token', owner.token]), /token and run key must match/);
});

test('same-day resume preserves feature, PR and append-only evidence history; days remain queryable', (t) => {
  const directory = temporary(t);
  const first = acquire(directory);
  const firstPatch = {
    feature: 'selected-month-calendar-ics',
    featureBranch: 'codex/daily-feature-20261001',
    featurePr: 'https://github.com/example/invoice-helper/pull/42',
    verification: {
      status: 'failed',
      summary: 'Browser check found a failure',
      evidence: ['qa/browser-first.json'],
    },
  };
  const firstState = successful(update(directory, first.owner.token, firstPatch)).state;
  successful(run(directory, 'release', ['--token', first.owner.token]));
  const resumed = acquire(directory);
  assert.equal(resumed.resumed, true);
  assert.notEqual(resumed.owner.token, first.owner.token);
  assert.deepEqual(resumed.state, firstState);
  failed(update(directory, resumed.owner.token, { feature: 'new-feature' }), /already recorded/);
  failed(
    update(directory, resumed.owner.token, {
      featurePr: 'https://github.com/example/invoice-helper/pull/43',
    }),
    /already recorded/,
  );
  const secondState = successful(
    update(directory, resumed.owner.token, {
      verification: {
        status: 'passed',
        summary: 'Browser check passes after repair',
        evidence: ['qa/browser-second.json'],
      },
    }),
  ).state;
  assert.deepEqual(secondState.history.slice(0, -1), firstState.history);
  assert.deepEqual(secondState.history[1].changes, firstPatch);
  assert.equal(secondState.featurePr, firstPatch.featurePr);
  successful(run(directory, 'release', ['--token', resumed.owner.token]));
  const tomorrow = acquire(directory, '2026-10-02');
  successful(update(directory, tomorrow.owner.token, { feature: 'another-feature' }, '2026-10-02'));
  assert.equal(successful(run(directory, 'status')).state.feature, firstPatch.feature);
  assert.equal(
    successful(run(directory, 'status', [], '2026-10-02')).state.feature,
    'another-feature',
  );
  assert.deepEqual(readdirSync(directory).toSorted(), [
    '2026-10-01.json',
    '2026-10-02.json',
    'active.lock',
  ]);
});

test('legacy owner and state can be updated without replacing identity or losing their initial snapshot', (t) => {
  const directory = temporary(t);
  const owner = {
    token: 'existing-owner-token',
    thread: 'thread-id',
    runKey: 'invoice-helper:2026-10-01',
    startedAt: '2026-10-01T00:00:00.000Z',
    kind: 'manual',
    state: 'running',
  };
  const legacy = {
    runKey: owner.runKey,
    feature: 'selected-month-calendar-ics',
    status: 'running',
    bootstrapBranch: 'codex/daily-loop-foundation-20261001',
    featureBranch: 'codex/daily-feature-20261001',
  };
  mkdirSync(join(directory, 'active.lock'));
  writeFileSync(join(directory, 'active.lock', 'owner.json'), JSON.stringify(owner));
  writeFileSync(join(directory, `${date}.json`), JSON.stringify(legacy));
  const state = successful(
    update(directory, owner.token, {
      bootstrapPr: 'https://github.com/example/invoice-helper/pull/41',
      review: { status: 'pending', summary: 'Independent review requested', evidence: [] },
    }),
  ).state;
  assert.equal(state.version, 1);
  assert.deepEqual(state.history[0].state, legacy);
  assert.equal(state.history[0].action, 'legacy-snapshot');
  assert.equal(state.history[1].action, 'update');
  assert.equal(state.feature, legacy.feature);
  successful(run(directory, 'release', ['--token', owner.token]));
});

test('corrupt JSON, schemas and unsupported updates fail closed without altering the source', (t) => {
  const directory = temporary(t);
  const stateFile = join(directory, `${date}.json`);
  for (const raw of [
    '{',
    'null',
    '[]',
    JSON.stringify({ runKey: 'wrong', status: 'running' }),
    JSON.stringify({ runKey: 'invoice-helper:2026-10-01', status: 'running', version: 9 }),
    JSON.stringify({ runKey: 'invoice-helper:2026-10-01', status: 'running', history: [{}] }),
  ]) {
    writeFileSync(stateFile, raw);
    failed(run(directory, 'status'), /Cannot read valid JSON|Invalid state/);
    failed(run(directory, 'acquire'), /Cannot read valid JSON|Invalid state/);
    assert.equal(readFileSync(stateFile, 'utf8'), raw);
    assert.deepEqual(readdirSync(directory), [`${date}.json`]);
  }
  rmSync(stateFile);
  const { owner } = acquire(directory);
  const original = readFileSync(stateFile, 'utf8');
  for (const patch of [
    { history: [] },
    { random: 'value' },
    { feature: '' },
    { verification: { status: 'passed', summary: 'Trust me', evidence: [] } },
    { review: { status: 'passed', summary: 'Pass', evidence: ['review.txt'], extra: 'hidden' } },
  ]) {
    failed(update(directory, owner.token, patch), /Unsupported|must be|requires/);
    assert.equal(readFileSync(stateFile, 'utf8'), original);
  }
  writeFileSync(stateFile, '{');
  failed(update(directory, owner.token, { status: 'blocked' }), /Cannot read valid JSON/);
  assert.equal(readFileSync(stateFile, 'utf8'), '{');
  successful(run(directory, 'release', ['--token', owner.token]));
});

test('old or incomplete active locks are never stolen and simultaneous token mutations are blocked', (t) => {
  const directory = temporary(t);
  const { owner } = acquire(directory);
  const ownerFile = join(directory, 'active.lock', 'owner.json');
  writeFileSync(ownerFile, JSON.stringify({ ...owner, startedAt: '2000-01-01T00:00:00Z' }));
  failed(run(directory, 'acquire', [], '2026-10-02'), /Another run owns/);
  const mutation = join(directory, 'active.lock', 'mutation.lock');
  mkdirSync(mutation);
  failed(update(directory, owner.token, { status: 'blocked' }), /EEXIST/);
  failed(run(directory, 'release', ['--token', owner.token]), /EEXIST/);
  rmSync(mutation, { recursive: true });
  rmSync(ownerFile);
  failed(run(directory, 'status'), /missing or invalid owner/);
  failed(run(directory, 'acquire'), /Another run owns/);
  assert.deepEqual(readdirSync(join(directory, 'active.lock')), []);
});

test('completed days return their existing result without granting another run lock', (t) => {
  const directory = temporary(t);
  const { owner } = acquire(directory);
  successful(update(directory, owner.token, { feature: 'done-feature', status: 'completed' }));
  failed(update(directory, owner.token, { status: 'running' }), /Completed runs cannot be changed/);
  successful(run(directory, 'release', ['--token', owner.token]));
  const rerun = acquire(directory);
  assert.equal(rerun.acquired, false);
  assert.equal(rerun.reason, 'already-completed');
  assert.equal(rerun.state.feature, 'done-feature');
  assert.deepEqual(readdirSync(directory), [`${date}.json`]);
});

test('Taipei day boundaries and invalid CLI dates are explicit', (t) => {
  assert.equal(taipeiDate(new Date('2026-09-30T15:59:59Z')), '2026-09-30');
  assert.equal(taipeiDate(new Date('2026-09-30T16:00:00Z')), '2026-10-01');
  const directory = temporary(t);
  failed(run(directory, 'acquire', [], '2026-02-30'), /Invalid project name or date/);
  failed(run(directory, 'acquire', ['--project', '../escape']), /Invalid project name or date/);
  failed(run(directory, 'acquire', ['--kind', 'cron']), /Invalid run kind/);
  failed(run(directory, 'status', ['--unknown', 'value']), /Invalid, duplicate, or missing/);
  assert.deepEqual(readdirSync(directory), []);
});

test('an authenticated owner updates and releases its original Taipei day after midnight', (t) => {
  const directory = temporary(t);
  const clockFile = join(directory, 'test-clock.mjs');
  function atTime(instant: string, command: string, extra: string[] = []): Result {
    writeFileSync(
      clockFile,
      `const OriginalDate = Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [${JSON.stringify(instant)}])); }
  static now() { return new OriginalDate(${JSON.stringify(instant)}).getTime(); }
};\n`,
    );
    return spawnSync(
      process.execPath,
      ['--import', clockFile, script, command, '--state-dir', directory, ...extra],
      {
        encoding: 'utf8',
        cwd: directory,
      },
    );
  }
  const beforeMidnight = '2026-10-01T15:55:00.000Z';
  const afterMidnight = '2026-10-01T16:05:00.000Z';
  const { owner } = successful(atTime(beforeMidnight, 'acquire'));
  assert.equal(owner.runKey, 'invoice-helper:2026-10-01');
  const patch = ['--json', JSON.stringify({ feature: 'overnight-feature' })];
  failed(
    atTime(afterMidnight, 'update', ['--token', 'wrong', ...patch]),
    /token and run key must match/,
  );
  failed(atTime(afterMidnight, 'release', ['--token', 'wrong']), /token and run key must match/);
  failed(atTime(afterMidnight, 'update', patch), /token and run key must match/);
  failed(
    atTime(afterMidnight, 'update', ['--date', '2026-10-02', '--token', owner.token, ...patch]),
    /token and run key must match/,
  );
  failed(
    atTime(afterMidnight, 'release', ['--date', '2026-10-02', '--token', owner.token]),
    /token and run key must match/,
  );
  failed(
    atTime(afterMidnight, 'update', [
      '--project',
      'another-project',
      '--token',
      owner.token,
      ...patch,
    ]),
    /token and run key must match/,
  );
  const today = successful(atTime(afterMidnight, 'status'));
  assert.equal(today.runKey, 'invoice-helper:2026-10-02');
  assert.equal(today.state, null);
  assert.equal(today.owner.runKey, owner.runKey);
  const result = successful(atTime(afterMidnight, 'update', ['--token', owner.token, ...patch]));
  assert.equal(result.state.runKey, owner.runKey);
  assert.equal(result.state.feature, 'overnight-feature');
  assert.equal(
    JSON.parse(readFileSync(join(directory, '2026-10-01.json'), 'utf8')).feature,
    'overnight-feature',
  );
  const released = successful(atTime(afterMidnight, 'release', ['--token', owner.token]));
  assert.equal(released.runKey, owner.runKey);
  assert.deepEqual(readdirSync(directory).toSorted(), ['2026-10-01.json', 'test-clock.mjs']);
});
