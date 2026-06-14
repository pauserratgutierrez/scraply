import path from 'node:path';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

import { loadConfig } from './config/load.js';
import { createLogger } from './util/logger.js';
import { createHooks } from './util/hooks.js';
import { normalizeUrl } from './url/normalize.js';
import { matchesPattern, matchesAnyPattern } from './url/patterns.js';
import { discoverLinks } from './extract/links.js';
import { extractText } from './extract/extract.js';
import { classifyContentType, parseJson, toText } from './extract/parse.js';
import { parseSitemap } from './extract/sitemap.js';
import { QueueManager } from './core/queue.js';
import { runPipeline } from './core/pipeline.js';
import { createRetryRunner } from './core/retry.js';
import { RateLimitError } from './core/errors.js';
import { resolveFetcher } from './fetchers/index.js';
import { formatRecords } from './output/writers.js';
import { loadJSON, saveJSON, deletePath, deleteUntracked } from './storage/files.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Creates a crawler instance. Every stage is exposed as a method so callers can run the whole pipeline (`run`) or drive individual stages and add their own logic via hooks.
 *
 * @param {import('./index.js').ScraplyConfig} [userConfig]
 */
export const createCrawler = (userConfig = {}) => {
  const config = loadConfig(userConfig);
  const logger = createLogger(config.logLevel);
  const hooks = createHooks();
  const queue = new QueueManager({ config, logger });
  const fetcher = resolveFetcher({ config, logger });

  // Normalized once so the start URLs match discovered (normalized) links and
  // can be looked up in O(1) during filtering.
  const startUrls = config.startUrls.map(normalizeUrl);
  const startUrlSet = new Set(startUrls);

  let stopped = false;
  let initialized = false;
  let datasetCounter = 0;
  let processedCount = 0;
  let signalsRegistered = false;
  let signalHandler = null;
  /** @type {RateLimitError|null} Set when a 429 aborts the crawl; rethrown after the pool drains. */
  let rateLimitError = null;

  const closeFetcher = async () => {
    if (fetcher.close) await fetcher.close();
  };

  const retryRunner = createRetryRunner({ config, logger });

  // Resolves the effective per-URL config, applying the most specific matching
  // `sites` entry over the top-level `allowedContentTypes` / `extract`.
  const resolveEntryConfig = (url) => {
    if (!config.sites.length) {
      return { allowedContentTypes: config.allowedContentTypes, extract: config.extract };
    }

    let best = null;
    let bestLen = -1;
    for (const site of config.sites) {
      for (const pattern of site.match) {
        if (!matchesPattern(url, pattern)) continue;
        const len = typeof pattern === 'string' ? pattern.length : String(pattern).length;
        if (len > bestLen) {
          bestLen = len;
          best = site;
        }
      }
    }

    if (!best) {
      return { allowedContentTypes: config.allowedContentTypes, extract: config.extract };
    }

    return {
      allowedContentTypes: best.allowedContentTypes ?? config.allowedContentTypes,
      extract: { ...config.extract, ...(best.extract ?? {}) }
    };
  };

  // --- queue lifecycle ---

  const computeDatasetCounter = () => {
    let max = 0;
    for (const entry of queue.entries) {
      const match = entry.file && /(\d+)\.json$/.exec(entry.file);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return max;
  };

  const init = () => {
    if (initialized) return;
    initialized = true;

    queue.load();
    datasetCounter = computeDatasetCounter();

    if (config.crawl.retryErrors) {
      const requeued = queue.requeueErrors();
      if (requeued > 0) logger.info(`Re-queued ${requeued} previously errored URL(s) for retry.`);
    }

    if (config.crawl.retrySkipped) {
      const requeued = queue.requeueSkipped();
      if (requeued > 0) logger.info(`Re-queued ${requeued} previously skipped URL(s) for retry.`);
    }

    if (queue.entries.length === 0) {
      logger.info(`Starting fresh with ${startUrls.length} start URL(s).`);
      queue.seed(startUrls);
      return;
    }

    if (queue.isAllProcessed()) {
      if (config.crawl.resetOnComplete) {
        logger.info('All URLs processed. Resetting persistent storage for a fresh crawl...');
        queue.reset();
        deletePath(config.storage.crawledDir);
        datasetCounter = 0;
        queue.seed(startUrls);
      } else {
        logger.info('All URLs already processed (resetOnComplete is false). Nothing to do.');
      }
      return;
    }

    logger.info(`Resuming with ${queue.entries.length} URL(s) (${queue.pendingCount()} pending).`);
  };

  // --- stage methods ---

  // Fetches a single URL (with retry/rate-limit policy) and returns the raw result.
  const fetchUrl = (url) => retryRunner.run(() => fetcher.fetch(normalizeUrl(url)));

  // Extracts readable text from HTML. When a URL is supplied, the matching
  // per-site extract rules apply; otherwise the global extract config is used.
  const extract = (html, url = null) => ({
    url,
    content: extractText(html, url ? resolveEntryConfig(url).extract : config.extract)
  });

  const shouldCrawl = (url) => {
    if (startUrlSet.has(url)) return true;
    if (matchesAnyPattern(url, config.exclude)) return false;
    return matchesAnyPattern(url, config.include);
  };

  // Filters + normalizes URLs and adds the survivors to the queue.
  const enqueue = async (urls, { depth = 0, referrer = null } = {}) => {
    const list = Array.isArray(urls) ? urls : [urls];
    let added = 0;

    for (const raw of list) {
      let url;
      try {
        url = normalizeUrl(raw);
      } catch {
        continue;
      }

      if (!shouldCrawl(url)) continue;
      const allow = await hooks.reduce('shouldEnqueue', true, url, referrer);
      if (allow === false) continue;
      if (queue.add(url, { depth, referrer })) added++;
    }

    return added;
  };

  // Persists a crawled record and returns its filename (relative to crawledDir).
  // Only the bare name is stored in the queue so datasets stay portable.
  const saveDataset = (record) => {
    datasetCounter += 1;
    const file = `${datasetCounter}.json`;
    saveJSON(path.posix.join(config.storage.crawledDir, file), record);
    return file;
  };

  const processOne = async (entry) => {
    if (entry.file || entry.error || entry.skipped) return;

    processedCount += 1;
    logger.info(`- ${processedCount}/${queue.entries.length} -> ${entry.url}`);

    try {
      const result = await retryRunner.run(() => fetcher.fetch(entry.url));
      await hooks.emit('response', result, entry);

      const effective = resolveEntryConfig(entry.url);

      // Fetchers return lowercased header keys (see Fetcher interface).
      const contentType = result.headers?.['content-type'];
      if (!contentType || !effective.allowedContentTypes.some((type) => contentType.includes(type))) {
        const reason = `content-type: ${contentType ?? 'none'}`;
        queue.markSkipped(entry, { reason, status: result.status });
        await hooks.emit('skip', entry, { reason, status: result.status, result });
        return;
      }

      const kind = classifyContentType(contentType);
      let $ = null;
      let content = '';
      let data = null;

      if (kind === 'html') {
        $ = cheerio.load(toText(result.data));

        // Discover links from the full DOM before extraction strips elements.
        const links = await hooks.reduce('links', discoverLinks($, entry.url), $, entry, result);
        await enqueue(links, { depth: entry.depth + 1, referrer: entry.url });

        content = extractText($, effective.extract);
      } else if (kind === 'json' && effective.extract.json !== false) {
        const parsed = parseJson(result.data);
        data = parsed.data;
        content = parsed.content;

        const links = await hooks.reduce('links', [], $, entry, result);
        if (links?.length) await enqueue(links, { depth: entry.depth + 1, referrer: entry.url });
      } else {
        content = toText(result.data);

        const links = await hooks.reduce('links', [], $, entry, result);
        if (links?.length) await enqueue(links, { depth: entry.depth + 1, referrer: entry.url });
      }

      content = await hooks.reduce('extract', content, $, entry, result);

      let record = { url: entry.url, content, crawledAt: new Date().toISOString() };
      if (data !== null) record.data = data;

      // Transform runs BEFORE the record is persisted so its result is what gets
      // saved to disk and later picked up by format().
      record = await hooks.reduce('transform', record, entry, result);
      record.hash = sha256(record.content ?? '');

      const file = saveDataset(record);
      queue.markDone(entry, { file, status: result.status });

      await hooks.emit('page', record, entry, result);
    } catch (error) {
      // A 429 with exitOnLimit aborts the whole crawl: stash the error, stop the
      // pool and leave the entry pending so the next run retries it.
      if (error instanceof RateLimitError) {
        rateLimitError = error;
        stopped = true;
        queue.flush();
        return;
      }

      queue.markError(entry, { error: error.message, status: error.response?.status });
      await hooks.emit('error', error, entry);
      logger.error(`Failed to fetch ${entry.url} -> ${error.message}`);
    }
  };

  const logBanner = () => {
    const browserLine =
      fetcher.name === 'browser' ? `\n  - Browser waitUntil: ${config.browser.waitUntil}` : '';

    logger.info(`STARTING SCRAPLY CRAWLER...
  - Start URLs: ${config.startUrls.join(', ')}
  - Fetcher: ${fetcher.name}${browserLine}
  - Concurrency: ${config.crawl.concurrency}
  - Per-host delay: ${config.crawl.delay}ms
  - Max depth: ${config.crawl.maxDepth}
  - Max pages: ${config.crawl.maxPages}
  - Allowed content types: ${config.allowedContentTypes.join(', ')}
  - Output format: ${config.output.format}
`);
  };

  const registerSignals = () => {
    if (!config.signals || signalsRegistered) return;
    signalsRegistered = true;

    let forcing = false;
    signalHandler = () => {
      if (forcing) {
        logger.warn('Received second termination signal. Forcing quit.');
        process.exit(1);
      }
      forcing = true;
      logger.warn('Received termination signal. Finishing in-flight work... (signal again to force quit)');
      stopped = true;
      queue.flush();
    };

    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);
  };

  const unregisterSignals = () => {
    if (!signalHandler) return;
    process.off('SIGINT', signalHandler);
    process.off('SIGTERM', signalHandler);
    signalHandler = null;
    signalsRegistered = false;
  };

  // Seeds URLs from sitemap(s) when crawl.sitemap is enabled. Recurses into
  // sitemap indexes (bounded) and routes discovered URLs through enqueue() so
  // include/exclude rules still apply.
  const seedSitemaps = async () => {
    const cfg = config.crawl.sitemap;
    if (!cfg) return;

    const roots = Array.isArray(cfg)
      ? cfg
      : startUrls.map((url) => new URL('/sitemap.xml', url).href);

    const seen = new Set();
    let added = 0;

    const visit = async (url, depth) => {
      if (depth > 5 || seen.has(url)) return;
      seen.add(url);

      try {
        const result = await retryRunner.run(() => fetcher.fetch(url));
        const { sitemaps, urls } = parseSitemap(toText(result.data));
        added += await enqueue(urls, { depth: 0, referrer: url });
        for (const nested of sitemaps) await visit(nested, depth + 1);
      } catch (error) {
        if (error instanceof RateLimitError) throw error;
        logger.warn(`Sitemap fetch failed (${url}) -> ${error.message}`);
      }
    };

    for (const url of roots) await visit(url, 0);
    if (added > 0) logger.info(`Seeded ${added} URL(s) from sitemap(s).`);
  };

  // Crawls until the queue is drained (or `stop()` is called).
  const crawl = async () => {
    init();
    logBanner();
    registerSignals();
    rateLimitError = null;

    try {
      if (fetcher.init) await fetcher.init();
      await seedSitemaps();
      processedCount = queue.crawledCount() + queue.errorCount() + queue.skippedCount();

      await runPipeline({
        queue,
        concurrency: config.crawl.concurrency,
        perHostDelay: config.crawl.delay,
        processOne,
        isStopped: () => stopped || queue.crawledCount() >= config.crawl.maxPages
      });

      queue.flush();

      // A rate-limit abort surfaces here so run() can clean up (flush + close)
      // before the error propagates to the caller.
      if (rateLimitError) throw rateLimitError;

      if (config.crawl.maxPages !== Infinity && queue.crawledCount() >= config.crawl.maxPages) {
        logger.info(`Reached maxPages limit (${config.crawl.maxPages}).`);
      }

      logger.info(
        `Crawling completed! ${queue.crawledCount()} crawled, ${queue.skippedCount()} skipped, ` +
          `${queue.errorCount()} errors, ${queue.pendingCount()} pending (of ${queue.entries.length} total).`
      );
    } finally {
      unregisterSignals();
    }
  };

  // Re-reads crawled pages from disk so resumed runs include earlier sessions.
  // The full saved record is returned (including any `transform` additions and
  // `data` for JSON sources); the output writer decides what to serialize.
  const collectRecords = () => {
    const records = [];
    for (const entry of queue.entries) {
      if (!entry.file) continue;
      const record = loadJSON(path.posix.join(config.storage.crawledDir, entry.file), null);
      if (record) records.push(record);
    }
    return records;
  };

  // Routes records to their output files and writes them. Defaults to every successfully crawled page; pass an explicit array to format custom records. When reading from disk, reloads `dataset/queue.json` first so this can run without calling `crawl()` (e.g. after changing `output.routes`).
  const format = async (records = null) => {
    logger.info('Formatting data...');

    if (records === null) queue.load();

    const collected = records ?? collectRecords();
    const groups = formatRecords(collected, {
      output: config.output,
      formattedDir: config.storage.formattedDir
    });

    let total = 0;
    for (const [filePath, group] of groups) {
      total += group.length;
      logger.info(`${group.length} -> ${filePath}`);
    }
    logger.info(`${total} total saved URL(s) to ${config.storage.formattedDir}`);

    logger.info('Cleaning up untracked files...');
    deleteUntracked(config.storage.formattedDir, new Set(groups.keys()), logger);

    return groups;
  };

  // Full pipeline: init -> crawl -> format, with guaranteed cleanup.
  const run = async () => {
    try {
      await crawl();
      await format();
    } finally {
      queue.flush();
      await closeFetcher();
    }
    return queue.entries;
  };

  return {
    config,
    logger,
    queue,
    on: hooks.on,
    fetch: fetchUrl,
    extract,
    enqueue,
    crawl,
    format,
    run,
    // Clears errored entries and returns them to the queue so a later crawl()
    // retries them. Persists immediately; returns how many were requeued.
    requeueErrors: () => {
      if (queue.entries.length === 0) queue.load();
      return queue.requeueErrors();
    },
    // Same as requeueErrors() but for skipped entries (e.g. after widening
    // allowedContentTypes or changing sites).
    requeueSkipped: () => {
      if (queue.entries.length === 0) queue.load();
      return queue.requeueSkipped();
    },
    stop: () => {
      stopped = true;
    }
  };
};

// One-call convenience wrapper: create a crawler and run the full pipeline.
export const scraply = (userConfig = {}) => createCrawler(userConfig).run();

/**
 * Runs multiple crawlers in one process. Accepts crawler instances or plain
 * config objects (which are turned into crawlers). Because the crawler no longer
 * calls `process.exit`, several crawlers can safely share one process — set
 * `signals: false` in each config (or rely on the per-instance graceful stop).
 *
 * @param {Array<import('./index.js').ScraplyConfig | ReturnType<typeof createCrawler>>} items
 * @param {{ concurrency?: number }} [options] - how many crawlers run at once (default 1 = sequential)
 * @returns {Promise<Array<import('./core/queue.js').QueueEntry[]>>} each crawler's final queue entries, in input order
 */
export const runCrawlers = async (items, { concurrency = 1 } = {}) => {
  const instances = items.map((item) =>
    item && typeof item.run === 'function' ? item : createCrawler(item)
  );

  const results = new Array(instances.length);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= instances.length) return;
      results[index] = await instances[index].run();
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, instances.length || 1));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  return results;
};
