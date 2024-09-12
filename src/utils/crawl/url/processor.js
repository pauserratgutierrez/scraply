import { delay } from '../delay.js';
import { cleanHTML } from '../cleanHTML.js';

import * as cheerio from 'cheerio';
import { shouldRetry, enqueueURLs } from './handlers.js';
import { fetchURL } from './fetch.js';
import { saveDataset, saveQueue } from '../fileOperations.js';

export const processURL = async (entry, fileNumber, urlData, urlMetadata) => {
  if (entry.file || (entry.error && !shouldRetry({ response: { status: entry.status } }))) return;

  console.log(`- ${fileNumber}/${urlData.length} -> ${entry.url}`);

  const { url } = entry;
  const { referrer, depth } = urlMetadata[url] || { referrer: null, depth: 0 }; // Default depth is 0.
  
  const startTime = new Date().getTime();
  try {
    const result = await fetchURL(url, CONFIG.CRAWLER.MAX_RETRIES);
    if (result && result.data) {
      const { data: html, status } = result;
      const $ = cheerio.load(html);
      enqueueURLs(urlData, urlMetadata, $, url, url, depth + 1);
      const content = cleanHTML($);
      const filename = saveDataset({ url, referrerURL: referrer, statusCode: status, depth, content }, fileNumber);
      entry.file = filename;
      entry.status = status;
      entry.error = null;
    } else {
      entry.error = result.error;
      entry.status = result.status;
    }
  } catch (error) {
    entry.error = error.message;
    entry.status = null;
  }

  saveQueue(urlData);

  const endTime = new Date().getTime();
  const elapsedTime = endTime - startTime;

  if (CONFIG.CRAWLER.CRAWL_DELAY_MS > 0 && elapsedTime < CONFIG.CRAWLER.CRAWL_DELAY_MS) await delay(CONFIG.CRAWLER.CRAWL_DELAY_MS - elapsedTime);
};
