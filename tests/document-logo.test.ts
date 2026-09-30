import test from 'node:test';
import assert from 'node:assert/strict';
import {
  logoDimensions,
  MAX_LOGO_FILE_BYTES,
  validateLogoFile,
} from '../src/features/tools/documentLogo.ts';

test('logo accepts supported images within the size limit and rejects invalid uploads', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.doesNotThrow(() => validateLogoFile({ type, size: MAX_LOGO_FILE_BYTES }));
  }
  for (const type of ['image/svg+xml', 'image/gif', 'text/plain', '']) {
    assert.throws(() => validateLogoFile({ type, size: 100 }), /PNG、JPG 或 WebP/);
  }
  assert.throws(() => validateLogoFile({ type: 'image/png', size: 0 }), /空的/);
  assert.throws(
    () => validateLogoFile({ type: 'image/png', size: MAX_LOGO_FILE_BYTES + 1 }),
    /超過 5 MB/,
  );
});

test('logo resizing preserves wide and tall proportions without enlarging small files', () => {
  assert.deepEqual(logoDimensions(3200, 800), { width: 1600, height: 400 });
  assert.deepEqual(logoDimensions(800, 3200), { width: 400, height: 1600 });
  assert.deepEqual(logoDimensions(600, 200), { width: 600, height: 200 });
  assert.deepEqual(logoDimensions(12000, 1), { width: 1600, height: 1 });
  for (const [width, height] of [
    [0, 10],
    [10, -1],
    [12001, 1],
    [8000, 8000],
    [NaN, 10],
    [1.5, 2],
  ]) {
    assert.throws(() => logoDimensions(width, height), /尺寸過大或無效/);
  }
});
