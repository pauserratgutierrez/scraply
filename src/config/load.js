import path from 'node:path';
import { DEFAULT_CONFIG } from './defaults.js';
import { assertBrowserConfig } from './browser.js';
import { normalizeUrl } from '../url/normalize.js';

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
 * Resolves a list field that may be a plain array (replaces the default) or a
 * directive object: `{ replace }`, `{ extend }`/`{ append }`, `{ prepend }`.
 * Directives are combined with the package defaults so users can add to a list
 * (e.g. `removeSelectors`) without losing Scraply's built-ins.
 */
const resolveList = (value, defaults) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.replace)) return value.replace;
    const prepend = Array.isArray(value.prepend) ? value.prepend : [];
    const append = Array.isArray(value.extend)
      ? value.extend
      : Array.isArray(value.append)
        ? value.append
        : [];
    return [...prepend, ...defaults, ...append];
  }
  return defaults;
};

/**
 * Merges a user config over the defaults and derives the storage paths.
 * @param {import('../index.js').ScraplyConfig} [userConfig]
 * @returns {import('../index.js').ResolvedConfig}
 */
export const loadConfig = (userConfig = {}) => {
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  // List fields accept { extend } / { prepend } / { replace } directives so a
  // user can add to Scraply's defaults instead of replacing them wholesale.
  config.exclude = resolveList(config.exclude, DEFAULT_CONFIG.exclude);
  config.include = resolveList(config.include, []);
  config.allowedContentTypes = resolveList(config.allowedContentTypes, DEFAULT_CONFIG.allowedContentTypes);
  config.extract.removeSelectors = resolveList(config.extract.removeSelectors, DEFAULT_CONFIG.extract.removeSelectors);
  config.output.exclude = resolveList(config.output.exclude, DEFAULT_CONFIG.output.exclude);

  // Normalize per-site overrides: `match` becomes an array of patterns, and a
  // site's `extract.removeSelectors` honors the same { extend } / { replace }
  // directives — resolved against the (already-resolved) top-level list, so a
  // site can add to the base instead of silently passing an object downstream.
  config.sites = (config.sites ?? []).map((site) => {
    const normalized = {
      ...site,
      match: Array.isArray(site.match) ? site.match : [site.match]
    };

    if (normalized.extract?.removeSelectors !== undefined) {
      normalized.extract = {
        ...normalized.extract,
        removeSelectors: resolveList(normalized.extract.removeSelectors, config.extract.removeSelectors)
      };
    }

    return normalized;
  });

  const { dir } = config.storage;
  config.storage.queuePath = path.posix.join(dir, 'queue.json');
  config.storage.crawledDir = path.posix.join(dir, 'crawled');
  config.storage.formattedDir = path.posix.join(dir, 'formatted');

  // When no include rules are given, fall back to the start URLs — normalized so
  // they match the normalized links the crawler actually discovers (forced
  // HTTPS, no "www.", no trailing slash).
  if (!config.include?.length) {
    config.include = config.startUrls.map(normalizeUrl);
  }

  assertBrowserConfig(config.browser);

  return config;
};
