import { delay } from '../delay.js';
import { cleanHTML } from '../cleanHTML.js';
import * as cheerio from 'cheerio';
import { shouldRetry, enqueueURLs } from './handlers.js';
import { fetchURL } from './fetch.js';
import { saveDataset, saveQueue } from '../fileOperations.js';

export const processURL = async (entry, fileNumber, urlData) => {
  const startTime = new Date().getTime();
  const { url, depth } = entry;

  if (entry.file || (entry.error && !(await shouldRetry({ response: { status: entry.status } })))) return;
  
  console.log(`- ${fileNumber}/${urlData.length} -> ${entry.url}`);

  try {
    const result = await fetchURL(url, CONFIG.CRAWLER.MAX_RETRIES);
    if (result && result.data) {
      const { data: html, status } = result;
      const $ = cheerio.load(html);
      enqueueURLs(urlData, $, url, depth + 1);

      const content = cleanHTML($);
      const filename = saveDataset({ url, content }, fileNumber);

      entry.file = filename;
      entry.status = status;
      entry.error = null;

      return filename; // Return the filename of the saved dataset
    } else {
      entry.error = result.error;
      entry.status = result.status;
    }
  } catch (error) {
    entry.error = error.message;
    entry.status = null;
  } finally {
    // Save the queue state whether successful or not
    saveQueue(urlData);

    const endTime = new Date().getTime();
    const elapsedTime = endTime - startTime;

    // Apply delay if necessary
    if (CONFIG.CRAWLER.CRAWL_DELAY_MS > 0 && elapsedTime < CONFIG.CRAWLER.CRAWL_DELAY_MS) {
      await delay(CONFIG.CRAWLER.CRAWL_DELAY_MS - elapsedTime);
    }
  }

  return null; // Return null if no file was generated
};
