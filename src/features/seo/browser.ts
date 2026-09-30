import type { PageId } from '../tools/catalog';
import { metadataForPage, structuredDataForPage, serializeJsonLd } from './pages';

export function updatePageMetadata(page: PageId) {
  const { title, description, canonical } = metadataForPage(page);
  document.title = title;
  const tags = [
    ['name', 'description', description],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  for (const [attribute, key, value] of tags) {
    let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, key);
      document.head.append(meta);
    }
    meta.content = value;
  }
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.append(link);
  }
  link.href = canonical;
  let data = document.getElementById('page-structured-data');
  if (!data) {
    data = document.createElement('script');
    data.id = 'page-structured-data';
    data.setAttribute('type', 'application/ld+json');
    document.head.append(data);
  }
  data.textContent = serializeJsonLd(structuredDataForPage(page));
}
