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
 * @param {{ config: import('../index.js').ResolvedConfig, logger: any, onRateLimitExit: (code: number) => void }} deps
 */
export const createRetryRunner = ({ config, logger, onRateLimitExit }) => {
  const { retry, rateLimit } = config;

  const shouldRetry = async (error) => {
    const status = error?.response?.status;
    if (status === undefined) return true; // network/transport error

    if (status === 429) {
      if (rateLimit.exitOnLimit) return false; // run() handles the exit
      const wait = computeWait(error.response.headers, rateLimit.fallbackDelay);
      logger.warn(`Rate limited. Waiting ${Math.round(wait / 1000)}s before retrying...`);
      await delay(wait);
      return true;
    }

    return retry.statusCodes.includes(status);
  };

  const run = async (fn) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const canRetry = attempt < retry.max && (await shouldRetry(error));
        if (canRetry) {
          logger.info(`Retry ${attempt + 1}/${retry.max} -> ${error.message}`);
          if (retry.delay > 0) await delay(retry.delay);
          continue;
        }

        if (error?.response?.status === 429) {
          logger.warn(`Force exiting with code ${rateLimit.exitCode} (rate limited).`);
          onRateLimitExit(rateLimit.exitCode);
        }
        throw error;
      }
    }
  };

  return { run, shouldRetry };
};
