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
 * @property {boolean} retrySkipped - re-queue previously skipped URLs on resume
 * @property {boolean|string[]} sitemap - seed from sitemap(s): true uses <origin>/sitemap.xml, or pass explicit URLs
 *
 * @typedef {Object} BrowserConfig
 * @property {'load'|'domcontentloaded'|'networkidle0'|'networkidle2'} waitUntil
 * @property {Array<'image'|'stylesheet'|'font'|'media'>} blockResources
 *
 * @typedef {Object} ExtractConfig
 * @property {string|string[]|null} [root] - allow-list container(s) to read text from; null = whole <body>
 * @property {string} [rootFallback] - selector used when `root` matches nothing (default 'body')
 * @property {boolean} [json] - parse JSON bodies into pretty content + record.data (default true)
 * @property {string[]} [removeSelectors] - elements stripped before text extraction
 *
 * @typedef {Object} SiteConfig
 * @property {string|RegExp|Array<string|RegExp>} match - URL prefix(es)/RegExp(s) this override applies to
 * @property {string[]} [allowedContentTypes]
 * @property {ExtractConfig} [extract]
 *
 * @typedef {Object} OutputConfig
 * @property {'json'|'jsonl'|'lines'} format
 * @property {Array<string|RegExp>} exclude
 * @property {Record<string, Record<string, string>>} routes
 *
 * List fields (`include`, `exclude`, `allowedContentTypes`, `extract.removeSelectors`,
 * `output.exclude`) accept either an array (replaces the default) or a directive
 * object `{ extend?, prepend?, replace? }` to combine with Scraply's defaults.
 * @template T
 * @typedef {T[] | { extend?: T[], prepend?: T[], append?: T[], replace?: T[] }} ListInput
 *
 * @typedef {Object} ScraplyConfig
 * @property {string[]} [startUrls]
 * @property {ListInput<string|RegExp>} [include]
 * @property {ListInput<string|RegExp>} [exclude]
 * @property {ListInput<string>} [allowedContentTypes]
 * @property {SiteConfig[]} [sites] - per-origin/route overrides for allowedContentTypes + extract
 * @property {'http'|'browser'|import('./fetchers/types.js').Fetcher} [fetcher]
 * @property {Partial<BrowserConfig>} [browser]
 * @property {'silent'|'error'|'warn'|'info'|'debug'} [logLevel]
 * @property {boolean} [signals] - install SIGINT/SIGTERM handlers (default true)
 * @property {{ dir?: string }} [storage]
 * @property {Partial<RequestConfig>} [request]
 * @property {Partial<RetryConfig>} [retry]
 * @property {Partial<RateLimitConfig>} [rateLimit]
 * @property {Partial<CrawlConfig>} [crawl]
 * @property {ExtractConfig & { removeSelectors?: ListInput<string> }} [extract]
 * @property {Partial<OutputConfig> & { exclude?: ListInput<string|RegExp> }} [output]
 *
 * @typedef {Required<ScraplyConfig> & {
 *   include: Array<string|RegExp>,
 *   exclude: Array<string|RegExp>,
 *   allowedContentTypes: string[],
 *   sites: Array<{ match: Array<string|RegExp>, allowedContentTypes?: string[], extract?: ExtractConfig }>,
 *   browser: BrowserConfig,
 *   extract: ExtractConfig & { removeSelectors: string[] },
 *   storage: { dir: string, queuePath: string, crawledDir: string, formattedDir: string }
 * }} ResolvedConfig
 */

// Main entry points
export { createCrawler, scraply, runCrawlers } from './crawler.js';

// Config
export { loadConfig } from './config/load.js';
export { DEFAULT_CONFIG } from './config/defaults.js';
export { assertBrowserConfig, BROWSER_WAIT_UNTIL, BROWSER_BLOCKABLE_RESOURCES } from './config/browser.js';

// Errors
export { RateLimitError } from './core/errors.js';

// Standalone building blocks (usable without a crawler instance)
export { normalizeUrl } from './url/normalize.js';
export { matchesPattern, matchesAnyPattern } from './url/patterns.js';
export { extractText } from './extract/extract.js';
export { discoverLinks } from './extract/links.js';
export { classifyContentType, parseJson } from './extract/parse.js';
export { parseSitemap } from './extract/sitemap.js';
export { routeRecord } from './output/router.js';
export { writeRecords, formatRecords } from './output/writers.js';

// Fetchers (default + swappable)
export { resolveFetcher, createHttpFetcher, createBrowserFetcher } from './fetchers/index.js';
