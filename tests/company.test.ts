import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchCompanyInfo, lookupCompany } from '../src/utils/companyUtils.ts';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('uses finance data before company data and sends only the uniform number', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (input: string, options?: RequestInit) => {
    assert.equal(input, 'https://company.g0v.ronny.tw/api/show/22099131');
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.referrerPolicy, 'no-referrer');
    assert.equal(options?.body, undefined);
    assert.ok(options?.signal instanceof AbortSignal);
    return jsonResponse({
      data: {
        公司名稱: '公司登記名稱',
        公司所在地: '公司登記地址',
        財政部: { 營業人名稱: ' 營業名稱 ', 營業地址: ' 營業地址 ' },
      },
    });
  });
  assert.deepEqual(await lookupCompany('22099131'), {
    status: 'success',
    company: { uniformNumber: '22099131', name: '營業名稱', address: '營業地址' },
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('falls back to company fields and allows missing optional address', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    jsonResponse({
      data: {
        公司名稱: '公司登記名稱',
        公司所在地: '公司登記地址',
        財政部: { 營業人名稱: '', 營業地址: '' },
      },
    }),
  );
  assert.deepEqual(await lookupCompany('22099131'), {
    status: 'success',
    company: { uniformNumber: '22099131', name: '公司登記名稱', address: '公司登記地址' },
  });
  t.mock.method(globalThis, 'fetch', async () =>
    jsonResponse({ data: { 公司名稱: '公司登記名稱' } }),
  );
  assert.deepEqual(await lookupCompany('22099131'), {
    status: 'success',
    company: { uniformNumber: '22099131', name: '公司登記名稱', address: '' },
  });
});

test('supports the branch fields returned by the same endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    jsonResponse({
      data: {
        分公司名稱: '測試分公司',
        分公司所在地: '測試地址',
        財政部: {},
      },
    }),
  );
  assert.deepEqual(await lookupCompany('12345678'), {
    status: 'success',
    company: { uniformNumber: '12345678', name: '測試分公司', address: '測試地址' },
  });
});

test('404, explicit not found, and valid empty data are not-found', async (t) => {
  for (const response of [
    new Response('missing', { status: 404 }),
    jsonResponse({ error: 'not found' }),
    jsonResponse({ message: '查無資料' }),
    jsonResponse({ data: null }),
    jsonResponse({ data: {} }),
    jsonResponse({ data: { 財政部: {} } }),
    jsonResponse({ data: { 公司名稱: '', 財政部: { 營業人名稱: '' } } }),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    assert.deepEqual(await lookupCompany('99999999'), { status: 'not-found' });
  }
});

test('server errors are errors, not not-found', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ data: {} }, 500));
  assert.equal((await lookupCompany('22099131')).status, 'error');
});

test('invalid JSON and malformed shapes are errors', async (t) => {
  for (const response of [
    new Response('<html>unavailable</html>'),
    jsonResponse(null),
    jsonResponse([]),
    jsonResponse({}),
    jsonResponse({ data: [] }),
    jsonResponse({ data: 'bad' }),
    jsonResponse({ data: { unknown: 'wrong schema' } }),
    jsonResponse({ error: 'service failed', data: null }),
    jsonResponse({ success: false, data: {} }),
    jsonResponse({ data: { 公司名稱: 42 } }),
    jsonResponse({ data: { 財政部: [] } }),
    jsonResponse({ data: { 財政部: { unknown: 'wrong schema' } } }),
    jsonResponse({ data: { 公司所在地: 'address without a name' } }),
    jsonResponse({ data: { 財政部: { 營業人名稱: {}, 營業地址: '地址' } } }),
    jsonResponse({ data: { 公司名稱: '公司', 公司所在地: ['地址'] } }),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    assert.equal((await lookupCompany('22099131')).status, 'error');
  }
});

test('network failure is recoverable as an error result', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Network unavailable');
  });
  const result = await lookupCompany('22099131');
  assert.equal(result.status, 'error');
});

test('invalid input never calls the API and no checksum is required', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ data: {} }));
  for (const input of [
    '',
    '1234567',
    '123456789',
    'abcdefgh',
    '2209913 ',
    ' 22099131',
    '22099131/',
  ]) {
    assert.equal((await lookupCompany(input)).status, 'error');
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await lookupCompany('12345678')).status, 'not-found');
  assert.equal(fetch.mock.callCount(), 1);
});

test('pre-aborted request rejects as AbortError without calling fetch', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ data: {} }));
  const controller = new AbortController();
  controller.abort(new Error('custom cancellation reason'));
  await assert.rejects(lookupCompany('22099131', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('cancellation aborts the fetch and settles even if transport does not settle', async (t) => {
  let requestSignal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', (_input: string, options?: RequestInit) => {
    requestSignal = options?.signal ?? undefined;
    return new Promise<Response>(() => {});
  });
  const controller = new AbortController();
  const pending = lookupCompany('22099131', controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal?.aborted, true);
});

test('timeout is bounded and returns an error rather than cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', (_input: string, options?: RequestInit) => {
    requestSignal = options?.signal ?? undefined;
    return new Promise<Response>(() => {});
  });
  const pending = lookupCompany('22099131');
  t.mock.timers.tick(8_000);
  const result = await pending;
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.match(result.message, /逾時/);
  assert.equal(requestSignal?.aborted, true);
});

test('legacy wrapper returns a name or null', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ data: { 公司名稱: '公司名稱' } }));
  assert.equal(await fetchCompanyInfo('22099131'), '公司名稱');
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ data: {} }));
  assert.equal(await fetchCompanyInfo('99999999'), null);
  assert.equal(await fetchCompanyInfo('bad'), null);
});
