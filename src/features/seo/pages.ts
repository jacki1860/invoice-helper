import { categories, tools, categoryForPage, pagePath, type PageId } from '../tools/catalog.ts';
import { homeContent, toolContent, type PageContent } from './content.ts';

export const siteUrl = 'https://www.ctrls.com.tw/invoice/';
export const pageIds: PageId[] = [
  'tools',
  ...categories.map(({ id }) => `category-${id}` as const),
  ...tools.map(({ id }) => id),
];

export function contentForPage(page: PageId): PageContent {
  if (page === 'tools') return homeContent;
  if (!page.startsWith('category-')) return toolContent[page as keyof typeof toolContent];
  const category = categories.find(({ id }) => `category-${id}` === page)!;
  const entries = tools.filter(({ category: id }) => id === category.id);
  return {
    heading: `${category.label}工具`,
    description: `小事務提供免登入的${category.label}工具，包含${entries.map(({ label }) => label).join('、')}。${category.description}`,
    steps: [
      '從下方工具清單選擇要處理的工作。',
      '依工具畫面的欄位輸入資料，或選擇要查閱的項目。',
      '核對結果與適用範圍，再使用工具提供的複製、匯出或來源連結。',
    ],
    faqs: homeContent.faqs.slice(0, 2),
  };
}

export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function canonicalUrl(page: PageId): string {
  return new URL(pagePath(page, '/invoice/'), siteUrl).href;
}

export function metadataForPage(page: PageId) {
  const content = contentForPage(page);
  return {
    title: `${content.heading}｜小事務`,
    description: content.description,
    canonical: canonicalUrl(page),
  };
}

export function structuredDataForPage(page: PageId) {
  const content = contentForPage(page);
  const url = canonicalUrl(page);
  const category = categoryForPage(page);
  const tool = tools.find(({ id }) => id === page);
  const collection = !tool;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      url: siteUrl,
      name: '小事務',
      alternateName: 'everyday admin',
      inLanguage: 'zh-Hant-TW',
    },
    {
      '@type': collection ? 'CollectionPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: content.heading,
      description: content.description,
      inLanguage: 'zh-Hant-TW',
      isPartOf: { '@id': `${siteUrl}#website` },
      mainEntity: { '@id': `${url}#${collection ? 'tools' : 'application'}` },
      ...(page !== 'tools' ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    },
  ];
  if (tool) {
    graph.push({
      '@type': 'WebApplication',
      '@id': `${url}#application`,
      url,
      name: tool.label,
      description: content.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      browserRequirements: 'Requires JavaScript',
      inLanguage: 'zh-Hant-TW',
    });
  } else {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#tools`,
      itemListElement: tools
        .filter((entry) => !category || entry.category === category)
        .map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.label,
          url: canonicalUrl(entry.id),
        })),
    });
  }
  if (page !== 'tools') {
    const categoryEntry = categories.find(({ id }) => id === category)!;
    const trail = [
      { name: '小事務', item: siteUrl },
      {
        name: categoryEntry.label,
        item: canonicalUrl(`category-${categoryEntry.id}`),
      },
      ...(tool ? [{ name: tool.label, item: url }] : []),
    ];
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: trail.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        ...entry,
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderSeoHead(page: PageId): string {
  const { title, description, canonical } = metadataForPage(page);
  return `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="小事務" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script id="page-structured-data" type="application/ld+json">${serializeJsonLd(structuredDataForPage(page))}</script>`;
}

/** Only catalog content goes here, never form inputs or query parameters. */
export function renderPageGuide(page: PageId, base: string): string {
  const content = contentForPage(page);
  const category = categoryForPage(page);
  const related = tools.filter(
    (tool) => tool.id !== page && (!category || tool.category === category),
  );
  return `<section class="page-guide" aria-label="用途與常見問題">
    <h2>${escapeHtml(content.heading)}：用途與使用方式</h2>
    <p>${escapeHtml(content.description)}</p>
    <h3>如何使用</h3>
    <ol>${content.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
    <h3>常見問題</h3>
    <dl>${content.faqs.map(({ question, answer }) => `<div><dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd></div>`).join('')}</dl>
    <nav aria-label="${page === 'tools' || page.startsWith('category-') ? '工具清單' : '相關工具'}">
      <h3>${page === 'tools' || page.startsWith('category-') ? '工具清單' : '相關工具'}</h3>
      <ul>${related.map((tool) => `<li><a href="${pagePath(tool.id, base)}">${escapeHtml(tool.label)}</a> — ${escapeHtml(tool.description)}</li>`).join('')}</ul>
    </nav>
  </section>`;
}

export function renderStaticPage(page: PageId, base: string): string {
  const { heading } = contentForPage(page);
  const category = categoryForPage(page);
  const categoryEntry = categories.find(({ id }) => id === category);
  return `<header class="site-header">
    <a class="brand" href="${pagePath('tools', base)}"><span class="brand-name">小事務</span><span class="brand-caption">everyday admin</span></a>
    <nav class="tool-nav" aria-label="行政工具">${categories.map(({ id, label }) => `<a href="${pagePath(`category-${id}`, base)}">${label}</a>`).join('')}</nav>
  </header>
  <main id="main-content" tabindex="-1">
    ${categoryEntry ? `<nav class="tool-breadcrumb" aria-label="麵包屑"><a href="${pagePath('tools', base)}">全部工具</a><span>/</span><a href="${pagePath(`category-${categoryEntry.id}`, base)}">${categoryEntry.label}</a></nav>` : ''}
    <div class="public-tool-page"><header class="public-tool-heading"><h1>${escapeHtml(heading)}</h1></header>
    <noscript><p>互動表單與計算需要啟用 JavaScript。你仍可閱讀以下說明與瀏覽工具。</p></noscript></div>
    ${renderPageGuide(page, base)}
  </main>`;
}

export function renderSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pageIds.map((page) => `  <url><loc>${canonicalUrl(page)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
