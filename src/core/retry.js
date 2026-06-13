import { delay } from '../util/delay.js';

/** Derives how long to wait (ms) from rate-limit headers, falling back to a default. */
const computeWait = (headers = {}, fallback) => {
  const retryAfter = headers['retry-after'];
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    return Number.isNaN(seconds)
      ? Math.max(new Date(retryAfter).getTime() - Date.now(), 0) // HTTP date
      : seconds * 1000; // delta seconds
  }

  const reset = headers['x-ratelimit-reset'];
  if (reset !== undefined) {
    return Math.max(Number.parseInt(reset, 10) * 1000 - Date.now(), 0); // epoch seconds
  }

  return fallback;
};

/**
 * Wraps a fetch operation with retry and rate-limit handling shared by every
 * fetcher backend.
 *
 * Rate limiting (HTTP 429) is handled independently of the normal retry budget:
 * when `rateLimit.exitOnLimit` is false the runner waits (honoring `retry-after`
 * / `x-ratelimit-reset`) and retries until the host relents; otherwise it
 * triggers a clean exit so a scheduler can resume the crawl later.
 *
 * @param {{ config: import('../index.js').ResolvedConfig, logger: any, onRateLimitExit: (code: number) => void }} deps
 */
export const createRetryRunner = ({ config, logger, onRateLimitExit }) => {
  const { retry, rateLimit } = config;

  const run = async (fn) => {
    let attempt = 0;

    for (;;) {
      try {
        return await fn();
      } catch (error) {
        const status = error?.response?.status;

        if (status === 429) {
          if (rateLimit.exitOnLimit) {
            logger.warn(`Force exiting with code ${rateLimit.exitCode} (rate limited).`);
            onRateLimitExit(rateLimit.exitCode);
            throw error;
          }

          const wait = computeWait(error.response.headers, rateLimit.fallbackDelay);
          logger.warn(`Rate limited. Waiting ${Math.round(wait / 1000)}s before retrying...`);
          await delay(wait);
          continue; // rate-limit waits never consume the retry budget
        }

        const retriable = status === undefined || retry.statusCodes.includes(status);
        if (retriable && attempt < retry.max) {
          attempt += 1;
          logger.info(`Retry ${attempt}/${retry.max} -> ${error.message}`);
          if (retry.delay > 0) await delay(retry.delay);
          continue;
        }

        throw error;
      }
    }
  };

  return { run };
};
