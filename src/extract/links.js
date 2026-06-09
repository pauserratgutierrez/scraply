import { URL } from 'node:url';
import { normalizeUrl } from '../url/normalize.js';

const NON_NAVIGATIONAL = /^(mailto:|tel:|javascript:|data:)/i;

/**
 * Collects unique, normalized links from anchor tags in a document. No
 * include/exclude filtering happens here; that is the crawler's job.
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
      links.add(normalizeUrl(new URL(href, baseUrl).toString()));
    } catch {
      // Ignore malformed hrefs.
    }
  });

  return [...links];
};
