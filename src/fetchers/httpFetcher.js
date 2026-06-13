const lowercaseHeaders = (headers) => Object.fromEntries(headers.entries());

const httpError = (message, status, headers = {}) =>
  Object.assign(new Error(message), { response: { status, headers } });

/**
 * Reads a response body as text while enforcing a byte cap (`maxBytes <= 0`
 * disables it). Rejects early on a declared `Content-Length`, and otherwise
 * streams the body so an oversized chunked response is aborted instead of being
 * buffered whole.
 */
const readBodyWithLimit = async (response, maxBytes, headers) => {
  if (maxBytes > 0) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw httpError(`Response too large: ${declared} bytes (max ${maxBytes})`, 413, headers);
    }
  }

  if (maxBytes <= 0 || !response.body) return response.text();

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw httpError(`Response exceeded max size of ${maxBytes} bytes`, 413, headers);
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Native-fetch based backend. Follows redirects manually so the redirect budget
 * is enforced, times out via AbortController, and caps the body at
 * `request.maxContentLength`.
 *
 * @param {import('./types.js').FetcherDeps} deps
 * @returns {import('./types.js').Fetcher}
 */
export const createHttpFetcher = ({ config }) => {
  const { request } = config;

  const fetchOnce = async (url, redirectsLeft) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': request.userAgent, ...request.headers }
      });

      const headers = lowercaseHeaders(response.headers);

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) throw httpError('Redirect without location header', response.status, headers);
        if (redirectsLeft <= 0) throw httpError('Max redirects reached', response.status, headers);
        return fetchOnce(new URL(location, url).href, redirectsLeft - 1);
      }

      if (!response.ok) throw httpError(`Invalid status code: ${response.status}`, response.status, headers);

      const data = await readBodyWithLimit(response, request.maxContentLength, headers);
      return { data, status: response.status, headers };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw httpError(`Request timed out after ${request.timeout}ms`, 408);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    name: 'http',
    fetch: (url) => fetchOnce(url, request.maxRedirects)
  };
};
