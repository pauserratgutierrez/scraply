/**
 * Default Scraply configuration. Every value here can be overridden by the
 * object passed to `createCrawler()` / `scraply()`. Durations are in milliseconds.
 *
 * @type {import('../index.js').ScraplyConfig}
 */
export const DEFAULT_CONFIG = {
  // URLs the crawl is seeded with.
  startUrls: ['https://crawler-test.com/'],

  // Which discovered links are allowed into the queue. Each entry is either an
  // absolute URL prefix (e.g. 'https://site.com/blog') or a RegExp. Empty means
  // "default to startUrls".
  include: [],

  // Links matching any of these (string prefix or RegExp) are never queued.
  exclude: [
    /\.(zip|rar|webp|png|jpg|jpeg|gif|mp3|mp4|pdf|css|js|svg|ico|eot|ttf|woff|woff2|otf|webm|ogg|wav|flac|m4a|mkv|mov|avi|wmv|flv|swf|exe|msi|dmg|iso|bin)$/i
  ],

  // Only responses whose Content-Type includes one of these are parsed.
  allowedContentTypes: ['text/html'],

  // 'http' (native fetch), 'browser' (Puppeteer) or a custom Fetcher instance.
  fetcher: 'http',

  // 'silent' | 'error' | 'warn' | 'info' | 'debug'
  logLevel: 'info',

  storage: {
    dir: 'dataset'
  },

  request: {
    timeout: 10000,
    maxRedirects: 5,
    maxContentLength: 20 * 1024 * 1024,
    userAgent: 'Mozilla/5.0 (compatible; Scraply/2.0; +https://www.npmjs.com/package/scraply)'
  },

  retry: {
    max: 1,
    statusCodes: [408, 500, 502, 503, 504],
    delay: 1000
  },

  rateLimit: {
    fallbackDelay: 60000,
    exitOnLimit: true,
    exitCode: 10
  },

  crawl: {
    concurrency: 5,
    delay: 200, // minimum spacing between requests to the same host
    maxDepth: Infinity,
    resetOnComplete: true
  },

  extract: {
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
