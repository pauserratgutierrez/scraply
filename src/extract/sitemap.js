import * as cheerio from 'cheerio';

/**
 * Parses an XML sitemap or sitemap index. Returns nested `sitemaps` (from a
 * `<sitemapindex>`) and page `urls` (from a `<urlset>`) separately so the
 * crawler can recurse into indexes before enqueuing pages.
 *
 * @param {string} xml
 * @returns {{ sitemaps: string[], urls: string[] }}
 */
export const parseSitemap = (xml) => {
  const $ = cheerio.load(xml, { xmlMode: true });
  const sitemaps = [];
  const urls = [];

  $('sitemap > loc').each((_, el) => {
    const value = $(el).text().trim();
    if (value) sitemaps.push(value);
  });

  $('url > loc').each((_, el) => {
    const value = $(el).text().trim();
    if (value) urls.push(value);
  });

  // Fallback for sitemaps that omit the standard wrapping elements.
  if (sitemaps.length === 0 && urls.length === 0) {
    $('loc').each((_, el) => {
      const value = $(el).text().trim();
      if (value) urls.push(value);
    });
  }

  return { sitemaps, urls };
};
