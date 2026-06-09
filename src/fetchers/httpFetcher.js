const lowercaseHeaders = (headers) => Object.fromEntries(headers.entries());

const httpError = (message, status, headers = {}) =>
  Object.assign(new Error(message), { response: { status, headers } });

/**
 * Native-fetch based backend. Follows redirects manually so the redirect budget
 * is enforced, and times out via AbortController.
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
        headers: { 'User-Agent': request.userAgent }
      });

      const headers = lowercaseHeaders(response.headers);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw httpError('Redirect without location header', response.status, headers);
        if (redirectsLeft <= 0) throw httpError('Max redirects reached', response.status, headers);
        return fetchOnce(new URL(location, url).href, redirectsLeft - 1);
      }

      if (!response.ok) throw httpError(`Invalid status code: ${response.status}`, response.status, headers);

      const data = await response.text();
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
