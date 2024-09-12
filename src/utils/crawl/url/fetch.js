import axios from 'axios';
import { delay } from '../delay.js';
import { shouldRetry } from './handlers.js';

export const fetchURL = async (url, retries = 2) => {
  try {
    const response = await axios.get(url, { timeout: CONFIG.CRAWLER.REQUEST_TIMEOUT, maxRedirects: CONFIG.CRAWLER.MAX_REDIRECTS });
    const contentType = response.headers['content-type'];

    if (!CONFIG.CRAWLER.ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type))) {
      return { error: `Content-Type ${contentType} is not allowed.`, status: response.status };
    };

    return { data: response.data, status: response.status };
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      console.log(`Retrying (${CONFIG.CRAWLER.MAX_RETRIES - retries + 1}/${CONFIG.CRAWLER.MAX_RETRIES}) -> ${url}`);
      if (CONFIG.CRAWLER.CRAWL_ERROR_RETRY_DELAY_MS > 0) await delay(CONFIG.CRAWLER.CRAWL_ERROR_RETRY_DELAY_MS);
      return fetchURL(url, retries - 1);
    } else {
      console.error(`Failed to fetch ${url} -> ${error.message}`);
      return { error: error.message, status: error.response ? error.response.status : null };
    };
  };
};
