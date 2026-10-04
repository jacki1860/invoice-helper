import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const identityFields = new Set([
  'feature',
  'bootstrapBranch',
  'featureBranch',
  'bootstrapPr',
  'featurePr',
]);
const evidenceFields = new Set(['review', 'verification', 'deployment', 'improvements']);
const patchFields = new Set([...identityFields, ...evidenceFields, 'status', 'blockedReason']);
const statuses = new Set(['running', 'blocked', 'completed']);
const evidenceStatuses = new Set(['pending', 'passed', 'failed', 'blocked', 'skipped']);
const own = (value, key) => Object.hasOwn(value, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function readJson(path) {
  // ENOENT is the only absence case; malformed JSON and other I/O errors fail closed.
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw new Error(`Cannot read valid JSON at ${path}: ${error.message}`, { cause: error });
  }
}

function writeJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, path);
}

function validatePatch(patch) {
  if (!object(patch) || Object.keys(patch).length === 0)
    throw new Error('Update must be a nonempty JSON object.');
  for (const [key, value] of Object.entries(patch)) {
    if (!patchFields.has(key)) throw new Error(`Unsupported update field: ${key}`);
    if (identityFields.has(key) && (typeof value !== 'string' || !value.trim()))
      throw new Error(`${key} must be a nonempty string (PR fields use their URL).`);
    if (key === 'status' && !statuses.has(value)) throw new Error('Invalid run status.');
    if (key === 'blockedReason' && typeof value !== 'string')
      throw new Error('blockedReason must be a string.');
    if (evidenceFields.has(key)) {
      if (
        !object(value) ||
        Object.keys(value).some((field) => !['status', 'summary', 'evidence'].includes(field)) ||
        !evidenceStatuses.has(value.status) ||
        typeof value.summary !== 'string' ||
        !value.summary.trim() ||
        !Array.isArray(value.evidence) ||
        value.evidence.some((item) => typeof item !== 'string' || !item.trim()) ||
        (value.status === 'passed' && value.evidence.length === 0)
      )
        throw new Error(
          `${key} requires status, summary, and evidence strings; passed requires evidence.`,
        );
    }
  }
}

function readState(context) {
  const state = readJson(context.stateFile);
  if (state === undefined) return null;
  if (
    !object(state) ||
    state.runKey !== context.runKey ||
    (own(state, 'version') && (state.version !== 1 || !Array.isArray(state.history))) ||
    !statuses.has(state.status) ||
    (own(state, 'updatedAt') &&
      (typeof state.updatedAt !== 'string' || !Number.isFinite(Date.parse(state.updatedAt)))) ||
    (own(state, 'history') &&
      (!Array.isArray(state.history) ||
        state.history.some(
          (entry) =>
            !object(entry) ||
            typeof entry.at !== 'string' ||
            !Number.isFinite(Date.parse(entry.at)) ||
            !['acquire', 'update', 'legacy-snapshot'].includes(entry.action),
        )))
  )
    throw new Error(
      `Invalid state schema or run key at ${context.stateFile}; manual recovery required.`,
    );
  const data = Object.fromEntries(Object.entries(state).filter(([key]) => patchFields.has(key)));
  validatePatch(data);
  for (const entry of state.history || []) {
    if (entry.action === 'update') validatePatch(entry.changes);
    if (
      entry.action === 'legacy-snapshot' &&
      (!object(entry.state) || entry.state.runKey !== context.runKey)
    )
      throw new Error('Invalid legacy history snapshot.');
  }
  if (
    Object.keys(state).some(
      (key) =>
        !patchFields.has(key) && !['runKey', 'version', 'history', 'updatedAt'].includes(key),
    )
  )
    throw new Error(`Unknown state fields at ${context.stateFile}; manual recovery required.`);
  return state;
}

function readOwner(context) {
  if (!existsSync(context.lockDir)) return null;
  const owner = readJson(join(context.lockDir, 'owner.json'));
  if (
    !object(owner) ||
    typeof owner.token !== 'string' ||
    !owner.token ||
    typeof owner.runKey !== 'string' ||
    typeof owner.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(owner.startedAt))
  )
    throw new Error(
      'Active lock has missing or invalid owner metadata; verify its owner manually. Never steal by age.',
    );
  return owner;
}

function requireOwner(context, token) {
  const owner = readOwner(context);
  if (!token || !owner || owner.token !== token || owner.runKey !== context.runKey)
    throw new Error('Active lock token and run key must match; operation refused.');
  return owner;
}

function withMutation(context, token, callback) {
  requireOwner(context, token);
  const mutationDir = join(context.lockDir, 'mutation.lock');
  mkdirSync(mutationDir);
  try {
    requireOwner(context, token);
    return callback();
  } finally {
    rmdirSync(mutationDir);
  }
}

function acquire(context, options) {
  // Validate before creating a lock, and reread after acquiring to avoid stale state.
  readState(context);
  mkdirSync(context.stateDir, { recursive: true });
  try {
    mkdirSync(context.lockDir);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('Another run owns active.lock. Inspect status; do not steal by age.', {
        cause: error,
      });
    throw error;
  }
  const owner = {
    token: randomUUID(),
    runKey: context.runKey,
    startedAt: new Date().toISOString(),
    thread: options.thread || 'unspecified',
    kind: options.kind || 'manual',
    state: 'running',
  };
  // A crash after mkdir remains visibly locked and requires an operator to confirm termination.
  writeJson(join(context.lockDir, 'owner.json'), owner);
  const previous = readState(context);
  if (previous?.status === 'completed') {
    unlinkSync(join(context.lockDir, 'owner.json'));
    rmdirSync(context.lockDir);
    return { acquired: false, reason: 'already-completed', state: previous };
  }
  const state = previous || {
    version: 1,
    runKey: context.runKey,
    status: 'running',
    history: [{ at: owner.startedAt, action: 'acquire' }],
    updatedAt: owner.startedAt,
  };
  if (!previous) writeJson(context.stateFile, state);
  return { acquired: true, owner, state, resumed: previous !== null };
}

function update(context, options) {
  if (!options.json) throw new Error('update requires --json and --token.');
  const patch = JSON.parse(options.json);
  validatePatch(patch);
  return withMutation(context, options.token, () => {
    const previous = readState(context);
    if (!previous) throw new Error('Run state is missing; refusing to reconstruct it.');
    if (previous.status === 'completed') throw new Error('Completed runs cannot be changed.');
    for (const key of identityFields) {
      if (own(previous, key) && own(patch, key) && !isDeepStrictEqual(previous[key], patch[key]))
        throw new Error(
          `${key} is already recorded; resume its existing work instead of replacing it.`,
        );
    }
    const at = new Date().toISOString();
    const history = previous.history || [{ at, action: 'legacy-snapshot', state: previous }];
    const state = {
      ...previous,
      ...patch,
      version: 1,
      updatedAt: at,
      history: [...history, { at, action: 'update', changes: patch }],
    };
    writeJson(context.stateFile, state);
    return { updated: true, state };
  });
}

function release(context, options) {
  withMutation(context, options.token, () => unlinkSync(join(context.lockDir, 'owner.json')));
  rmdirSync(context.lockDir);
  return { released: true, runKey: context.runKey };
}

function parseArguments(argv) {
  const [command, ...args] = argv;
  if (!['acquire', 'status', 'update', 'release'].includes(command))
    throw new Error(
      'Usage: loop-state.mjs acquire|status|update|release [--state-dir DIR] [--date YYYY-MM-DD] [--project NAME] [--token TOKEN] [--json JSON] [--thread ID] [--kind manual|heartbeat]',
    );
  const options = {};
  const allowed = new Set(['state-dir', 'date', 'project', 'token', 'json', 'thread', 'kind']);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].replace(/^--/, '');
    if (
      !args[index].startsWith('--') ||
      !allowed.has(key) ||
      own(options, key) ||
      args[index + 1] === undefined ||
      args[index + 1].startsWith('--')
    )
      throw new Error(`Invalid, duplicate, or missing option: ${args[index]}`);
    options[key] = args[index + 1];
  }
  if (options.kind && !['manual', 'heartbeat'].includes(options.kind))
    throw new Error('Invalid run kind.');
  const project = options.project || 'invoice-helper';
  let date = options.date || taipeiDate();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(project) || !validDate(date))
    throw new Error('Invalid project name or date.');
  const stateDir = options['state-dir']
    ? resolve(options['state-dir'])
    : join(
        execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
          encoding: 'utf8',
        }).trim(),
        'engineering-loop',
      );
  const lockDir = join(stateDir, 'active.lock');
  if (!options.date && ['update', 'release'].includes(command)) {
    // A run keeps its original Taipei date across midnight. Authenticate before
    // using owner metadata; an explicit date must still match in requireOwner.
    const owner = readOwner({ lockDir });
    if (
      !options.token ||
      !owner ||
      owner.token !== options.token ||
      !owner.runKey.startsWith(`${project}:`)
    )
      throw new Error('Active lock token and run key must match; operation refused.');
    date = owner.runKey.slice(project.length + 1);
    if (!validDate(date))
      throw new Error('Active lock has an invalid run date; manual recovery required.');
  }
  return {
    command,
    options,
    context: {
      stateDir,
      stateFile: join(stateDir, `${date}.json`),
      lockDir,
      runKey: `${project}:${date}`,
    },
  };
}

function main() {
  try {
    const { command, options, context } = parseArguments(process.argv.slice(2));
    let result;
    if (command === 'acquire') result = acquire(context, options);
    if (command === 'update') result = update(context, options);
    if (command === 'release') result = release(context, options);
    if (command === 'status') {
      const owner = readOwner(context);
      const { token: _token, ...visibleOwner } = owner || {};
      result = {
        runKey: context.runKey,
        state: readState(context),
        owner: owner ? visibleOwner : null,
      };
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`loop-state: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
