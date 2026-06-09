/**
 * The result every fetcher returns on success. `data` is the response body
 * (HTML string for pages); `headers` keys are lowercased.
 *
 * @typedef {Object} FetchResult
 * @property {string|ArrayBuffer} data
 * @property {number} status
 * @property {Record<string, string>} headers
 */

/**
 * Pluggable fetch backend. A fetcher does a single fetch (following redirects
 * internally) and throws on a non-2xx response, attaching `error.response`
 * ({ status, headers }) so the retry/rate-limit policy can inspect it. Retries
 * are handled by the crawler, not the fetcher.
 *
 * @typedef {Object} Fetcher
 * @property {string} name
 * @property {(url: string) => Promise<FetchResult>} fetch
 * @property {() => Promise<void>} [init]   - called once before crawling
 * @property {() => Promise<void>} [close]  - called once after crawling
 */

/**
 * Dependencies handed to a fetcher factory.
 * @typedef {Object} FetcherDeps
 * @property {import('../index.js').ResolvedConfig} config
 * @property {ReturnType<import('../util/logger.js').createLogger>} logger
 */

export {};
