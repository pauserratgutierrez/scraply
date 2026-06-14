/** Coerces a fetcher body (string or binary) to a UTF-8 string. */
export const toText = (data) => (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));

/**
 * Buckets a Content-Type into the kind of body Scraply knows how to handle.
 * Anything containing "json" is JSON, anything containing "html" (incl.
 * application/xhtml+xml) is HTML, everything else is treated as raw text.
 *
 * @param {string} [contentType]
 * @returns {'html'|'json'|'text'}
 */
export const classifyContentType = (contentType = '') => {
  const value = String(contentType).toLowerCase();
  if (value.includes('json')) return 'json';
  if (value.includes('html')) return 'html';
  return 'text';
};

/**
 * Parses a JSON body. Returns the parsed value plus a pretty-printed string for
 * the record `content`. Falls back to the raw text when the body is not valid
 * JSON (so a mislabeled response is never lost).
 *
 * @param {string|ArrayBuffer} data
 * @returns {{ data: unknown, content: string }}
 */
export const parseJson = (data) => {
  const text = toText(data);
  try {
    const parsed = JSON.parse(text);
    return { data: parsed, content: JSON.stringify(parsed, null, 2) };
  } catch {
    return { data: null, content: text };
  }
};
