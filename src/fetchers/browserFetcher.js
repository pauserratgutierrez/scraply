import { Cluster } from 'puppeteer-cluster';

const BLOCKED_RESOURCES = new Set(['image', 'stylesheet', 'font', 'media']);

/**
 * Puppeteer-cluster backend for JavaScript-rendered pages. `page.goto` already
 * follows redirects and returns the final response, so no manual redirect
 * handling is needed.
 *
 * @param {import('./types.js').FetcherDeps} deps
 * @returns {import('./types.js').Fetcher}
 */
export const createBrowserFetcher = ({ config, logger }) => {
  const { request, crawl } = config;
  const timeout = Math.max(request.timeout, 5000);
  let cluster = null;

  const init = async () => {
    if (cluster) return;

    logger.info('Initializing Puppeteer cluster...');
    cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: Math.max(crawl.concurrency, 1),
      puppeteerOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        timeout
      }
    });

    await cluster.task(async ({ page, data: url }) => {
      await page.setUserAgent(request.userAgent);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (BLOCKED_RESOURCES.has(req.resourceType())) req.abort();
        else req.continue();
      });

      const response = await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
      const data = await page.content();

      return {
        data,
        status: response ? response.status() : 0,
        headers: response ? response.headers() : {}
      };
    });

    logger.info('Puppeteer cluster initialized!');
  };

  return {
    name: 'browser',
    init,
    async fetch(url) {
      if (!cluster) await init();
      const result = await cluster.execute(url);

      if (result.status < 200 || result.status >= 400) {
        throw Object.assign(new Error(`Invalid status code: ${result.status}`), {
          response: { status: result.status, headers: result.headers }
        });
      }

      return result;
    },
    async close() {
      if (!cluster) return;
      logger.info('Closing Puppeteer cluster...');
      await cluster.idle();
      await cluster.close();
      cluster = null;
      logger.info('Puppeteer cluster closed!');
    }
  };
};
