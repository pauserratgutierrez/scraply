import { URL } from 'node:url';

const NON_NAVIGATIONAL = /^(mailto:|tel:|javascript:|data:)/i;

/**
 * Collects unique, absolute links from anchor tags in a document, resolving
 * relative hrefs against `baseUrl`. Normalization and include/exclude filtering
 * are the crawler's job (`enqueue`), so links are only resolved here.
 *
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} baseUrl - used to resolve relative hrefs
 * @returns {string[]}
 */
export const discoverLinks = ($, baseUrl) => {
  const links = new Set();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('#') || NON_NAVIGATIONAL.test(href)) return;

    try {
      links.add(new URL(href, baseUrl).href);
    } catch {
      // Ignore malformed hrefs.
    }
  });

  return [...links];
};
