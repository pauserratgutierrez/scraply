import { URL } from 'node:url';
import { normalizeURL } from './normalize.js';

// Handle HTML Status Codes HERE!
export const shouldRetry = (error) => {
  if (!error.response) return true;
  if (error.response.status === 429) {
    const waitTime = error.response.headers ? error.response.headers['retry-after'] : null;
    if (waitTime) {
      console.log(`Rate limited for ${waitTime} seconds, exiting Crawler...`);
    } else {
      console.log(`Rate limited, no retry-after header found, exiting Crawler...`);
    }
    process.exit(10); // GitHub Actions Docker uses values ranged from 0 to 255, so any bigger value will be % 256!
  }
  return CONFIG.CRAWLER.RETRY_STATUS_CODES.includes(error.response.status); // Retry only on specific status codes
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

export const enqueueURLs = (urlData, urlMetadata, $, baseURL, referrer, depth) => {
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      const newURL = new URL(href, baseURL).toString();
      const normalizedURL = normalizeURL(newURL);
      if (shouldIncludeURL(normalizedURL) && !urlData.some(entry => entry.url === normalizedURL)) {
        urlData.push({ url: normalizedURL, file: null, status: null, error: null });
        urlMetadata[normalizedURL] = { referrer, depth };
      }
    } catch (error) {
      console.error(`Failed to enqueue URL: ${href} from ${baseURL}: ${error.message}`);
    }
  });
};
