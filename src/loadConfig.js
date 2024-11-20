import path from 'node:path';
import { DEFAULT_CONFIG } from './defaultConfig.js';

// A utility function to perform a deep merge of objects
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  return { ...target, ...source };
};

export function loadConfig(userConfig = {}) {
  // Merge the user config with the default config
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  // Dynamically construct paths using MAIN_DIR
  config.CRAWLER.QUEUE_PATH = path.posix.join(config.MAIN_DIR, 'queue.json');
  config.CRAWLER.CRAWLED_PATH = path.posix.join(config.MAIN_DIR, 'crawled');
  config.DATA_FORMATTER.FORMATTED_PATH = path.posix.join(config.MAIN_DIR, 'formatted');
  config.DATA_FORMATTER.ERROR_REPORT_PATH = path.posix.join(config.MAIN_DIR, 'error-report.json');

  // If INCLUDE_URLS is not specified, set it to INITIAL_URLS by default
  if (!config.CRAWLER.INCLUDE_URLS || config.CRAWLER.INCLUDE_URLS.length === 0) {
    config.CRAWLER.INCLUDE_URLS = config.CRAWLER.INITIAL_URLS.map(url => `${url}.*`);
  }

  // If HARD_CODED_LINKS is missing, set to an empty array by default
  if (!config.DATA_FORMATTER.HARD_CODED_LINKS) {
    config.DATA_FORMATTER.HARD_CODED_LINKS = [];
  }

  return config;
};
