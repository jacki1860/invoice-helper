import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categories,
  tools,
  taskCollections,
  isOverviewPage,
  pageFromPath,
  pagePath,
  resolveLocation,
  type PageId,
} from '../src/features/tools/catalog.ts';
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

test('all 33 public pages have unique direct paths and preserve existing tool and category URLs', () => {
  assert.equal(pageIds.length, 33);
  for (const base of ['/', '/invoice/']) {
    const paths = pageIds.map((page) => pagePath(page, base));
    assert.equal(new Set(paths).size, 33);
    pageIds.forEach((page, index) => {
      assert.equal(pageFromPath(paths[index], base), page);
      assert.equal(pageFromPath(`${paths[index]}index.html`, base), page);
    });
    assert.equal(pageFromPath(`${base}missing/`, base), undefined);
    assert.equal(pageFromPath(`${base}category/missing/`, base), undefined);
    assert.equal(pageFromPath(`${base}task/missing/`, base), undefined);
    assert.equal(pagePath('tools', base), base);
    assert.equal(pagePath('directory', base), `${base}directory/`);
    for (const tool of tools) assert.equal(pagePath(tool.id, base), `${base}${tool.id}/`);
    for (const category of categories)
      assert.equal(pagePath(`category-${category.id}`, base), `${base}category/${category.id}/`);
    for (const task of taskCollections)
      assert.equal(pagePath(`task-${task.id}`, base), `${base}task/${task.id}/`);
  }
  assert.equal(pageFromPath('/outside/quote/', '/invoice/'), undefined);
  assert.equal(pageFromPath('/invoice/tools/', '/invoice/'), undefined);
});

test('legacy hashes and prefill still resolve while real paths select their tool', () => {
  const location = { pathname: '/invoice/', hash: '', search: '' };
  assert.equal(resolveLocation(location, '/invoice/'), 'tools');
  assert.equal(resolveLocation({ ...location, hash: '#invoice' }, '/invoice/'), 'invoice');
  assert.equal(
    resolveLocation({ ...location, hash: '#tools', search: '?amount=1050' }, '/invoice/'),
    'tools',
  );
  assert.equal(
    resolveLocation({ ...location, hash: '#category-documents' }, '/invoice/'),
    'category-documents',
  );
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
  for (const page of ['directory', 'task-quoting', 'task-reference'] as const) {
    assert.equal(
      resolveLocation(
        { ...location, pathname: pagePath(page, '/invoice/'), search: '?amount=1050' },
        '/invoice/',
      ),
      page,
    );
    assert.equal(resolveLocation({ ...location, hash: `#${page}` }, '/invoice/'), page);
  }
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

test('sitemap has only the 33 canonical URLs, no private prefill or pretend modification dates', () => {
  const sitemap = renderSitemap();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    urls,
    pageIds.map((page) => metadataForPage(page).canonical),
  );
  assert.equal(new Set(urls).size, 33);
  assert.doesNotMatch(sitemap, /lastmod/);
  for (const url of urls) assert.doesNotMatch(url, /\?|#/);
});

function guideLinks(page: PageId) {
  return [...renderPageGuide(page, '/invoice/').matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(
    (match) => ({ url: new URL(match[1], 'https://www.ctrls.com.tw').href, name: match[2] }),
  );
}

test('home links to five tasks and the directory instead of listing every tool', () => {
  const links = guideLinks('tools');
  assert.deepEqual(
    links.map(({ url }) => pageFromPath(new URL(url).pathname, '/invoice/')),
    [...taskCollections.map(({ id }) => `task-${id}`), 'directory'],
  );
  assert.equal(links.length, 6);
  assert.ok(
    tools.every((tool) => !links.some((link) => link.url === metadataForPage(tool.id).canonical)),
  );
  const navigation = renderStaticPage('tools', '/invoice/').match(
    /<nav class="tool-nav"[^>]*>(.*?)<\/nav>/s,
  )![1];
  assert.deepEqual(
    [...navigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
    ['/invoice/', '/invoice/directory/'],
  );
  assert.match(navigation, /依事情找工具/);
  assert.match(navigation, /全部工具/);
});

test('every tool remains discoverable within two static links from the task-based home', () => {
  const entryLinks = guideLinks('tools');
  const reachable = new Set(entryLinks.map(({ url }) => url));
  for (const { url } of entryLinks) {
    const page = pageFromPath(new URL(url).pathname, '/invoice/')!;
    for (const link of guideLinks(page)) reachable.add(link.url);
  }
  for (const tool of tools) assert.ok(reachable.has(metadataForPage(tool.id).canonical), tool.id);
});

test('collection ItemLists match the exact visible navigation order and do not invent hidden tools', () => {
  for (const page of pageIds.filter(isOverviewPage)) {
    const list = structuredDataForPage(page)['@graph'].find(
      (entry) => entry['@type'] === 'ItemList',
    )!;
    const items = list.itemListElement as { position: number; name: string; url: string }[];
    assert.deepEqual(
      items.map(({ name, url }) => ({ name, url })),
      guideLinks(page),
      page,
    );
    assert.deepEqual(
      items.map(({ position }) => position),
      items.map((_, index) => index + 1),
    );
  }
  for (const task of taskCollections) {
    assert.deepEqual(
      guideLinks(`task-${task.id}`).map(({ url }) =>
        pageFromPath(new URL(url).pathname, '/invoice/'),
      ),
      task.toolIds,
    );
  }
  assert.equal(guideLinks('directory').length, tools.length);
});

test('new task and directory breadcrumbs describe their own visible pages', () => {
  for (const page of [
    'directory',
    ...taskCollections.map(({ id }) => `task-${id}` as const),
  ] as const) {
    const breadcrumb = structuredDataForPage(page)['@graph'].find(
      (entry) => entry['@type'] === 'BreadcrumbList',
    )!;
    const trail = breadcrumb.itemListElement as { item: string; name: string }[];
    assert.equal(trail.length, 2);
    assert.equal(trail[0].item, metadataForPage('tools').canonical);
    assert.equal(trail[1].item, metadataForPage(page).canonical);
    assert.ok(
      renderStaticPage(page, '/invoice/').includes(`aria-current="page">${trail[1].name}</span>`),
    );
  }
});

test('tool guides keep only their original category peers and exclude the current tool', () => {
  for (const tool of tools) {
    assert.deepEqual(
      guideLinks(tool.id).map(({ url }) => pageFromPath(new URL(url).pathname, '/invoice/')),
      tools
        .filter((entry) => entry.id !== tool.id && entry.category === tool.category)
        .map(({ id }) => id),
    );
  }
});

test('overview help is natively expandable and closed by default while tool guides stay visible', () => {
  for (const page of pageIds) {
    const guide = renderPageGuide(page, '/invoice/');
    assert.match(guide, /^<section class="page-guide"/);
    if (isOverviewPage(page)) {
      assert.equal((guide.match(/<details\b/g) || []).length, 1, page);
      assert.match(guide, /<details class="overview-help"><summary>使用說明與常見問題<\/summary>/);
      assert.doesNotMatch(guide, /<details\b[^>]*\bopen(?:\s|=|>)/);
      assert.match(guide, /<\/nav>\s*<\/details>\s*<\/section>$/);
    } else {
      assert.doesNotMatch(guide, /<details\b|<summary\b/, page);
      assert.match(guide, /<section[^>]*>\s*<h2>/);
    }
  }
});

test('JSON-LD cannot break out of its script element', () => {
  const text = '</script><script>alert(1)</script>';
  const json = serializeJsonLd({ text });
  assert.ok(!json.includes('<'));
  assert.deepEqual(JSON.parse(json), { text });
});
