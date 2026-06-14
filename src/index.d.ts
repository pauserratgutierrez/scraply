import type { CheerioAPI } from 'cheerio';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
export type OutputFormat = 'json' | 'jsonl' | 'lines';
export type ContentKind = 'html' | 'json' | 'text';
export type UrlPattern = string | RegExp;
export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
export type BlockableResource = 'image' | 'stylesheet' | 'font' | 'media';

/**
 * List fields accept a plain array (replaces the default) or a directive object
 * that combines with Scraply's defaults.
 */
export type ListInput<T> = T[] | { extend?: T[]; append?: T[]; prepend?: T[]; replace?: T[] };

export interface RequestConfig {
  timeout: number;
  maxRedirects: number;
  /** Hard cap on the response body in bytes; 0 disables it. */
  maxContentLength: number;
  userAgent: string;
  headers: Record<string, string>;
}

export interface RetryConfig {
  max: number;
  statusCodes: number[];
  delay: number;
}

export interface RateLimitConfig {
  fallbackDelay: number;
  /** false: wait & retry. true: abort the crawl with a RateLimitError. */
  exitOnLimit: boolean;
  exitCode: number;
}

export interface CrawlConfig {
  concurrency: number;
  /** Minimum spacing (ms) between requests to the same host. */
  delay: number;
  maxDepth: number;
  maxPages: number;
  resetOnComplete: boolean;
  retryErrors: boolean;
  retrySkipped: boolean;
  /** true seeds <origin>/sitemap.xml per start URL, or pass explicit sitemap URLs. */
  sitemap: boolean | string[];
}

export interface BrowserConfig {
  waitUntil: WaitUntil;
  blockResources: BlockableResource[];
}

export interface ExtractConfig {
  /** Allow-list container(s) to read text from; null = whole <body>. */
  root?: string | string[] | null;
  /** Selector used when `root` matches nothing (default 'body'). */
  rootFallback?: string;
  /** Parse JSON bodies into pretty content + record.data (default true). */
  json?: boolean;
  /** Elements stripped before text extraction. */
  removeSelectors?: string[];
}

export interface OutputConfig {
  format: OutputFormat;
  exclude: UrlPattern[];
  routes: Record<string, Record<string, string>>;
}

/** Per-origin/route override applied to URLs matching `match`. */
export interface SiteConfig {
  match: UrlPattern | UrlPattern[];
  allowedContentTypes?: string[];
  extract?: ExtractConfig;
}

export interface FetchResult {
  data: string | ArrayBuffer;
  status: number;
  /** Header keys are lowercased. */
  headers: Record<string, string>;
}

export interface Fetcher {
  name: string;
  fetch(url: string): Promise<FetchResult>;
  init?(): Promise<void>;
  close?(): Promise<void>;
}

export interface Logger {
  level: LogLevel;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface FetcherDeps {
  config: ResolvedConfig;
  logger: Logger;
}

export interface QueueEntry {
  url: string;
  /** Filename of the saved crawled record (relative to crawledDir), or null. */
  file: string | null;
  status: number | null;
  error: string | null;
  skipped: string | null;
  referrer: string | null;
  depth: number;
}

/** A crawled record. `data` is present for JSON sources; transform hooks may add fields. */
export interface CrawlRecord {
  url: string;
  content: string;
  crawledAt: string;
  hash: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface QueueManager {
  entries: QueueEntry[];
  load(): QueueEntry[];
  seed(urls: string[]): void;
  add(url: string, opts?: { depth?: number; referrer?: string | null }): boolean;
  claimNext(): QueueEntry | null;
  requeueErrors(): number;
  requeueSkipped(): number;
  isAllProcessed(): boolean;
  pendingCount(): number;
  crawledCount(): number;
  errorCount(): number;
  skippedCount(): number;
  flush(): void;
  reset(): void;
}

export interface ScraplyConfig {
  startUrls?: string[];
  include?: ListInput<UrlPattern>;
  exclude?: ListInput<UrlPattern>;
  allowedContentTypes?: ListInput<string>;
  sites?: SiteConfig[];
  fetcher?: 'http' | 'browser' | Fetcher;
  browser?: Partial<BrowserConfig>;
  logLevel?: LogLevel;
  /** Install SIGINT/SIGTERM handlers for a graceful stop (default true). */
  signals?: boolean;
  storage?: { dir?: string };
  request?: Partial<RequestConfig>;
  retry?: Partial<RetryConfig>;
  rateLimit?: Partial<RateLimitConfig>;
  crawl?: Partial<CrawlConfig>;
  extract?: Omit<ExtractConfig, 'removeSelectors'> & { removeSelectors?: ListInput<string> };
  output?: Partial<Omit<OutputConfig, 'exclude'>> & { exclude?: ListInput<UrlPattern> };
}

export interface ResolvedConfig {
  startUrls: string[];
  include: UrlPattern[];
  exclude: UrlPattern[];
  allowedContentTypes: string[];
  sites: Array<{ match: UrlPattern[]; allowedContentTypes?: string[]; extract?: ExtractConfig }>;
  fetcher: 'http' | 'browser' | Fetcher;
  browser: BrowserConfig;
  logLevel: LogLevel;
  signals: boolean;
  storage: { dir: string; queuePath: string; crawledDir: string; formattedDir: string };
  request: RequestConfig;
  retry: RetryConfig;
  rateLimit: RateLimitConfig;
  crawl: CrawlConfig;
  extract: ExtractConfig & { removeSelectors: string[] };
  output: OutputConfig;
}

/** Lifecycle hooks. Reduce hooks may return a replacement value; emit hooks are side-effect only. */
export interface HookMap {
  /** Fires right after a successful fetch, before the content-type gate. */
  response: (result: FetchResult, entry: QueueEntry) => void | Promise<void>;
  /** Fires when a response is skipped (e.g. disallowed content-type). */
  skip: (
    entry: QueueEntry,
    info: { reason: string; status: number | null; result: FetchResult }
  ) => void | Promise<void>;
  /** Return false to veto enqueuing a URL. */
  shouldEnqueue: (
    allow: boolean,
    url: string,
    referrer: string | null
  ) => boolean | void | Promise<boolean | void>;
  /** Reduce/replace the list of discovered links before they are enqueued. `$` is null for non-HTML. */
  links: (
    links: string[],
    $: CheerioAPI | null,
    entry: QueueEntry,
    result: FetchResult
  ) => string[] | void | Promise<string[] | void>;
  /** Reduce/replace the extracted content. `$` is null for non-HTML bodies. */
  extract: (
    content: string,
    $: CheerioAPI | null,
    entry: QueueEntry,
    result: FetchResult
  ) => string | void | Promise<string | void>;
  /** Reduce/replace the record before it is persisted and formatted. */
  transform: (
    record: CrawlRecord,
    entry: QueueEntry,
    result: FetchResult
  ) => CrawlRecord | void | Promise<CrawlRecord | void>;
  /** Fires after a record is persisted. */
  page: (record: CrawlRecord, entry: QueueEntry, result: FetchResult) => void | Promise<void>;
  /** Fires when a fetch/process fails (non-429). */
  error: (error: Error, entry: QueueEntry) => void | Promise<void>;
}

export interface Crawler {
  config: ResolvedConfig;
  logger: Logger;
  queue: QueueManager;
  on<K extends keyof HookMap>(event: K, fn: HookMap[K]): () => void;
  fetch(url: string): Promise<FetchResult>;
  extract(html: string | CheerioAPI, url?: string | null): { url: string | null; content: string };
  enqueue(
    urls: string | string[],
    opts?: { depth?: number; referrer?: string | null }
  ): Promise<number>;
  crawl(): Promise<void>;
  format(records?: CrawlRecord[] | null): Promise<Map<string, CrawlRecord[]>>;
  run(): Promise<QueueEntry[]>;
  requeueErrors(): number;
  requeueSkipped(): number;
  stop(): void;
}

export function createCrawler(config?: ScraplyConfig): Crawler;
export function scraply(config?: ScraplyConfig): Promise<QueueEntry[]>;
export function runCrawlers(
  items: Array<ScraplyConfig | Crawler>,
  options?: { concurrency?: number }
): Promise<QueueEntry[][]>;

export function loadConfig(config?: ScraplyConfig): ResolvedConfig;
export const DEFAULT_CONFIG: ScraplyConfig;
export function assertBrowserConfig(browser: BrowserConfig): void;
export const BROWSER_WAIT_UNTIL: readonly WaitUntil[];
export const BROWSER_BLOCKABLE_RESOURCES: readonly BlockableResource[];

export class RateLimitError extends Error {
  name: 'RateLimitError';
  code: number;
  headers: Record<string, string>;
  response: { status: 429; headers: Record<string, string> };
  constructor(
    message?: string,
    options?: { code?: number; headers?: Record<string, string>; cause?: unknown }
  );
}

export function normalizeUrl(url: string): string;
export function matchesPattern(value: string, pattern: UrlPattern): boolean;
export function matchesAnyPattern(value: string, patterns?: UrlPattern[]): boolean;
export function extractText(input: string | CheerioAPI, options?: ExtractConfig): string;
export function discoverLinks($: CheerioAPI, baseUrl: string): string[];
export function classifyContentType(contentType?: string): ContentKind;
export function parseJson(data: string | ArrayBuffer): { data: unknown; content: string };
export function parseSitemap(xml: string): { sitemaps: string[]; urls: string[] };
export function routeRecord(url: string, output: OutputConfig, formattedDir: string): string | null;
export function writeRecords(filePath: string, records: CrawlRecord[], format?: OutputFormat): void;
export function formatRecords(
  records: CrawlRecord[],
  options: { output: OutputConfig; formattedDir: string }
): Map<string, CrawlRecord[]>;

export function resolveFetcher(deps: FetcherDeps): Fetcher;
export function createHttpFetcher(deps: { config: ResolvedConfig }): Fetcher;
export function createBrowserFetcher(deps: { config: ResolvedConfig; logger: Logger }): Fetcher;
