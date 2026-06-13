/** @type {readonly ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']} */
export const BROWSER_WAIT_UNTIL = Object.freeze([
  'load',
  'domcontentloaded',
  'networkidle0',
  'networkidle2'
]);

/** Puppeteer resource types Scraply may block to speed up browser fetches. */
export const BROWSER_BLOCKABLE_RESOURCES = Object.freeze(['image', 'stylesheet', 'font', 'media']);

/** Default blocked types. Stylesheets are excluded — many SPAs need CSS before content renders. */
export const DEFAULT_BROWSER_BLOCK_RESOURCES = Object.freeze(['image', 'font', 'media']);

/**
 * @param {import('../index.js').BrowserConfig} browser
 */
export const assertBrowserConfig = (browser) => {
  if (!BROWSER_WAIT_UNTIL.includes(browser?.waitUntil)) {
    throw new Error(
      `Invalid browser.waitUntil: ${String(browser?.waitUntil)}. Expected one of: ${BROWSER_WAIT_UNTIL.join(', ')}`
    );
  }

  const blockResources = browser?.blockResources;
  if (!Array.isArray(blockResources)) {
    throw new Error('Invalid browser.blockResources: expected an array.');
  }

  for (const type of blockResources) {
    if (!BROWSER_BLOCKABLE_RESOURCES.includes(type)) {
      throw new Error(
        `Invalid browser.blockResources entry: ${String(type)}. Expected one of: ${BROWSER_BLOCKABLE_RESOURCES.join(', ')}`
      );
    }
  }
};
