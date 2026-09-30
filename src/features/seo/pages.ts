import {
  categories,
  tools,
  taskCollections,
  categoryForPage,
  taskForPage,
  isOverviewPage,
  toolsForPage,
  pagePath,
  type PageId,
} from '../tools/catalog.ts';
import { homeContent, toolContent, type PageContent } from './content.ts';

export const siteUrl = 'https://www.ctrls.com.tw/invoice/';
export const pageIds: PageId[] = [
  'tools',
  'directory',
  ...taskCollections.map(({ id }) => `task-${id}` as const),
  ...categories.map(({ id }) => `category-${id}` as const),
  ...tools.map(({ id }) => id),
];

export function contentForPage(page: PageId): PageContent {
  if (page === 'tools') return homeContent;
  if (page === 'directory')
    return {
      heading: `全部行政工具：${tools.length} 個線上工具總覽`,
      description: `查看小事務全部 ${tools.length} 個免登入行政工具，包含發票、報價與請款、收據、採購、費用報支、金額試算、日期轉換及公開資料查詢。可搜尋工具名稱或用途，選擇需要的工具，或主動收藏方便下次開啟。`,
      steps: [
        '從完整工具清單找到需要的工作，或輸入名稱與用途搜尋全站工具。',
        '開啟工具後核對功能、資料保存方式及適用範圍，再填寫或查詢。',
        '常用工具可主動加入收藏；需要保留的文件與紀錄另依各工具方式匯出或備份。',
      ],
      faqs: homeContent.faqs.slice(0, 2),
    };
  const task = taskForPage(page);
  if (task)
    return {
      heading: `${task.label}：線上行政工具`,
      description: `${task.description}小事務將${toolsForPage(page)
        .map(({ label }) => label)
        .join(
          '、',
        )}整理在同一入口，方便選擇這次工作需要的工具。各工具免登入，資料與結果仍需依實際情況核對。`,
      steps: [
        '從下方工具清單選擇這次工作的起點，不必依序使用所有工具。',
        '依工具說明輸入資料或查閱來源，確認適用版本與結果。',
        '若工具提供帶入功能，仍須確認套用；需要留存的內容請使用該工具的匯出或備份功能。',
      ],
      faqs: [
        {
          question: '這個入口會自動幫我完成整件事嗎？',
          answer:
            '不會。這裡將相關工具放在一起，讓你依工作需要選用。工具之間若提供資料帶入，仍由你操作並確認套用；沒有自動串接所有步驟或代替你完成審核。',
        },
        {
          question: '需要的工具不在這個入口裡，還能找到嗎？',
          answer:
            '可以。搜尋工具名稱或用途會查找全站工具，也可從頁首開啟「全部工具」查看完整清單。常用工具可主動收藏，收藏只保存工具選擇，不保存文件內容。',
        },
      ],
    };
  if (!isOverviewPage(page)) return toolContent[page as keyof typeof toolContent];
  const category = categories.find(({ id }) => `category-${id}` === page)!;
  const entries = toolsForPage(page);
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

interface PageLink {
  id: PageId;
  label: string;
  description: string;
}

function collectionLinks(page: PageId): PageLink[] {
  if (page === 'tools')
    return [
      ...taskCollections.map((task) => ({
        id: `task-${task.id}` as const,
        label: task.label,
        description: task.description,
      })),
      {
        id: 'directory',
        label: '全部工具',
        description: `查看 ${tools.length} 個行政工具的完整清單，依需要選用。`,
      },
    ];
  return toolsForPage(page);
}

function breadcrumbLinks(page: PageId): { id: PageId; label: string }[] {
  const home: { id: PageId; label: string } = { id: 'tools', label: '小事務' };
  if (page === 'tools') return [home];
  if (page === 'directory') return [home, { id: page, label: '全部工具' }];
  const task = taskForPage(page);
  if (task) return [home, { id: page, label: task.label }];
  const category = categories.find(({ id }) => id === categoryForPage(page))!;
  const categoryLink: { id: PageId; label: string } = {
    id: `category-${category.id}`,
    label: category.label,
  };
  if (page.startsWith('category-')) return [home, categoryLink];
  return [home, categoryLink, { id: page, label: tools.find(({ id }) => id === page)!.label }];
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
      itemListElement: collectionLinks(page).map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.label,
        url: canonicalUrl(entry.id),
      })),
    });
  }
  if (page !== 'tools') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: breadcrumbLinks(page).map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.label,
        item: canonicalUrl(entry.id),
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
  const overview = isOverviewPage(page);
  const links = overview
    ? collectionLinks(page)
    : toolsForPage(page).filter((tool) => tool.id !== page);
  const listHeading = page === 'tools' ? '依事情找工具' : overview ? '工具清單' : '相關工具';
  return `<section class="page-guide" aria-label="用途與常見問題">
    ${overview ? '<details class="overview-help"><summary>使用說明與常見問題</summary>' : ''}
    <h2>${escapeHtml(content.heading)}：用途與使用方式</h2>
    <p>${escapeHtml(content.description)}</p>
    <h3>如何使用</h3>
    <ol>${content.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
    <h3>常見問題</h3>
    <dl>${content.faqs.map(({ question, answer }) => `<div><dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd></div>`).join('')}</dl>
    <nav aria-label="${listHeading}">
      <h3>${listHeading}</h3>
      <ul>${links.map((entry) => `<li><a href="${pagePath(entry.id, base)}">${escapeHtml(entry.label)}</a> — ${escapeHtml(entry.description)}</li>`).join('')}</ul>
    </nav>
    ${overview ? '</details>' : ''}
  </section>`;
}

export function renderStaticPage(page: PageId, base: string): string {
  const { heading } = contentForPage(page);
  const trail = breadcrumbLinks(page);
  return `<header class="site-header">
    <a class="brand" href="${pagePath('tools', base)}"><span class="brand-name">小事務</span><span class="brand-caption">everyday admin</span></a>
    <nav class="tool-nav" aria-label="行政工具"><a href="${pagePath('tools', base)}">依事情找工具</a><a href="${pagePath('directory', base)}">全部工具</a></nav>
  </header>
  <main id="main-content" tabindex="-1">
    ${trail.length > 1 ? `<nav class="tool-breadcrumb" aria-label="麵包屑">${trail.map((entry, index) => (index === trail.length - 1 ? `<span aria-current="page">${escapeHtml(entry.label)}</span>` : `<a href="${pagePath(entry.id, base)}">${escapeHtml(entry.label)}</a>`)).join('<span>/</span>')}</nav>` : ''}
    <div class="public-tool-page"><header class="public-tool-heading"><h1>${escapeHtml(heading)}</h1></header>
    <noscript><p>搜尋、收藏、互動表單與計算需要啟用 JavaScript。${isOverviewPage(page) ? '請展開下方「使用說明與常見問題」，閱讀介紹與開啟工具連結。' : '你仍可閱讀以下說明與瀏覽工具。'}</p></noscript></div>
    ${renderPageGuide(page, base)}
  </main>`;
}

export function renderSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pageIds.map((page) => `  <url><loc>${canonicalUrl(page)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
