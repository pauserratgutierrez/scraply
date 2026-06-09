import { URL } from 'node:url';
import { delay } from '../util/delay.js';

/**
 * Drains the queue with a fixed-size worker pool. Requests to the same host are
 * spaced by `perHostDelay` for politeness, while different hosts run in parallel.
 * Workers stop when the queue is drained and nothing is in flight, or when
 * `isStopped()` becomes true.
 *
 * @param {Object} deps
 * @param {import('./queue.js').QueueManager} deps.queue
 * @param {number} deps.concurrency
 * @param {number} deps.perHostDelay
 * @param {(entry: import('./queue.js').QueueEntry) => Promise<void>} deps.processOne
 * @param {() => boolean} deps.isStopped
 */
export const runPipeline = async ({ queue, concurrency, perHostDelay, processOne, isStopped }) => {
  const lastHostAt = new Map();
  let active = 0;

  const respectHostDelay = async (url) => {
    if (perHostDelay <= 0) return;

    let host;
    try {
      host = new URL(url).host;
    } catch {
      return;
    }

    const now = Date.now();
    const scheduled = Math.max(now, (lastHostAt.get(host) ?? 0) + perHostDelay);
    lastHostAt.set(host, scheduled);

    const wait = scheduled - now;
    if (wait > 0) await delay(wait);
  };

  const worker = async () => {
    while (!isStopped()) {
      const entry = queue.claimNext();

      if (!entry) {
        if (active === 0) return; // queue drained and nothing can enqueue more
        await delay(25);
        continue;
      }

      active++;
      try {
        await respectHostDelay(entry.url);
        await processOne(entry);
      } finally {
        active--;
      }
    }
  };

  const workers = Array.from({ length: Math.max(concurrency, 1) }, () => worker());
  await Promise.all(workers);
};
