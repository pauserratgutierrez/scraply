import * as cheerio from 'cheerio';

const WHITESPACE_CHARS = /[\u200B\u00A0\u2028\u2029\u202F\u00AD\u2060\uFEFF]/g;

const collectText = ($, element) => {
  let text = '';

  element.contents().each((_, node) => {
    if (node.type === 'text') {
      text += `${$(node).text()} `;
    } else if (node.type === 'tag') {
      text += collectText($, $(node));
    }
  });

  return text;
};

/**
 * Extracts readable text from an HTML document. Cheerio decodes HTML entities
 * for us, so no separate decoder dependency is needed.
 *
 * `root` allow-lists the container(s) to read from (a selector or array of
 * selectors); when it matches nothing — or is null — extraction falls back to
 * `rootFallback` (default `<body>`). `removeSelectors` then strips noise from
 * within the chosen root.
 *
 * @param {string|import('cheerio').CheerioAPI} input - raw HTML or a loaded Cheerio instance
 * @param {{ removeSelectors?: string[], root?: string|string[]|null, rootFallback?: string }} [options]
 * @returns {string}
 */
export const extractText = (input, options = {}) => {
  const { removeSelectors = [], root = null, rootFallback = 'body' } = options;
  const $ = typeof input === 'string' ? cheerio.load(input) : input;

  if (removeSelectors.length) $(removeSelectors.join(',')).remove();
  $('*').contents().filter((_, node) => node.type === 'comment').remove();

  const rootSelector = Array.isArray(root) ? root.join(',') : root;
  let $root = rootSelector ? $(rootSelector) : $(rootFallback || 'body');
  if ($root.length === 0) $root = $(rootFallback || 'body');

  let text = '';
  $root.each((_, element) => {
    text += `${collectText($, $(element))} `;
  });

  return text
    .replace(/\n/g, ' ')
    .replace(/\\['"\\]/g, (match) => match.slice(1))
    .replace(WHITESPACE_CHARS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
