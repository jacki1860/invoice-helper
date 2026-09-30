import type { Plugin } from 'vite';
import { pagePath } from '../src/features/tools/catalog.ts';
import {
  pageIds,
  renderSeoHead,
  renderStaticPage,
  renderSitemap,
} from '../src/features/seo/pages.ts';

export function seoPages(): Plugin {
  let base = '/';
  return {
    name: 'static-seo-pages',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const entry = bundle['index.html'];
      // Cloudflare also builds a Worker environment, which has no HTML entry.
      if (!entry || entry.type !== 'asset') return;
      const template = String(entry.source);
      if (!template.includes('<div id="root"></div>')) {
        this.error('Missing static page root marker in index.html');
      }
      for (const page of pageIds) {
        const html = template
          .replace(/<title>[\s\S]*?<\/title>/, renderSeoHead(page))
          .replace(
            '<div id="root"></div>',
            () => `<div id="root">${renderStaticPage(page, base)}</div>`,
          );
        if (page === 'tools') entry.source = html;
        else
          this.emitFile({
            type: 'asset',
            fileName: `${pagePath(page, '/').slice(1)}index.html`,
            source: html,
          });
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap() });
    },
  };
}
