/**
 * Scraply public API.
 *
 * @typedef {Object} RequestConfig
 * @property {number} timeout
 * @property {number} maxRedirects
 * @property {number} maxContentLength - hard cap on the response body in bytes; 0 disables it
 * @property {string} userAgent
 * @property {Record<string, string>} headers - extra request headers sent by every fetcher
 *
 * @typedef {Object} RetryConfig
 * @property {number} max
 * @property {number[]} statusCodes
 * @property {number} delay
 *
 * @typedef {Object} RateLimitConfig
 * @property {number} fallbackDelay
 * @property {boolean} exitOnLimit
 * @property {number} exitCode
 *
 * @typedef {Object} CrawlConfig
 * @property {number} concurrency
 * @property {number} delay - minimum spacing (ms) between requests to the same host
 * @property {number} maxDepth
 * @property {number} maxPages - hard cap on successfully crawled pages (counts across resumes)
 * @property {boolean} resetOnComplete
 * @property {boolean} retryErrors - re-queue previously errored URLs on resume
 *
 * @typedef {Object} BrowserConfig
 * @property {'load'|'domcontentloaded'|'networkidle0'|'networkidle2'} waitUntil
 * @property {Array<'image'|'stylesheet'|'font'|'media'>} blockResources
 *
 * @typedef {Object} OutputConfig
 * @property {'json'|'jsonl'|'lines'} format
 * @property {Array<string|RegExp>} exclude
 * @property {Record<string, Record<string, string>>} routes
 *
 * @typedef {Object} ScraplyConfig
 * @property {string[]} [startUrls]
 * @property {Array<string|RegExp>} [include]
 * @property {Array<string|RegExp>} [exclude]
 * @property {string[]} [allowedContentTypes]
 * @property {'http'|'browser'|import('./fetchers/types.js').Fetcher} [fetcher]
 * @property {Partial<BrowserConfig>} [browser]
 * @property {'silent'|'error'|'warn'|'info'|'debug'} [logLevel]
 * @property {{ dir?: string }} [storage]
 * @property {Partial<RequestConfig>} [request]
 * @property {Partial<RetryConfig>} [retry]
 * @property {Partial<RateLimitConfig>} [rateLimit]
 * @property {Partial<CrawlConfig>} [crawl]
 * @property {{ removeSelectors?: string[] }} [extract]
 * @property {Partial<OutputConfig>} [output]
 *
 * @typedef {Required<ScraplyConfig> & {
 *   browser: BrowserConfig,
 *   storage: { dir: string, queuePath: string, crawledDir: string, formattedDir: string }
 * }} ResolvedConfig
 */

// Main entry points
export { createCrawler, scraply } from './crawler.js';

// Config
export { loadConfig } from './config/load.js';
export { DEFAULT_CONFIG } from './config/defaults.js';
export { assertBrowserConfig, BROWSER_WAIT_UNTIL, BROWSER_BLOCKABLE_RESOURCES } from './config/browser.js';

// Standalone building blocks (usable without a crawler instance)
export { normalizeUrl } from './url/normalize.js';
export { matchesPattern, matchesAnyPattern } from './url/patterns.js';
export { extractText } from './extract/extract.js';
export { discoverLinks } from './extract/links.js';
export { routeRecord } from './output/router.js';
export { writeRecords, formatRecords } from './output/writers.js';

// Fetchers (default + swappable)
export { resolveFetcher, createHttpFetcher, createBrowserFetcher } from './fetchers/index.js';
