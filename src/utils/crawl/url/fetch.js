import axios from 'axios';
import { delay } from '../delay.js';
import { shouldRetry } from './handlers.js';
import { fetchPageContent } from '../browser/helper.js';
// import { normalizeURL } from './normalize.js';

export async function fetchURL(url, retries = 2) {
  try {
    let response;
    
    if (CONFIG.CRAWLER.DYNAMIC_CRAWLING) { // JavaScript Dynamic Content
      response = await fetchPageContent(url, 'body'); // Returns a custom object with content, headers and status, similar to axios

      // Manually handle redirects (Puppeter doesn't follow them, axios does automatically)
      if (response.status >= 300 && response.status < 400) { // 3xx Redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          if (CONFIG.CRAWLER.MAX_REDIRECTS <= 0) {
            const error = new Error(`Max redirects reached`);
            error.response = { status: response.status, headers: response.headers, data: response.data };
            throw error;
          }
          // Normalize URL ?
          const newUrl = new URL(redirectUrl, url).href;
          return fetchURL(newUrl, retries - 1);
        }
      }

      // Validate status code (Puppeteer doesn't throw, axios does automatically)
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(`Invalid status code: ${response.status}`);
        error.response = { status: response.status, headers: response.headers, data: response.data };
        throw error;
      }
    } else { // Static Content
      response = await axios.get(url, {
        timeout: CONFIG.CRAWLER.REQUEST_TIMEOUT,
        maxRedirects: CONFIG.CRAWLER.MAX_REDIRECTS,
        maxContentLength: CONFIG.CRAWLER.MAX_CONTENT_LENGTH
      });
    }

    // Validate content type header
    const { 'content-type': contentType } = response.headers;
    if (!contentType) return { error: `Missing Content-Type header`, status: response.status };
    if (!CONFIG.CRAWLER.ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type))) return { error: `Content-Type ${contentType} is not allowed.`, status: response.status };

    return { data: response.data, status: response.status };
  } catch (error) {
    if (retries > 0 && (await shouldRetry(error))) {
      const retryCount = CONFIG.CRAWLER.MAX_RETRIES - retries + 1;
      console.log(`Retrying (${retryCount}/${CONFIG.CRAWLER.MAX_RETRIES}) -> ${url}`);
      if (CONFIG.CRAWLER.CRAWL_ERROR_RETRY_DELAY_MS > 0) await delay(CONFIG.CRAWLER.CRAWL_ERROR_RETRY_DELAY_MS);      
      return fetchURL(url, retries - 1);
    }

    // If still 429 after retries, exit with configured code
    if (error.response?.status === 429) {
      console.log(`Force exiting with code ${CONFIG.CRAWLER.EXIT_CODE_RATE_LIMIT} (after retries)...`);
      process.exit(CONFIG.CRAWLER.EXIT_CODE_RATE_LIMIT);
    }
    
    console.error(`Failed to fetch ${url} -> ${error.message}`);
    return { error: error.message, status: error.response?.status };
  };
};
