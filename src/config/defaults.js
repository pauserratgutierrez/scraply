import { DEFAULT_BROWSER_BLOCK_RESOURCES } from './browser.js';

/**
 * Default Scraply configuration. Every value here can be overridden by the object passed to `createCrawler()` / `scraply()`. Durations are in milliseconds.
 *
 * @type {import('../index.js').ScraplyConfig}
 */
export const DEFAULT_CONFIG = {
  // URLs the crawl is seeded with.
  startUrls: ['https://crawler-test.com/'],

  // Which discovered links are allowed into the queue. Each entry is either an absolute URL prefix (e.g. 'https://site.com/blog') or a RegExp. Empty means "default to startUrls".
  include: [],

  // Links matching any of these (string prefix or RegExp) are never queued.
  exclude: [
    /\.(zip|rar|webp|png|jpg|jpeg|gif|mp3|mp4|pdf|css|js|svg|ico|eot|ttf|woff|woff2|otf|webm|ogg|wav|flac|m4a|mkv|mov|avi|wmv|flv|swf|exe|msi|dmg|iso|bin)$/i
  ],

  // Only responses whose Content-Type includes one of these are parsed.
  allowedContentTypes: ['text/html'],

  // Per-origin/route overrides. Each entry: { match, allowedContentTypes?, extract? }.
  // `match` is a URL prefix / RegExp (or an array of them); the most specific
  // match wins and its fields override the top-level config for matching URLs.
  sites: [],

  // 'http' (native fetch), 'browser' (Puppeteer) or a custom Fetcher instance.
  fetcher: 'http',

  // Options for the built-in Puppeteer fetcher (`fetcher: 'browser'`).
  browser: {
    // When page.goto considers navigation finished. Use 'networkidle2' for SPAs that inject links/content after load (e.g. Vue/React apps).
    waitUntil: 'load',

    // Resource types to abort during fetch (speeds up crawls). Stylesheets are omitted by default because many SPAs need CSS before content renders.
    blockResources: [...DEFAULT_BROWSER_BLOCK_RESOURCES]
  },

  // 'silent' | 'error' | 'warn' | 'info' | 'debug'
  logLevel: 'info',

  // Install SIGINT/SIGTERM handlers for a graceful stop (first signal finishes
  // in-flight work and flushes; a second forces quit). Set false when embedding
  // Scraply so it never touches process signals.
  signals: true,

  storage: {
    dir: 'dataset'
  },

  request: {
    timeout: 10000, // per-request budget (aborts the fetch, including body read)
    maxRedirects: 5, // redirect hops the HTTP fetcher follows before giving up
    maxContentLength: 20 * 1024 * 1024, // hard cap on the response body (bytes); 0 disables it
    userAgent: 'Mozilla/5.0 (compatible; Scraply/2.0; +https://www.npmjs.com/package/scraply)',
    headers: {} // extra request headers (auth, Accept-Language, cookies, ...) sent by every fetcher
  },

  retry: {
    max: 1,
    statusCodes: [408, 500, 502, 503, 504],
    delay: 1000
  },

  rateLimit: {
    fallbackDelay: 60000,
    // false: wait (honoring retry-after / x-ratelimit-reset) and retry until the
    // host relents. true: abort the crawl with a RateLimitError carrying
    // `exitCode` so a scheduler can resume it later (the queue is persistent).
    exitOnLimit: false,
    exitCode: 10
  },

  crawl: {
    concurrency: 5,
    delay: 200, // minimum spacing between requests to the same host
    maxDepth: Infinity,
    maxPages: Infinity, // hard cap on successfully crawled pages (counts across resumes)
    resetOnComplete: true,
    retryErrors: false, // re-queue previously errored URLs on resume so they are retried
    retrySkipped: false, // re-queue previously skipped URLs on resume (e.g. after widening allowedContentTypes)
    sitemap: false // true -> seed <origin>/sitemap.xml per start URL; or pass an array of sitemap URLs
  },

  extract: {
    // Allow-list the container(s) to extract text from: a selector, an array of
    // selectors, or null for the whole <body>. Falls back to `rootFallback`
    // when the selector matches nothing.
    root: null,
    rootFallback: 'body',

    // true -> JSON responses are parsed and stored as pretty-printed `content`
    // (with the parsed value on `record.data`). false -> store the raw body text.
    json: true,

    removeSelectors: [
      'script',
      'noscript',
      'style',
      'meta',
      'link',
      'svg',
      'path',
      'img',
      'input',
      'textarea',
      'embed',
      'object',
      'iframe',
      'nav',
      'header',
      'footer',
      'aside',
      'button',
      '[aria-modal]',
      '[role="dialog"]',
      '[role="alert"]',
      '[role="banner"]',
      '[role="form"]',
      '[role="navigation"]',
      '[role="search"]'
    ]
  },

  output: {
    format: 'json', // 'json' | 'jsonl' | 'lines'
    exclude: [],
    routes: {
      'https://crawler-test.com': { '*': 'general.json' }
    }
  }
};
