import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('dist/client');
const base = process.argv[2] || '/';
const production = 'https://www.ctrls.com.tw/invoice/';
const sitemap = readFileSync(resolve(directory, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(
  urls.length,
  32,
  'Sitemap must include the home, directory, five tasks, four categories and twenty-one tools',
);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
const titles = new Set();

for (const url of urls) {
  assert.ok(url.startsWith(production) && !/[?#]/.test(url), `Unexpected URL: ${url}`);
  const path = url.slice(production.length);
  const html = readFileSync(resolve(directory, path, 'index.html'), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title, `Missing title: ${url}`);
  titles.add(title);
  assert.equal((html.match(/<h1>/g) || []).length, 1, `Expected one static heading: ${url}`);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${url}"`));
  assert.ok(html.includes(`property="og:url" content="${url}"`));
  assert.ok(html.includes('class="page-guide"') && html.includes('<dt>'));
  assert.ok(html.includes('<noscript>'));
  assert.doesNotMatch(html, /noindex|href="#(?:invoice|quote|category-)/);
  const json = html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, `Missing JSON-LD: ${url}`);
  const data = JSON.parse(json);
  assert.ok(data['@graph'].some((entry) => entry['@id'] === `${url}#webpage`));
  const itemList = data['@graph'].find((entry) => entry['@type'] === 'ItemList');
  if (itemList) {
    const visibleLinks = [...html.matchAll(/<li><a href="([^"]+)">/g)].map(
      (match) => production + match[1].slice(base.length),
    );
    assert.deepEqual(
      itemList.itemListElement.map((entry) => entry.url),
      visibleLinks,
      `ItemList must match the visible collection links: ${url}`,
    );
  }
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0, `Missing application script: ${url}`);
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith('/'));
  for (const resource of resources) {
    assert.ok(resource.startsWith(base), `Wrong asset/link base: ${resource}`);
    const file = resource.slice(base.length);
    assert.ok(
      existsSync(resolve(directory, file.endsWith('/') || !file ? `${file}index.html` : file)),
      `Missing target: ${resource}`,
    );
  }
}
assert.equal(titles.size, urls.length, 'Pages must have distinct titles');
console.log(
  `SEO build verified: ${urls.length} HTML pages, sitemap, static copy, metadata, JSON-LD and local links/assets (base ${base}).`,
);
