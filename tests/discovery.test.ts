import assert from 'node:assert/strict';
import test from 'node:test';
import {
  categories,
  categoryForPage,
  isOverviewPage,
  isPageId,
  pageFromPath,
  pagePath,
  resolveLocation,
  resolvePage,
  taskCollections,
  taskForPage,
  tools,
  toolsForPage,
  type PageId,
  type Tool,
} from '../src/features/tools/catalog.ts';
import { searchTools } from '../src/features/tools/discovery.ts';

const ids = (entries: Tool[]) => entries.map((tool) => tool.id);
const legacyPages: PageId[] = [
  'tools',
  ...categories.map((category) => `category-${category.id}` as const),
  ...tools.map((tool) => tool.id),
];
const newPages: PageId[] = [
  'directory',
  ...taskCollections.map((task) => `task-${task.id}` as const),
];

test('task collections cover every tool, have unique members, and support useful overlap', () => {
  assert.deepEqual(
    taskCollections.map((task) => task.id),
    ['quoting', 'payments', 'purchasing', 'expenses', 'reference'],
  );
  const allIds = ids(tools);
  for (const task of taskCollections) {
    assert.ok(task.label && task.description);
    assert.ok(task.toolIds.length > 0);
    assert.equal(new Set(task.toolIds).size, task.toolIds.length, task.id);
    assert.ok(
      task.toolIds.every((id) => allIds.includes(id)),
      task.id,
    );
  }
  assert.deepEqual(
    [...new Set(taskCollections.flatMap((task) => task.toolIds))].toSorted(),
    allIds.toSorted(),
  );
  assert.ok(taskForPage('task-quoting')?.toolIds.includes('quote'));
  assert.ok(taskForPage('task-payments')?.toolIds.includes('quote'));
});

test('all existing and new paths round-trip at root and company bases', () => {
  assert.equal(legacyPages.length, 26);
  for (const base of ['/', '/invoice/']) {
    for (const page of [...legacyPages, ...newPages]) {
      const path = pagePath(page, base);
      assert.equal(pageFromPath(path, base), page);
      assert.equal(pageFromPath(`${path}index.html`, base), page);
      assert.equal(resolveLocation({ pathname: path, hash: '', search: '' }, base), page);
      assert.equal(resolvePage(`#${page}`), page);
    }
    assert.equal(pagePath('directory', base), `${base}directory/`);
    assert.equal(pagePath('task-quoting', base), `${base}task/quoting/`);
    assert.equal(pagePath('quote', base), `${base}quote/`);
    assert.equal(pagePath('category-documents', base), `${base}category/documents/`);
    assert.equal(pageFromPath(`${base}task/missing/`, base), undefined);
    assert.equal(pageFromPath(`${base}directory/extra/`, base), undefined);
    assert.equal(pageFromPath(`${base}tools/`, base), undefined);
  }
  assert.equal(pageFromPath('/invoice-extra/task/quoting/', '/invoice/'), undefined);
  assert.equal(isPageId('task-missing'), false);
  assert.equal(isPageId('category-missing'), false);
});

test('legacy hashes and invoice query parameters retain their routing precedence', () => {
  for (const base of ['/', '/invoice/']) {
    const location = { pathname: base, hash: '', search: '' };
    for (const field of ['uniformNumber', 'amount', 'itemName', 'date']) {
      assert.equal(resolveLocation({ ...location, search: `?${field}=example` }, base), 'invoice');
    }
    assert.equal(
      resolveLocation({ ...location, pathname: `${base}tax/`, hash: '#quote' }, base),
      'quote',
    );
    assert.equal(
      resolveLocation({ ...location, pathname: `${base}quote/`, search: '?amount=100' }, base),
      'quote',
    );
    assert.equal(
      resolveLocation({ ...location, pathname: `${base}directory/`, search: '?amount=100' }, base),
      'directory',
    );
    assert.equal(resolveLocation({ ...location, hash: '#unknown' }, base), 'tools');
  }
});

test('overview selectors preserve task order and category-related tools', () => {
  assert.deepEqual(ids(toolsForPage('tools')), ids(tools));
  assert.deepEqual(ids(toolsForPage('directory')), ids(tools));
  for (const task of taskCollections) {
    const page = `task-${task.id}` as const;
    assert.equal(taskForPage(page), task);
    assert.equal(categoryForPage(page), undefined);
    assert.equal(isOverviewPage(page), true);
    assert.deepEqual(ids(toolsForPage(page)), task.toolIds);
  }
  for (const category of categories) {
    const page = `category-${category.id}` as const;
    assert.equal(isOverviewPage(page), true);
    assert.deepEqual(
      ids(toolsForPage(page)),
      ids(tools.filter((tool) => tool.category === category.id)),
    );
  }
  for (const tool of tools) {
    assert.equal(isOverviewPage(tool.id), false);
    assert.equal(taskForPage(tool.id), undefined);
    assert.deepEqual(
      ids(toolsForPage(tool.id)),
      ids(tools.filter((entry) => entry.category === tool.category)),
    );
  }
  assert.equal(isOverviewPage('tools'), true);
  assert.equal(isOverviewPage('directory'), true);
});

test('global search matches user vocabulary across functional categories', () => {
  assert.deepEqual(ids(searchTools('催款')), ['receivables']);
  assert.deepEqual(ids(searchTools('報帳')), ['expense']);
  assert.deepEqual(ids(searchTools('統一編號')), ['company']);
  assert.deepEqual(ids(searchTools('營業日')), ['workdays']);
  assert.deepEqual(ids(searchTools('清除重複')), ['list-cleanup']);
  assert.deepEqual(ids(searchTools('清單 TXT')), ['list-cleanup']);
  assert.ok(searchTools('付款').some((tool) => tool.category === 'documents'));
  assert.ok(searchTools('付款').some((tool) => tool.category === 'calculations'));
  assert.deepEqual(ids(searchTools('催款 備份')), ['receivables']);
  assert.deepEqual(ids(searchTools('報帳 催款')), []);
});

test('search normalizes full-width characters, case and whitespace with AND matching', () => {
  assert.deepEqual(ids(searchTools('  ＰＤＦ　報價單\n')), ['quote']);
  assert.deepEqual(ids(searchTools('稅額 ５％')), ['tax']);
  assert.deepEqual(ids(searchTools('ICS')), ['calendar']);
  assert.deepEqual(ids(searchTools('')), ids(tools));
  assert.deepEqual(ids(searchTools(' \n\t　')), ids(tools));
  assert.deepEqual(ids(searchTools('不存在的行政工具')), []);
});

test('meeting agenda is discoverable by practical meeting preparation terms', () => {
  for (const query of ['會議安排', '議程表', '開會流程', '討論時程']) {
    assert.deepEqual(ids(searchTools(query)), ['meeting-agenda']);
  }
});
