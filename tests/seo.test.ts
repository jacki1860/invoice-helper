import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFromPath, pagePath, resolveLocation } from '../src/features/tools/catalog.ts';
import {
  pageIds,
  metadataForPage,
  structuredDataForPage,
  renderPageGuide,
  renderStaticPage,
  renderSeoHead,
  renderSitemap,
  serializeJsonLd,
} from '../src/features/seo/pages.ts';

test('every public page has a unique direct path under both hosting bases', () => {
  assert.equal(pageIds.length, 25);
  for (const base of ['/', '/invoice/']) {
    const paths = pageIds.map((page) => pagePath(page, base));
    assert.equal(new Set(paths).size, 25);
    pageIds.forEach((page, index) => {
      assert.equal(pageFromPath(paths[index], base), page);
      assert.equal(pageFromPath(`${paths[index]}index.html`, base), page);
    });
    assert.equal(pageFromPath(`${base}missing/`, base), undefined);
    assert.equal(pageFromPath(`${base}category/missing/`, base), undefined);
  }
  assert.equal(pageFromPath('/outside/quote/', '/invoice/'), undefined);
  assert.equal(pageFromPath('/invoice/tools/', '/invoice/'), undefined);
});

test('legacy hashes and prefill still resolve while real paths select their tool', () => {
  const location = { pathname: '/invoice/', hash: '', search: '' };
  assert.equal(resolveLocation(location, '/invoice/'), 'tools');
  assert.equal(resolveLocation({ ...location, hash: '#invoice' }, '/invoice/'), 'invoice');
  assert.equal(
    resolveLocation({ ...location, search: '?amount=1050&itemName=test' }, '/invoice/'),
    'invoice',
  );
  assert.equal(
    resolveLocation(
      { ...location, pathname: '/invoice/quote/', search: '?amount=1050' },
      '/invoice/',
    ),
    'quote',
  );
  assert.equal(
    resolveLocation({ ...location, pathname: '/invoice/tax/', hash: '#quote' }, '/invoice/'),
    'quote',
  );
  assert.equal(
    resolveLocation(
      { ...location, pathname: '/invoice/quote/', hash: '#main-content' },
      '/invoice/',
    ),
    'quote',
  );
});

test('every page exposes matching public copy, canonical and parseable structured data', () => {
  const titles = new Set<string>();
  for (const page of pageIds) {
    const meta = metadataForPage(page);
    titles.add(meta.title);
    assert.ok(meta.description.length > 30);
    assert.ok(meta.canonical.startsWith('https://www.ctrls.com.tw/invoice/'));
    assert.equal(new URL(meta.canonical).hash, '');
    assert.equal(new URL(meta.canonical).search, '');
    const head = renderSeoHead(page);
    assert.equal((head.match(/rel="canonical"/g) || []).length, 1);
    const json = head.match(/type="application\/ld\+json">(.*?)<\/script>/s)![1];
    assert.deepEqual(JSON.parse(json), structuredDataForPage(page));
    const guide = renderPageGuide(page, '/invoice/');
    assert.ok(renderStaticPage(page, '/invoice/').includes(guide));
    assert.ok(guide.includes('常見問題'));
    assert.ok(guide.includes('如何使用'));
    assert.doesNotMatch(guide, /href="#/);
    for (const match of guide.matchAll(/href="([^"]+)"/g)) {
      assert.ok(pageFromPath(match[1], '/invoice/'), `unresolved link: ${match[1]}`);
    }
  }
  assert.equal(titles.size, pageIds.length);
});

test('sitemap has only the 25 canonical URLs, no private prefill or pretend modification dates', () => {
  const sitemap = renderSitemap();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    urls,
    pageIds.map((page) => metadataForPage(page).canonical),
  );
  assert.equal(new Set(urls).size, 25);
  assert.doesNotMatch(sitemap, /lastmod/);
  for (const url of urls) assert.doesNotMatch(url, /\?|#/);
});

test('JSON-LD cannot break out of its script element', () => {
  const text = '</script><script>alert(1)</script>';
  const json = serializeJsonLd({ text });
  assert.ok(!json.includes('<'));
  assert.deepEqual(JSON.parse(json), { text });
});
