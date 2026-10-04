import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test, { type TestContext } from 'node:test';

const script = fileURLToPath(new URL('../scripts/release/release.py', import.meta.url));
const commitA = 'a'.repeat(40);
const commitB = 'b'.repeat(40);
const commitC = 'c'.repeat(40);
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function fixture(t: TestContext) {
  // Use fixed /tmp, ignoring caller-controlled TMPDIR; macOS canonicalizes to /private/tmp.
  const root = realpathSync(mkdtempSync(join('/tmp', 'invoice-release-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'dist', 'client');
  mkdirSync(join(source, 'assets'), { recursive: true });
  mkdirSync(join(source, 'new-tool'));
  writeFileSync(join(source, 'index.html'), '<html><body>Release A</body></html>');
  writeFileSync(join(source, 'new-tool', 'index.html'), '<html>New tool</html>');
  writeFileSync(join(source, 'assets', 'app.js'), 'document.body.dataset.ready = "true";');
  writeFileSync(join(source, 'assets', 'app.css'), 'body { color: #000; }');
  writeFileSync(join(source, 'image.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  writeFileSync(join(source, '.assetsignore'), 'Cloudflare metadata, not a public output');
  return { root, source };
}

function run(...args: string[]) {
  return spawnSync('python3', [script, ...args], { encoding: 'utf8', timeout: 20000 });
}

function success(...args: string[]) {
  const result = run(...args);
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}

function failure(args: string[], message: RegExp) {
  const result = run(...args);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, message);
}

function pack(source: string, root: string, commit = commitA) {
  const artifact = join(root, `artifact-${commit[0]}`);
  const result = success('pack', '--source', source, '--commit', commit, '--output', artifact);
  return { artifact, commit, manifestSha256: result.manifestSha256 };
}

type Artifact = ReturnType<typeof pack>;

function artifactArgs(artifact: Artifact) {
  return [
    '--artifact',
    artifact.artifact,
    '--commit',
    artifact.commit,
    '--manifest-sha256',
    artifact.manifestSha256,
  ];
}

function activationArgs(artifact: Artifact, root: string, expected: string) {
  return [
    'activate',
    ...artifactArgs(artifact),
    '--sandbox-root',
    root,
    '--expected-current',
    expected,
  ];
}

function rollbackArgs(root: string, to: string, expected: string) {
  return ['rollback', '--sandbox-root', root, '--to', to, '--expected-current', expected];
}

function editManifest(artifact: Artifact, change: (manifest: any) => void) {
  const path = join(artifact.artifact, 'manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  change(manifest);
  const encoded = JSON.stringify(manifest);
  writeFileSync(path, encoded);
  artifact.manifestSha256 = sha(encoded);
}

// Deliberately re-pin the outer manifest hash to ensure inner tar validation,
// not merely the outer checksum, rejects a malicious reviewed-looking bundle.
function mutateTar(artifact: Artifact, mutation: string) {
  const result = spawnSync(
    'python3',
    [
      '-c',
      `
import io, json, pathlib, sys, tarfile
root = pathlib.Path(sys.argv[1])
mutation = sys.argv[2]
with tarfile.open(root / 'client.tar.gz', 'r:gz') as archive:
    entries = [(entry, archive.extractfile(entry).read()) for entry in archive]
if mutation == 'missing':
    entries.pop()
elif mutation == 'duplicate':
    entries.append(entries[0])
elif mutation in ('traversal', 'absolute', 'backslash', 'unknown', 'extra'):
    entry, data = entries[0]
    entry.name = {'traversal': '../escape.html', 'absolute': '/tmp/escape.html',
                  'backslash': 'assets\\\\escape.js', 'unknown': 'server.py',
                  'extra': 'unreviewed.js'}[mutation]
elif mutation in ('symlink', 'hardlink', 'directory', 'fifo'):
    entry, data = entries[0]
    entry.type = {'symlink': tarfile.SYMTYPE, 'hardlink': tarfile.LNKTYPE,
                  'directory': tarfile.DIRTYPE, 'fifo': tarfile.FIFOTYPE}[mutation]
    entry.linkname = 'index.html'
    entry.size = 0
elif mutation == 'file-hash':
    entry, data = entries[0]
    entries[0] = (entry, b'X' * len(data))
with tarfile.open(root / 'client.tar.gz', 'w:gz', format=tarfile.USTAR_FORMAT) as archive:
    for entry, data in entries:
        archive.addfile(entry, io.BytesIO(data) if entry.isreg() else None)
`,
      artifact.artifact,
      mutation,
    ],
    { encoding: 'utf8', timeout: 20000 },
  );
  assert.equal(result.status, 0, result.stderr);
  editManifest(artifact, (manifest) => {
    manifest.archiveSha256 = sha(readFileSync(join(artifact.artifact, 'client.tar.gz')));
  });
}

test('static package is deterministic, dynamically lists all outputs, and binds its commit', (t) => {
  const { root, source } = fixture(t);
  for (let i = 0; i < 42; i++) {
    mkdirSync(join(source, `tool-${i}`));
    writeFileSync(join(source, `tool-${i}`, 'index.html'), `<html>Tool ${i}</html>`);
  }
  const artifact = pack(source, root);
  const verified = success('verify', ...artifactArgs(artifact));
  assert.equal(verified.files, 47);
  assert.equal(verified.commit, commitA);
  const manifest = JSON.parse(readFileSync(join(artifact.artifact, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.some((entry: any) => entry.path === 'image.png'));
  assert.ok(!manifest.files.some((entry: any) => entry.path === '.assetsignore'));
  const repeated = success(
    'pack',
    '--source',
    source,
    '--commit',
    commitA,
    '--output',
    join(root, 'repeat'),
  );
  assert.equal(repeated.manifestSha256, artifact.manifestSha256);
  for (const entry of manifest.files) {
    const data = readFileSync(join(source, entry.path));
    assert.equal(entry.sha256, sha(data));
    assert.equal(entry.size, data.length);
  }
  failure(['verify', ...artifactArgs({ ...artifact, commit: commitB })], /commit differs/);
});

test('pack rejects sensitive names, unknown extensions, symlinks and hardlinks', async (t) => {
  for (const name of [
    '.env',
    'credentials.json',
    'assets/private-key.txt',
    'source.map',
    'server.py',
    '_worker.js',
  ]) {
    await t.test(name, (subtest) => {
      const { root, source } = fixture(subtest);
      writeFileSync(join(source, name), 'not a real credential');
      failure(
        ['pack', '--source', source, '--commit', commitA, '--output', join(root, 'bad')],
        /Unsafe path|Sensitive|Unknown/,
      );
      assert.ok(!existsSync(join(root, 'bad')));
    });
  }
  for (const kind of ['file-symlink', 'directory-symlink', 'hardlink']) {
    await t.test(kind, (subtest) => {
      const { root, source } = fixture(subtest);
      if (kind === 'hardlink') linkSync(join(source, 'index.html'), join(source, 'copy.html'));
      else
        symlinkSync(
          kind === 'file-symlink' ? join(source, 'index.html') : join(source, 'assets'),
          join(source, 'linked.js'),
        );
      failure(
        ['pack', '--source', source, '--commit', commitA, '--output', join(root, 'bad')],
        /Symlink or special/,
      );
    });
  }
});

test('verify pins the complete manifest and archive hashes before extraction', (t) => {
  const { root, source } = fixture(t);
  const artifact = pack(source, root);
  const manifest = join(artifact.artifact, 'manifest.json');
  const original = readFileSync(manifest);
  writeFileSync(manifest, Buffer.concat([original, Buffer.from(' ')]));
  failure(['verify', ...artifactArgs(artifact)], /Manifest checksum mismatch/);
  writeFileSync(manifest, original);
  writeFileSync(join(artifact.artifact, 'client.tar.gz'), 'bad tar');
  failure(['verify', ...artifactArgs(artifact)], /Archive checksum mismatch/);
});

test('tar traversal, special types, missing/extra/duplicate files and file hash changes are rejected', async (t) => {
  for (const mutation of [
    'traversal',
    'absolute',
    'backslash',
    'unknown',
    'extra',
    'duplicate',
    'missing',
    'symlink',
    'hardlink',
    'directory',
    'fifo',
    'file-hash',
  ]) {
    await t.test(mutation, (subtest) => {
      const { root, source } = fixture(subtest);
      const baseline = pack(source, root);
      success(...activationArgs(baseline, root, 'none'), '--apply');
      writeFileSync(join(source, 'index.html'), 'New release');
      const candidate = pack(source, root, commitB);
      mutateTar(candidate, mutation);
      const before = readlinkSync(join(root, 'current'));
      failure(
        [...activationArgs(candidate, root, commitA), '--apply'],
        /Unsafe path|Unknown static|Unexpected or duplicate|missing manifest|ordinary tar|File checksum/,
      );
      assert.equal(readlinkSync(join(root, 'current')), before);
      assert.ok(!existsSync(join(root, 'releases', commitB)));
      assert.ok(!existsSync(join(root, 'escape.html')));
    });
  }
});

test('manifest schema, sorted unique allowlist, and path traversal are checked independently', async (t) => {
  const changes = [
    (manifest: any) => {
      manifest.files[0].path = '../escape.js';
    },
    (manifest: any) => {
      manifest.files.push(manifest.files[0]);
    },
    (manifest: any) => {
      manifest.files[0].size = true;
    },
    (manifest: any) => {
      manifest.files[0].sha256 = 'not-a-hash';
    },
    (manifest: any) => {
      manifest.project = 'another-project';
    },
    (manifest: any) => {
      manifest.unreviewedField = true;
    },
  ];
  for (const [index, change] of changes.entries()) {
    await t.test(`manifest mutation ${index}`, (subtest) => {
      const { root, source } = fixture(subtest);
      const artifact = pack(source, root);
      editManifest(artifact, change);
      failure(
        ['verify', ...artifactArgs(artifact)],
        /Unsafe path|sorted and unique|Invalid|Unsupported|Unexpected/,
      );
    });
  }
});

test('dry-run never creates release state; apply, verification and rollback preserve both releases', (t) => {
  const { root, source } = fixture(t);
  const first = pack(source, root);
  const before = readdirSync(root).toSorted();
  assert.equal(success(...activationArgs(first, root, 'none')).status, 'dry-run');
  assert.deepEqual(readdirSync(root).toSorted(), before);
  success(...activationArgs(first, root, 'none'), '--apply');
  writeFileSync(join(source, 'index.html'), '<html>Release B</html>');
  const second = pack(source, root, commitB);
  const activated = success(...activationArgs(second, root, commitA), '--apply');
  assert.equal(activated.previousCommit, commitA);
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitB));
  assert.equal(readFileSync(join(root, 'current', 'index.html'), 'utf8'), '<html>Release B</html>');
  assert.ok(existsSync(join(root, 'releases', commitA, 'image.png')));
  assert.equal(success(...rollbackArgs(root, commitA, commitB)).status, 'dry-run');
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitB));
  assert.equal(success(...rollbackArgs(root, commitA, commitB), '--apply').status, 'rolled-back');
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitA));
  assert.ok(existsSync(join(root, 'releases', commitB, 'index.html')));
});

test('wrong previous and newer live release reject activation/rollback without changing live', (t) => {
  const { root, source } = fixture(t);
  const first = pack(source, root);
  success(...activationArgs(first, root, 'none'), '--apply');
  const second = pack(source, root, commitB);
  failure([...activationArgs(second, root, commitC), '--apply'], /differs from expected-current/);
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitA));
  success(...activationArgs(second, root, commitA), '--apply');
  const third = pack(source, root, commitC);
  success(...activationArgs(third, root, commitB), '--apply');
  failure([...rollbackArgs(root, commitA, commitB), '--apply'], /differs from expected-current/);
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitC));
});

test('rollback validates the retained target but can recover a corrupted current release', (t) => {
  const { root, source } = fixture(t);
  const first = pack(source, root);
  const second = pack(source, root, commitB);
  success(...activationArgs(first, root, 'none'), '--apply');
  success(...activationArgs(second, root, commitA), '--apply');
  writeFileSync(join(root, 'releases', commitA, 'index.html'), 'damaged rollback target');
  failure([...rollbackArgs(root, commitA, commitB), '--apply'], /Installed file checksum mismatch/);
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitB));
  writeFileSync(
    join(root, 'releases', commitA, 'index.html'),
    readFileSync(join(source, 'index.html')),
  );
  writeFileSync(join(root, 'releases', commitB, 'index.html'), 'damaged current release');
  success(...rollbackArgs(root, commitA, commitB), '--apply');
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitA));
});

test('a held deployment lock rejects concurrent apply without switching live', async (t) => {
  const { root, source } = fixture(t);
  const first = pack(source, root);
  success(...activationArgs(first, root, 'none'), '--apply');
  const second = pack(source, root, commitB);
  const locker = spawn(
    'python3',
    [
      '-u',
      '-c',
      `
import fcntl, sys
with open(sys.argv[1], 'r+') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print('locked', flush=True)
    sys.stdin.read()
`,
      join(root, '.deploy.lock'),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  t.after(() => locker.kill());
  await once(locker.stdout, 'data');
  failure(
    [...activationArgs(second, root, commitA), '--apply'],
    /Another deployment holds the lock/,
  );
  assert.equal(readlinkSync(join(root, 'current')), join(root, 'releases', commitA));
  locker.stdin.end();
  await once(locker, 'close');
});

test('live links cannot escape the project and an actual live directory is never replaced', (t) => {
  const { root, source } = fixture(t);
  const first = pack(source, root);
  mkdirSync(join(root, 'outside', commitA), { recursive: true });
  symlinkSync(join(root, 'outside', commitA), join(root, 'current'));
  failure([...activationArgs(first, root, 'none'), '--apply'], /outside this project's releases/);
  rmSync(join(root, 'current'));
  mkdirSync(join(root, 'current'));
  failure([...activationArgs(first, root, 'none'), '--apply'], /must be a symlink/);
  assert.ok(existsSync(join(root, 'current')));
});

test('restrictive deployment umask still produces readable static files and traversable routes', (t) => {
  const { root, source } = fixture(t);
  const artifact = pack(source, root);
  const result = spawnSync(
    'python3',
    [
      '-c',
      'import os, runpy, sys; os.umask(0o077); sys.argv=sys.argv[1:]; runpy.run_path(sys.argv[0], run_name="__main__")',
      script,
      ...activationArgs(artifact, root, 'none'),
      '--apply',
    ],
    { encoding: 'utf8', timeout: 20000 },
  );
  assert.equal(result.status, 0, result.stderr);
  for (const path of ['', 'assets', 'new-tool']) {
    assert.equal(statSync(join(root, 'releases', commitA, path)).mode & 0o777, 0o755);
  }
  assert.equal(statSync(join(root, 'releases', commitA, 'index.html')).mode & 0o777, 0o644);
});

test('TMPDIR cannot authorize activation outside the fixed sandbox boundary', (t) => {
  const { root, source } = fixture(t);
  const artifact = pack(source, root);
  const outside = realpathSync(mkdtempSync(join('/var/tmp', 'invoice-release-outside-')));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const result = spawnSync(
    'python3',
    [script, ...activationArgs(artifact, outside, 'none'), '--apply'],
    {
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, TMPDIR: realpathSync('/var/tmp') },
    },
  );
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /fixed \/tmp directory/);
  assert.deepEqual(readdirSync(outside), []);
});
