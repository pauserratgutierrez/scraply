import axios from 'axios';
import { delay } from '../delay.js';
import { shouldRetry } from './handlers.js';

export async function fetchURL(url, retries = 2) {
  try {
    const response = await axios.get(url, {
      timeout: CONFIG.CRAWLER.REQUEST_TIMEOUT,
      maxRedirects: CONFIG.CRAWLER.MAX_REDIRECTS
    });

    const { 'content-type': contentType } = response.headers;

    // Validate content type
    if (!CONFIG.CRAWLER.ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type))) {
      return {
        error: `Content-Type ${contentType} is not allowed.`,
        status: response.status
      };
    };

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
      console.log(`Force exiting with code ${CONFIG.CRAWLER.EXIT_CODE_RATE_LIMIT} after retries...`);
      process.exit(CONFIG.CRAWLER.EXIT_CODE_RATE_LIMIT);
    }
    
    console.error(`Failed to fetch ${url} -> ${error.message}`);
    return { error: error.message, status: error.response?.status };
  };
};
