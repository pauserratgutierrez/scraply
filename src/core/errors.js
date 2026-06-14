/**
 * Thrown when a host rate-limits the crawl (HTTP 429) and
 * `rateLimit.exitOnLimit` is true. Instead of killing the host process, Scraply
 * aborts the current crawl with this error so the caller can decide what to do
 * (e.g. exit with `error.code` from a CLI, or schedule a later resume — the
 * persistent queue means crawling continues where it stopped).
 */
export class RateLimitError extends Error {
  /**
   * @param {string} [message]
   * @param {{ code?: number, headers?: Record<string, string>, cause?: unknown }} [options]
   */
  constructor(message = 'Rate limited', { code = 10, headers = {}, cause } = {}) {
    super(message);
    this.name = 'RateLimitError';
    this.code = code;
    this.headers = headers;
    // Mirror the shape fetchers attach so existing `error.response.status`
    // checks keep working.
    this.response = { status: 429, headers };
    if (cause !== undefined) this.cause = cause;
  }
}
