import { URL } from 'node:url';
import { normalizeURL } from './normalize.js';
import { delay } from '../delay.js';

// Handle HTML Status Codes HERE!
export const shouldRetry = async (error) => {
  if (!error.response) return true;

  const { status, headers } = error.response;
  const retryAfter = headers?.['retry-after'];
  const rateLimitReset = headers?.['x-ratelimit-reset'];

  if (status === 429) {
    let waitTime = null;

    if (retryAfter) {
      waitTime = isNaN(retryAfter)
        ? Math.ceil((new Date(retryAfter).getTime() - Date.now()) / 1000) // HTTP date
        : parseInt(retryAfter, 10); // Seconds
      console.log(`Rate limited. Retrying after ${waitTime} seconds...`);
    } else if (rateLimitReset) {
      waitTime = Math.max(parseInt(rateLimitReset, 10) - Math.floow(Date.now() / 1000), 0);
      console.log(`Rate limited. Retrying after ${waitTime} seconds...`);
    } else {
      waitTime = CONFIG.CRAWLER.CRAWL_RATE_LIMIT_FALLBACK_DELAY_MS / 1000;
      console.log(`Rate limited. No 'retry-after' or 'x-ratelimit-reset' headers found. Falling back to ${waitTime} seconds...`);
    }

    if (CONFIG.CRAWLER.EXIT_ON_RATE_LIMIT) {
      console.log(`Exiting due to rate limit.`);
      process.exit(CONFIG.CRAWLER.EXIT_CODE_RATE_LIMIT); // GitHub Actions Docker uses values ranged from 0 to 255, so any bigger value will be % 256!
    } else {
      await delay(waitTime * 1000);
    }
  }

  return CONFIG.CRAWLER.RETRY_STATUS_CODES.includes(status); // Retry on the specified status codes
};

const shouldIncludeURL = (url) => {
  try {
    const { INITIAL_URLS, INCLUDE_URLS, EXCLUDE_PATTERNS } = CONFIG.CRAWLER;

    if (INITIAL_URLS.includes(url)) return true;

    // Pre-compile string patterns into regular expressions for both include and exclude patterns
    const compiledExcludePatterns = EXCLUDE_PATTERNS.map(pattern => 
      typeof pattern === 'string' ? new RegExp(pattern) : pattern
    );
    const compiledIncludePatterns = INCLUDE_URLS.map(pattern => 
      typeof pattern === 'string' ? new RegExp(pattern) : pattern
    );

    if (compiledExcludePatterns.some(pattern => pattern.test(url))) return false;
    if (compiledIncludePatterns.some(pattern => pattern.test(url))) return true;

    return false; // If the URL doesn't match any include patterns, exclude it.
  } catch (error) {
    console.error(`Error processing URL: ${url}`, error);
    return false;
  }
};

export const enqueueURLs = (urlData, $, baseURL, depth) => {
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      const newURL = new URL(href, baseURL).toString();
      const normalizedURL = normalizeURL(newURL);
      if (shouldIncludeURL(normalizedURL) && !urlData.some(entry => entry.url === normalizedURL)) {
        urlData.push({ url: normalizedURL, file: null, status: null, error: null, referrerUrl: baseURL, depth });
      }
    } catch (error) {
      console.error(`Failed to enqueue URL: ${href} from ${baseURL}: ${error.message}`);
    }
  });
};
