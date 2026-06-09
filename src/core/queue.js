import { loadJSON, saveJSON, deletePath } from '../storage/files.js';

/**
 * @typedef {Object} QueueEntry
 * @property {string} url
 * @property {string|null} file     - path to the saved crawled file, or null
 * @property {number|null} status   - last HTTP status
 * @property {string|null} error    - error message, or null
 * @property {string|null} referrer - URL this entry was discovered on
 * @property {number} depth
 */

const isProcessed = (entry) => entry.file !== null || entry.error !== null;

/**
 * Owns the crawl queue: dedup, depth limiting, status tracking and durable
 * checkpointing. Persistence is debounced so a high-concurrency crawl does not
 * rewrite the queue file on every single URL.
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
    this._dirty = false;
    this._timer = null;
    this._persistInterval = 1000;
  }

  /** Loads any previously persisted queue and rebuilds the in-memory indexes. */
  load() {
    this.entries = loadJSON(this.path, []) ?? [];
    this.index = new Set(this.entries.map((entry) => entry.url));
    this._pending = this.entries.filter((entry) => !isProcessed(entry));
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

    const entry = { url, file: null, status: null, error: null, referrer, depth };
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
    this._markDirty();
  }

  markError(entry, { error, status }) {
    entry.error = error;
    entry.status = status ?? null;
    this._markDirty();
  }

  isAllProcessed() {
    return this.entries.length > 0 && this.entries.every(isProcessed);
  }

  pendingCount() {
    return this.entries.filter((entry) => !isProcessed(entry)).length;
  }

  crawledCount() {
    return this.entries.filter((entry) => entry.file !== null).length;
  }

  errorCount() {
    return this.entries.filter((entry) => entry.error !== null).length;
  }

  /** Clears in-memory state and removes the persisted queue file. */
  reset() {
    this.entries = [];
    this.index = new Set();
    this._pending = [];
    this._cursor = 0;
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
