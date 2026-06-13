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
3. The page text is extracted (configurable element removal) and saved under `dataset/crawled/` as `{ url, content, crawledAt, hash }` (`crawledAt` is an ISO timestamp; `hash` is the SHA-256 of `content`, handy for change detection).
4. When the queue drains, all crawled pages are routed by URL into the files defined in `output.routes` and written to `dataset/formatted/`.

Each queue entry ends in one of three terminal states: **crawled** (saved), **skipped** (disallowed `Content-Type`), or **error** (fetch failed). The three are tracked separately so stats stay meaningful.

### Persistence and resuming
The queue and crawled pages are checkpointed to disk in `dataset/`. If a run is interrupted (or rate-limited), progress is saved and the next run resumes exactly where it left off without re-crawling finished URLs. When every URL has been processed, Scraply starts a fresh crawl (set `crawl.resetOnComplete: false` to keep the finished queue instead). To re-attempt failed URLs on the next run, set `crawl.retryErrors: true` (or call `requeueErrors()` and crawl again).

### Concurrency and limits
Pages are crawled with a worker pool (`crawl.concurrency`). Requests to the same host are spaced by `crawl.delay` for politeness, while different hosts run in parallel. `crawl.maxDepth` bounds link depth and `crawl.maxPages` caps the total number of successfully crawled pages (counted across resumes).

### Rate limiting
On HTTP `429`, Scraply either exits immediately with `rateLimit.exitCode` (default) so a scheduler can retry later, or waits (honoring `retry-after` / `x-ratelimit-reset`) and retries — independently of the normal `retry` budget — when `rateLimit.exitOnLimit` is `false`.

## Fetchers
`fetcher` selects the backend:
- `'http'` (default): fast static fetching with the native `fetch`. Redirects are followed up to `request.maxRedirects`, and response bodies larger than `request.maxContentLength` (default 20 MB, `0` disables) are rejected before they are buffered.
- `'browser'`: full JavaScript rendering via Puppeteer (`puppeteer-cluster`).
- a custom object implementing the `Fetcher` interface (`{ name, fetch, init?, close? }`), so backends like Playwright or a remote CDP browser can be plugged in without changing the crawler.

Both built-in fetchers send `request.userAgent` and any extra `request.headers` (e.g. `Authorization`, `Accept-Language`, `Cookie`) with every request.

### Browser fetcher options
The `browser` block applies only when `fetcher: 'browser'`. Both options are validated at config load time. See [`src/config/defaults.js`](src/config/defaults.js) for defaults.

- **`browser.waitUntil`** — passed to Puppeteer `page.goto`. Default `'load'`. Use `'networkidle2'` for SPAs that inject links or content after the initial load (Vue/React sites). Increase `request.timeout` when using slower modes.
- **`browser.blockResources`** — Puppeteer resource types to abort during fetch (`'image'`, `'stylesheet'`, `'font'`, `'media'`). Default `['image', 'font', 'media']`. Stylesheets are excluded by default because many SPAs need CSS before content renders. Pass `[]` to disable resource blocking entirely.

```js
await scraply({
  startUrls: ['https://spa.example.com/products'],
  fetcher: 'browser',
  browser: {
    waitUntil: 'networkidle2',
    blockResources: ['image', 'font', 'media']
  },
  request: { timeout: 60000 }
});
```

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

Instance methods: `run()`, `crawl()`, `fetch(url)`, `extract(html, url)`, `enqueue(urls, opts)`, `format(records?)`, `requeueErrors()`, `stop()`, `on(event, fn)`.

`format()` reads crawled pages from `dataset/crawled/` via the persisted queue. You can call it alone to re-route output after a crawl — no need to fetch pages again.

Hooks: `response`, `extract`, `shouldEnqueue`, `transform`, `page`, `error`.

Standalone exports for advanced use: `normalizeUrl`, `matchesPattern`, `matchesAnyPattern`, `extractText`, `discoverLinks`, `routeRecord`, `writeRecords`, `formatRecords`, `loadConfig`, `DEFAULT_CONFIG`, `resolveFetcher`, `createHttpFetcher`, `createBrowserFetcher`, `assertBrowserConfig`, `BROWSER_WAIT_UNTIL`, `BROWSER_BLOCKABLE_RESOURCES`.

## Configuration
All options are optional except `startUrls`. Pass a partial object to `scraply()` or `createCrawler()` — it is [deep-merged](src/config/load.js) over the defaults. Durations are in milliseconds.

**Full default values and inline comments:** [`src/config/defaults.js`](src/config/defaults.js)

```js
import { DEFAULT_CONFIG, loadConfig } from 'scraply';

// Inspect or extend the defaults programmatically.
const config = loadConfig({
  ...DEFAULT_CONFIG,
  startUrls: ['https://example.com']
});
```

Top-level keys: `startUrls`, `include`, `exclude`, `allowedContentTypes`, `fetcher`, `browser`, `logLevel`, `storage`, `request`, `retry`, `rateLimit`, `crawl`, `extract`, `output`.

### Output routing
`output.routes` is a two-level map:

1. **Outer keys** — URL prefix (usually `https://origin`, or `https://origin/path`) matched against the full crawled URL.
2. **Inner keys** — pathname segments joined with `/`, **without a leading slash**, matched from the longest suffix upward. Use `'*'` as fallback within that prefix.

Inner keys are case-sensitive and must match the URL pathname exactly (e.g. `Products/sports-watches`, not `/products/sports-watches`).

```js
output: {
  routes: {
    'https://docs.example.com': {
      'guide': 'guides.json',
      '*': 'docs.json'
    },
    'https://example.com/products/sports-watches': { '*': 'watches.json' }
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

New in 2.0: `crawl.concurrency`, `crawl.maxDepth`, `crawl.resetOnComplete`, `output.format`, `browser.waitUntil`, `browser.blockResources`, pluggable `fetcher`, and lifecycle hooks. Formatted output is now real JSON by default (1.x wrote `url content` text lines).
