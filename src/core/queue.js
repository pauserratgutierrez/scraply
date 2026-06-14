import { loadJSON, saveJSON, deletePath } from '../storage/files.js';

/**
 * @typedef {Object} QueueEntry
 * @property {string} url
 * @property {string|null} file     - filename of the saved crawled record (relative to crawledDir), or null
 * @property {number|null} status   - last HTTP status
 * @property {string|null} error    - error message, or null
 * @property {string|null} skipped  - reason the page was skipped (e.g. content-type), or null
 * @property {string|null} referrer - URL this entry was discovered on
 * @property {number} depth
 */

const isProcessed = (entry) => entry.file !== null || entry.error !== null || entry.skipped !== null;

/**
 * Owns the crawl queue: dedup, depth limiting, status tracking and durable
 * checkpointing. Status totals are tracked incrementally (O(1) reads) and
 * persistence is debounced so a high-concurrency crawl does not rewrite the
 * queue file on every single URL.
 */
export class QueueManager {
  /** @param {{ config: import('../index.js').ResolvedConfig, logger: any }} deps */
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.path = config.storage.queuePath;
    this.maxDepth = config.crawl.maxDepth;

    /** @type {QueueEntry[]} */
    this.entries = [];
    /** @type {Set<string>} */
    this.index = new Set();
    /** @type {QueueEntry[]} */
    this._pending = [];
    this._cursor = 0;
    this._crawled = 0;
    this._errors = 0;
    this._skipped = 0;
    this._dirty = false;
    this._timer = null;
    this._persistInterval = 1000;
  }

  /** Loads any previously persisted queue and rebuilds the in-memory indexes and totals. */
  load() {
    this.entries = loadJSON(this.path, []) ?? [];
    this.index = new Set(this.entries.map((entry) => entry.url));
    this._pending = [];
    this._crawled = 0;
    this._errors = 0;
    this._skipped = 0;

    for (const entry of this.entries) {
      if (entry.file !== null) this._crawled += 1;
      else if (entry.error !== null) this._errors += 1;
      else if (entry.skipped !== null) this._skipped += 1;
      else this._pending.push(entry);
    }

    this._cursor = 0;
    return this.entries;
  }

  /** Replaces the queue with a fresh set of start URLs. */
  seed(urls) {
    for (const url of urls) this.add(url, { depth: 0, referrer: null });
    this.flush();
  }

  /**
   * Adds a URL if it is new and within the depth limit.
   * @returns {boolean} whether the URL was added
   */
  add(url, { depth = 0, referrer = null } = {}) {
    if (this.index.has(url) || depth > this.maxDepth) return false;

    const entry = { url, file: null, status: null, error: null, skipped: null, referrer, depth };
    this.index.add(url);
    this.entries.push(entry);
    this._pending.push(entry);
    this._markDirty();
    return true;
  }

  /** Returns the next unprocessed entry, or null when the queue is drained. */
  claimNext() {
    return this._cursor < this._pending.length ? this._pending[this._cursor++] : null;
  }

  markDone(entry, { file, status }) {
    entry.file = file;
    entry.status = status;
    entry.error = null;
    entry.skipped = null;
    this._crawled += 1;
    this._markDirty();
  }

  markError(entry, { error, status }) {
    entry.error = error;
    entry.status = status ?? null;
    this._errors += 1;
    this._markDirty();
  }

  markSkipped(entry, { reason, status }) {
    entry.skipped = reason;
    entry.status = status ?? null;
    this._skipped += 1;
    this._markDirty();
  }

  /**
   * Returns matching terminal entries to the pending set so the next crawl
   * retries them. Persists immediately so a fresh `load()` (e.g. at the start of
   * `crawl()`) sees the requeued entries.
   * @param {(entry: QueueEntry) => boolean} match
   * @returns {number} how many entries were requeued
   */
  _requeue(match) {
    let count = 0;
    for (const entry of this.entries) {
      if (!match(entry)) continue;

      if (entry.error !== null) this._errors -= 1;
      if (entry.skipped !== null) this._skipped -= 1;

      entry.error = null;
      entry.skipped = null;
      entry.status = null;
      this._pending.push(entry);
      count += 1;
    }
    if (count > 0) this.flush();
    return count;
  }

  /** Re-queues every errored entry for retry. @returns {number} */
  requeueErrors() {
    return this._requeue((entry) => entry.error !== null);
  }

  /**
   * Re-queues every skipped entry for another attempt. Useful after widening
   * `allowedContentTypes` (or changing `sites`) so previously skipped URLs are
   * reconsidered. @returns {number}
   */
  requeueSkipped() {
    return this._requeue((entry) => entry.skipped !== null);
  }

  isAllProcessed() {
    return this.entries.length > 0 && this.pendingCount() === 0;
  }

  pendingCount() {
    return this.entries.length - this._crawled - this._errors - this._skipped;
  }

  crawledCount() {
    return this._crawled;
  }

  errorCount() {
    return this._errors;
  }

  skippedCount() {
    return this._skipped;
  }

  /** Clears in-memory state and removes the persisted queue file. */
  reset() {
    this.entries = [];
    this.index = new Set();
    this._pending = [];
    this._cursor = 0;
    this._crawled = 0;
    this._errors = 0;
    this._skipped = 0;
    this._dirty = false;
    deletePath(this.path);
  }

  _markDirty() {
    this._dirty = true;
    if (this._timer) return;
    this._timer = setTimeout(() => this.flush(), this._persistInterval);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  /** Writes the queue to disk if it has unsaved changes. */
  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (!this._dirty) return;
    saveJSON(this.path, this.entries);
    this._dirty = false;
  }
}
