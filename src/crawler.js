import path from 'node:path';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

import { loadConfig } from './config/load.js';
import { createLogger } from './util/logger.js';
import { createHooks } from './util/hooks.js';
import { normalizeUrl } from './url/normalize.js';
import { matchesAnyPattern } from './url/patterns.js';
import { discoverLinks } from './extract/links.js';
import { extractText } from './extract/extract.js';
import { QueueManager } from './core/queue.js';
import { runPipeline } from './core/pipeline.js';
import { createRetryRunner } from './core/retry.js';
import { resolveFetcher } from './fetchers/index.js';
import { formatRecords } from './output/writers.js';
import { loadJSON, saveJSON, deletePath, deleteUntracked } from './storage/files.js';

const toHtml = (data) => (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));

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

  const closeFetcher = async () => {
    if (fetcher.close) await fetcher.close();
  };

  const onRateLimitExit = (code) => {
    queue.flush();
    closeFetcher().finally(() => process.exit(code));
  };

  const retryRunner = createRetryRunner({ config, logger, onRateLimitExit });

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

  // Extracts readable text from HTML.
  const extract = (html, url = null) => ({
    url,
    content: extractText(html, { removeSelectors: config.extract.removeSelectors })
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

      // Fetchers return lowercased header keys (see Fetcher interface).
      const contentType = result.headers?.['content-type'];
      if (!contentType || !config.allowedContentTypes.some((type) => contentType.includes(type))) {
        queue.markSkipped(entry, { reason: `content-type: ${contentType ?? 'none'}`, status: result.status });
        return;
      }

      const $ = cheerio.load(toHtml(result.data));

      // Discover links from the full DOM before extraction strips elements.
      await enqueue(discoverLinks($, entry.url), { depth: entry.depth + 1, referrer: entry.url });

      let content = extractText($, { removeSelectors: config.extract.removeSelectors });
      content = await hooks.reduce('extract', content, $, entry);

      const record = {
        url: entry.url,
        content,
        crawledAt: new Date().toISOString(),
        hash: sha256(content)
      };

      const file = saveDataset(record);
      queue.markDone(entry, { file, status: result.status });

      const transformed = await hooks.reduce('transform', record, entry);
      await hooks.emit('page', transformed, entry);
    } catch (error) {
      // A 429 only reaches here when rateLimit.exitOnLimit is true and the
      // process is already exiting; leave the entry pending so the next run
      // retries it instead of recording a permanent error.
      if (error.response?.status !== 429) {
        queue.markError(entry, { error: error.message, status: error.response?.status });
      }
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
    if (signalsRegistered) return;
    signalsRegistered = true;

    const handler = async () => {
      logger.warn('Received termination signal. Saving progress...');
      stopped = true;
      queue.flush();
      await closeFetcher();
      process.exit(0);
    };

    process.once('SIGINT', handler);
    process.once('SIGTERM', handler);
  };

  // Crawls until the queue is drained (or `stop()` is called).
  const crawl = async () => {
    init();
    logBanner();
    registerSignals();

    if (fetcher.init) await fetcher.init();
    processedCount = queue.crawledCount() + queue.errorCount() + queue.skippedCount();

    await runPipeline({
      queue,
      concurrency: config.crawl.concurrency,
      perHostDelay: config.crawl.delay,
      processOne,
      isStopped: () => stopped || queue.crawledCount() >= config.crawl.maxPages
    });

    queue.flush();

    if (config.crawl.maxPages !== Infinity && queue.crawledCount() >= config.crawl.maxPages) {
      logger.info(`Reached maxPages limit (${config.crawl.maxPages}).`);
    }

    logger.info(
      `Crawling completed! ${queue.crawledCount()} crawled, ${queue.skippedCount()} skipped, ` +
        `${queue.errorCount()} errors, ${queue.pendingCount()} pending (of ${queue.entries.length} total).`
    );
  };

  // Re-reads crawled pages from disk so resumed runs include earlier sessions.
  const collectRecords = () => {
    const records = [];
    for (const entry of queue.entries) {
      if (!entry.file) continue;
      const data = loadJSON(path.posix.join(config.storage.crawledDir, entry.file), null);
      if (data) records.push({ url: entry.url, content: data.content });
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
    stop: () => {
      stopped = true;
    }
  };
};

// One-call convenience wrapper: create a crawler and run the full pipeline.
export const scraply = (userConfig = {}) => createCrawler(userConfig).run();
