import path from 'node:path';
import { DEFAULT_CONFIG } from './defaults.js';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof RegExp);

const deepMerge = (target, source) => {
  const merged = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      merged[key] = deepMerge(target[key], value);
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
};

/**
 * Merges a user config over the defaults and derives the storage paths.
 * @param {import('../index.js').ScraplyConfig} [userConfig]
 * @returns {import('../index.js').ResolvedConfig}
 */
export const loadConfig = (userConfig = {}) => {
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  const { dir } = config.storage;
  config.storage.queuePath = path.posix.join(dir, 'queue.json');
  config.storage.crawledDir = path.posix.join(dir, 'crawled');
  config.storage.formattedDir = path.posix.join(dir, 'formatted');

  if (!config.include?.length) {
    config.include = [...config.startUrls];
  }

  return config;
};
