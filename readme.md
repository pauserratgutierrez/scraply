# Scraply

Scraply is a customizable, modular web crawler and content scraper for Node.js. Define the URLs to crawl, control which links are followed, choose how pages are fetched (plain HTTP or a real browser), and route the extracted text into JSON files. Crawls are persistent and resumable, so they are well suited to long-running or scheduled jobs.

Bug reports and development: [Scraply on GitHub](https://github.com/pauserratgutierrez/scraply)
NPM package: [Scraply on NPM](https://www.npmjs.com/package/scraply)

> Scraply 2.0 is a ground-up rewrite with a new configuration shape and public API. See [Migrating from 1.x](#migrating-from-1x).

## Requirements
- Node.js >= 18 (uses the built-in `fetch`).

## Installation
```
npm install scraply
```

## Quick start
```js
import { scraply } from 'scraply';

await scraply({
  startUrls: ['https://example.com'],
  output: {
    routes: {
      'https://example.com': { '*': 'example.json' }
    }
  }
});
```

This crawls `example.com`, extracts the readable text of every allowed page, and writes the results to `dataset/formatted/example.json`.

## How Scraply works
1. The crawl is seeded from `startUrls`.
2. Each page is fetched, its links are discovered and filtered (`include` / `exclude`), and new links are queued.
3. The page text is extracted (configurable element removal) and saved under `dataset/crawled/`.
4. When the queue drains, all crawled pages are routed by URL into the files defined in `output.routes` and written to `dataset/formatted/`.

### Persistence and resuming
The queue and crawled pages are checkpointed to disk in `dataset/`. If a run is interrupted (or rate-limited), progress is saved and the next run resumes exactly where it left off without re-crawling finished URLs. When every URL has been processed, Scraply starts a fresh crawl (set `crawl.resetOnComplete: false` to keep the finished queue instead).

### Concurrency and politeness
Pages are crawled with a worker pool (`crawl.concurrency`). Requests to the same host are spaced by `crawl.delay` for politeness, while different hosts run in parallel.

### Rate limiting
On HTTP `429`, Scraply either exits immediately with `rateLimit.exitCode` (default) so a scheduler can retry later, or waits (honoring `retry-after` / `x-ratelimit-reset`) and continues when `rateLimit.exitOnLimit` is `false`.

## Fetchers
`fetcher` selects the backend:
- `'http'` (default): fast static fetching with the native `fetch`.
- `'browser'`: full JavaScript rendering via Puppeteer (`puppeteer-cluster`).
- a custom object implementing the `Fetcher` interface (`{ name, fetch, init?, close? }`), so backends like Playwright or a remote CDP browser can be plugged in without changing the crawler.

## Programmatic API
`createCrawler(config)` returns an instance exposing each stage, plus lifecycle hooks:

```js
import { createCrawler } from 'scraply';

const crawler = createCrawler({ startUrls: ['https://example.com'] });

// React to every crawled page as it happens.
crawler.on('page', (record) => console.log('crawled', record.url));

// Veto links before they are queued.
crawler.on('shouldEnqueue', (url) => !url.includes('/admin'));

// Transform the stored record.
crawler.on('transform', (record) => ({ ...record, length: record.content.length }));

await crawler.run();
```

Instance methods: `run()`, `crawl()`, `fetch(url)`, `extract(html, url)`, `enqueue(urls, opts)`, `format(records?)`, `stop()`, `on(event, fn)`.

Hooks: `response`, `extract`, `shouldEnqueue`, `transform`, `page`, `error`.

Standalone exports for advanced use: `normalizeUrl`, `matchesPattern`, `matchesAnyPattern`, `extractText`, `discoverLinks`, `routeRecord`, `writeRecords`, `formatRecords`, `loadConfig`, `DEFAULT_CONFIG`, `resolveFetcher`, `createHttpFetcher`, `createBrowserFetcher`.

## Configuration
All options are optional except `startUrls`. Durations are milliseconds.

```js
{
  startUrls: ['https://crawler-test.com/'],
  include: [],                 // URL prefixes or RegExp; defaults to startUrls
  exclude: [/\.(zip|png|js|css|...)$/i],
  allowedContentTypes: ['text/html'],
  fetcher: 'http',             // 'http' | 'browser' | Fetcher instance
  logLevel: 'info',            // 'silent' | 'error' | 'warn' | 'info' | 'debug'

  storage: { dir: 'dataset' },

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
    delay: 200,                // per-host spacing
    maxDepth: Infinity,
    resetOnComplete: true
  },

  extract: {
    removeSelectors: ['script', 'style', 'nav', 'header', 'footer', '...']
  },

  output: {
    format: 'json',            // 'json' | 'jsonl' | 'lines'
    exclude: [],
    routes: {
      'https://crawler-test.com': { '*': 'general.json' }
    }
  }
}
```

### Output routing
`output.routes` maps a URL prefix to `{ pathKey: filename, '*': fallback }`. The most specific matching prefix wins, then the most specific path key, then `'*'`. For example:

```js
output: {
  routes: {
    'https://docs.example.com': {
      'guide': 'guides.json',
      '*': 'docs.json'
    },
    'https://example.com': { '*': 'main.json' }
  }
}
```

## GitHub Actions
Because crawls are persistent and exit cleanly on rate limits, Scraply works well on a schedule. Commit the `dataset/` directory between runs, and each scheduled run continues the crawl.

## Migrating from 1.x
The configuration is now camelCase and grouped, and the entry point is `src/index.js`.

- `MAIN_DIR` -> `storage.dir`
- `CRAWLER.INITIAL_URLS` -> `startUrls`
- `CRAWLER.INCLUDE_URLS` -> `include`
- `CRAWLER.EXCLUDE_PATTERNS` -> `exclude`
- `CRAWLER.ALLOWED_CONTENT_TYPES` -> `allowedContentTypes`
- `CRAWLER.DOM_ELEMENTS_REMOVE` -> `extract.removeSelectors`
- `CRAWLER.DYNAMIC_CRAWLING: true` -> `fetcher: 'browser'`
- `REQUEST_TIMEOUT` / `MAX_REDIRECTS` / `MAX_CONTENT_LENGTH` -> `request.*`
- `MAX_RETRIES` / `RETRY_STATUS_CODES` / `CRAWL_ERROR_RETRY_DELAY_MS` -> `retry.{max,statusCodes,delay}`
- `CRAWL_RATE_LIMIT_FALLBACK_DELAY_MS` / `EXIT_ON_RATE_LIMIT` / `EXIT_CODE_RATE_LIMIT` -> `rateLimit.*`
- `CRAWL_DELAY_MS` -> `crawl.delay`
- `DATA_FORMATTER.CATEGORISED_PATHS` -> `output.routes`
- `DATA_FORMATTER.EXCLUDED_PATTERNS` -> `output.exclude`

New in 2.0: `crawl.concurrency`, `crawl.maxDepth`, `crawl.resetOnComplete`, `output.format`, pluggable `fetcher`, and lifecycle hooks. Formatted output is now real JSON by default (1.x wrote `url content` text lines).
