import { loadConfig } from './loadConfig.js';
import { normalizeURL } from './utils/crawl/url/normalize.js';
import { loadJSON, saveQueue, deleteDataFiles, deleteUntrackedFiles } from './utils/crawl/fileOperations.js';
import { processURL } from './utils/crawl/url/processor.js';
import { formatData, saveSortedFormattedJSON } from './utils/format/formatData.js';
import { initializeCluster, closeCluster } from './utils/crawl/browser/helper.js';

let urlData = [];
let CONFIG = {};
let generatedFiles = new Set(); // Track files generated in the current crawl session.

const init = () => {
  urlData = loadJSON(CONFIG.CRAWLER.QUEUE_PATH);

  if (urlData.length === 0) { // If the queue is empty, start fresh with the initial URLs.
    console.log(`Starting fresh! No URLs found in ${CONFIG.CRAWLER.QUEUE_PATH}\n`);
  
    CONFIG.CRAWLER.INITIAL_URLS.forEach(url => {
      const normalizedURL = normalizeURL(url);
      urlData.push({ url: normalizedURL, file: null, status: null, error: null, referrerUrl: null, depth: 0 });
    });
    saveQueue(urlData);
  } else { // If the queue is not empty
    const allProcessed = urlData.every(entry => entry.file !== null || entry.error !== null);
    if (allProcessed) { // If all URLs have been processed
      console.log(`All URLs in ${CONFIG.CRAWLER.QUEUE_PATH} have been processed. Deleting persistent storage and starting a fresh Crawl...\n`);

      // Reset data for a fresh crawl.
      urlData = [];

      // Delete everything except CONFIG.DATA_FORMATTER.FORMATTED_PATH, so that the formatted data is always preserved until the crawler really finalizes the data.
      deleteDataFiles(CONFIG.CRAWLER.QUEUE_PATH);
      deleteDataFiles(CONFIG.CRAWLER.CRAWLED_PATH);

      init();
    } else { // If there are URLs that haven't been processed yet, resume from the queue.
      console.log(`Resuming from ${CONFIG.CRAWLER.QUEUE_PATH} with ${urlData.length} total found URLs\n`);
    }
  }
};

const start = async () => {
  console.log(`STARTING SCRAPLY CRAWLER...
  - Initial URLs: ${CONFIG.CRAWLER.INITIAL_URLS}
  - Include URLs: ${CONFIG.CRAWLER.INCLUDE_URLS}
  - Excluded Patterns: ${CONFIG.CRAWLER.EXCLUDE_PATTERNS}
  - Allowed Content Types: ${CONFIG.CRAWLER.ALLOWED_CONTENT_TYPES}
  - Retry Status Codes: ${CONFIG.CRAWLER.RETRY_STATUS_CODES}
  - Request Timeout: ${CONFIG.CRAWLER.REQUEST_TIMEOUT}
  - Max Redirects: ${CONFIG.CRAWLER.MAX_REDIRECTS}
  - Max Retries: ${CONFIG.CRAWLER.MAX_RETRIES}
  - Crawl Delay: ${CONFIG.CRAWLER.CRAWL_DELAY_MS}ms
  - Crawl Error Retry Delay: ${CONFIG.CRAWLER.CRAWL_ERROR_RETRY_DELAY_MS}ms
  `);

  if (CONFIG.CRAWLER.DYNAMIC_CRAWLING) {
    await initializeCluster();
  }

  let fileNumber = urlData.filter(entry => entry.file).length + 1;
  for await (const entry of urlData) {
    if (!entry.file) {
      const processedFile = await processURL(entry, fileNumber, urlData);
      if (processedFile) {
        generatedFiles.add(processedFile); // Track the file generated
      }
      fileNumber++;
    }
  }

  const totalUrls = urlData.length;
  const crawledUrls = urlData.filter(entry => entry.file !== null).length;
  const notCrawledUrls = totalUrls - crawledUrls;
  const errorUrls = urlData.filter(entry => entry.error !== null);

  console.log(`\nCRAWLING COMPLETED! ${crawledUrls} of ${totalUrls} (${notCrawledUrls} not crawled, ${errorUrls.length} errors)`);

  // Iterate over all the urlData and save all the url & content to files, categorized by CONFIG.DATA_FORMATTER.CATEGORISED_PATHS. Exclude the URLs that match the patterns in CONFIG.DATA_FORMATTER.EXCLUDED_PATTERNS. Save in CONFIG.DATA_FORMATTER.FORMATTED_PATH.
  console.log(`\nFORMATTING DATA...`);
  const dataToSave = {};

  for await (const entry of urlData) {
    const savePath = formatData(entry);
    if (savePath) { // If the URL should be saved.
      if (!dataToSave[savePath]) dataToSave[savePath] = [];

      // Load content from the file referenced by entry.file
      let content = null;
      try {
        content = loadJSON(entry.file);
        dataToSave[savePath].push({ url: entry.url, content: content.content });
      } catch (e) {
        console.error(`Error loading content from ${entry.file}: ${e.message}`);
      }
    }
  };

  // Save the data to files.
  let totalSavedURLs = 0;
  for (const [savePath, data] of Object.entries(dataToSave)) {
    totalSavedURLs += data.length;
    console.log(`${data.length} -> ${savePath}`);
    saveSortedFormattedJSON(savePath, data);
    generatedFiles.add(savePath); // Track the file saved
  };
  console.log(`${totalSavedURLs} total saved URLs to ${CONFIG.DATA_FORMATTER.FORMATTED_PATH}`);

  // After formatting data, delete untracked files
  console.log(`\nCLEANING UP UNTRACKED FILES...`);
  deleteUntrackedFiles(CONFIG.DATA_FORMATTER.FORMATTED_PATH, generatedFiles); // Delete files not generated during this crawl
  generatedFiles.clear(); // Clear the set to prepare for future crawls

  if (CONFIG.CRAWLER.DYNAMIC_CRAWLING) {
    await closeCluster();
  }
};

// Main function to be exported and used
export const scraply = async (userConfig = {}) => {
  CONFIG = loadConfig(userConfig);
  global.CONFIG = CONFIG;

  init();
  await start();
};
