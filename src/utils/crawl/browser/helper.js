import { Cluster } from 'puppeteer-cluster';
import { delay } from '../delay.js';

let cluster;
let initializing = false;

export const initializeCluster = async () => {
  if (!cluster && !initializing) {
    initializing = true;
    console.log('Initializing Puppeteer cluster...');
    cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: 3, // Lower concurrency for stability
      puppeteerOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          // '--single-process',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-hang-monitor',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-software-rasterizer',
          '--no-zygote',
          '--disable-infobars',
          '--disable-blink-features=AutomationControlled',
          '--disable-component-extensions-with-background-pages',
          '--mute-audio',
          '--window-size=1280,800', // Moderate window size
          '--window-position=0,0',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-skip-list',
          '--hide-scrollbars',
          '--disable-notifications',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb'
        ],
        timeout: 30000
      }
    });

    cluster.task(async ({ page, data: { url, selector } }) => {
      let statusCode;
      try {
        page.on('response', response => {
          if (response.url() === url) statusCode = response.status();
        });

        await page.goto(url, { timeout: 30000, waitUntil: 'networkidle2' }); // Possible values: load, domcontentloaded, networkidle0, networkidle2
        await page.waitForSelector(selector, { timeout: 10000 });
        const content = await page.content();
        return { content, statusCode };
      } catch (error) {
        console.error(`Error in cluster task for URL ${url}:`, error);
        throw error;
      } finally {
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.error('Error closing page:', closeError);
          }
        }
      }
    });

    console.log('Puppeteer cluster initialized!');
    initializing = false;
  } else if (initializing) {
    console.log('Cluster is already being initialized, waiting...');
    while (initializing) {
      await delay(100); // Wait for initialization to complete
    }
  }

  return cluster;
};

export const fetchPageContent = async (url, selector) => {
  if (!cluster) await initializeCluster();
  try {
    const result = await cluster.execute({ url, selector }); // Returns the page content
    return result;
  } catch (error) {
    console.error(`Error fetching page content for URL ${url}:`, error);
    throw {
      response: { status: error.statusCode, statusText: error.message }
    };
  }
};

export const closeCluster = async () => {
  if (cluster) {
    console.log('Closing Puppeteer cluster...');
    await cluster.idle();
    await cluster.close();
    cluster = null;
    console.log('Puppeteer cluster closed!');
  }
};

// Handle app termination
const handleAppTermination = async () => {
  await closeCluster();
  process.exit(0);
};

process.on('SIGINT', handleAppTermination);
process.on('SIGTERM', handleAppTermination);