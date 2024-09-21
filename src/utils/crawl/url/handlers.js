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
    const urlObj = new URL(url);

    // Check if the URL matches any include pattern
    const isIncluded = CONFIG.CRAWLER.INCLUDE_URLS.some(pattern => {
      if (typeof pattern === 'string') {
        return urlObj.toString().includes(pattern); // Check if the URL contains the string pattern
      } else if (pattern instanceof RegExp) {
        return pattern.test(urlObj.toString()); // Check if the URL matches the RegExp pattern
      }
    });

    if (!isIncluded) return false; // This URL is not included

    // Check if the URL matches any exclude pattern
    const isExcluded = CONFIG.CRAWLER.EXCLUDE_PATTERNS.some(pattern => {
      if (typeof pattern === 'string') {
        return urlObj.pathname.includes(pattern); // Check if the URL pathname contains the string pattern
      } else if (pattern instanceof RegExp) {
        return pattern.test(urlObj.pathname); // Check if the URL pathname matches the RegExp pattern
      }
    });

    return !isExcluded; // This URL is included and not excluded
  } catch (error) {
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
