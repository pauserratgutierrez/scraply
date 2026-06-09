import { createHttpFetcher } from './httpFetcher.js';
import { createBrowserFetcher } from './browserFetcher.js';

const BUILTIN = {
  http: createHttpFetcher,
  browser: createBrowserFetcher
};

/**
 * Resolves the configured fetcher. `config.fetcher` can be a built-in name
 * ('http' | 'browser') or a custom Fetcher instance ({ name, fetch, init?, close? }).
 *
 * @param {import('./types.js').FetcherDeps} deps
 * @returns {import('./types.js').Fetcher}
 */
export const resolveFetcher = (deps) => {
  const { fetcher } = deps.config;

  if (fetcher && typeof fetcher === 'object' && typeof fetcher.fetch === 'function') {
    return fetcher;
  }

  const factory = BUILTIN[fetcher ?? 'http'];
  if (!factory) throw new Error(`Unknown fetcher: ${String(fetcher)}`);

  return factory(deps);
};

export { createHttpFetcher, createBrowserFetcher };
