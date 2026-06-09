/**
 * Canonicalizes a URL so the same page is never queued twice:
 * drops the hash and query, forces HTTPS, strips a leading "www.",
 * and removes a trailing slash (except for the root path).
 * @param {string} url
 * @returns {string}
 */
export const normalizeUrl = (url) => {
  const parsed = new URL(url);

  parsed.hash = '';
  parsed.search = '';
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.replace(/^www\./, '');

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
};
