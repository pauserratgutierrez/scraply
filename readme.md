# Scraply
Scraply is a customizable and efficient web crawler and data scraper for Node.js, designed to handle various web crawling needs with ease. You can define the URLs to crawl, configure patterns to include/exclude, and format the output data in JSON. Scraply is built to be flexible, with user-configurable settings and dynamic paths.

Bug Reports & Dev Stuff on: [Scraply's GitHub](https://github.com/pauserratgutierrez/scraply)
NPM Package: [Scraply's NPM](https://www.npmjs.com/package/scraply)

## Installation
Using npm:
``npm install scraply``

## Working Example
Initialize Scraply with provided URLs to start crawling:
```
import { scraply } from 'scraply';
scraply({
  CRAWLER: {
    INITIAL_URLS: ['https://example.com']
  }
});
```

## How Scraply Works
### Persistent Data Storage
Scraply persistently saves the state of the crawler in JSON files (the queue, crawled data, etc.). If the crawler is interrupted or rate-limited, all progress is saved, and the crawler will automatically stop. When restarted, Scraply resumes crawling exactly where it left off, without reprocessing already crawled URLs.

### Handling Rate Limiting
Scraply is designed to handle rate-limiting gracefully. If the crawler encounters rate-limited responses (e.g., status code `429`), it stops processing further requests and saves everything in the queue. Once restarted, it resumes the crawling process from where it stopped.

This makes Scraply ideal for long-running, continuous crawling tasks. You can integrate Scraply with GitHub Actions or other CI/CD pipelines to perform endless crawling jobs over time. Simply schedule Scraply to run periodically, and it will continue gathering data without duplicating work.

### Integration with GitHub Actions
Scraply can be easily integrated into a GitHub Action workflow for continuous, long-running crawling tasks. You can set it up to crawl for a set duration or number of URLs, persistently saving the progress, and then resuming where it left off on the next run.

## Config Options
Scraply allows you to pass a configuration object to the main ```scraply()``` function to customize the crawling behavior. Below are the current configuration options:
```
MAIN_DIR: 'dataset',

CRAWLER: {
  INITIAL_URLS: [
    'https://crawler-test.com/'
  ],
  INCLUDE_URLS: [
    'https://crawler-test.com/.*'
  ],
  ALLOWED_CONTENT_TYPES: [
    'text/html'
  ],
  EXCLUDE_PATTERNS: [
    '/cdn-cgi/',
    /\.(zip|rar|webp|png|jpg|jpeg|gif|mp3|mp4|pdf|css|js|svg|ico|eot|ttf|woff|woff2|otf|webm|ogg|wav|flac|m4a|mkv|mov|avi|wmv|flv|swf|exe|msi|dmg|iso|bin)$/,
  ],
  DOM_ELEMENTS_REMOVE: [
    'script',
    'noscript',
    'style',
    'meta',
    'link',
    'svg',
    'path',
    'img',
    'input',
    'textarea',
    'embed',
    'object',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    'button'
  ],
  RETRY_STATUS_CODES: [408, 500, 502, 503, 504],
  REQUEST_TIMEOUT: 3000,
  MAX_REDIRECTS: 2,
  MAX_CONTENT_LENGTH: 20 * 1024 * 1024, // 20MB
  MAX_RETRIES: 1,
  CRAWL_DELAY_MS: 200,
  CRAWL_ERROR_RETRY_DELAY_MS: 1000,
  CRAWL_RATE_LIMIT_FALLBACK_DELAY_MS: 60000,
  EXIT_ON_RATE_LIMIT: true, // If true, forces exit instantly. If false, only exits after retries (if still 429)
  EXIT_CODE_RATE_LIMIT: 10
},

DATA_FORMATTER: {
  EXCLUDED_PATTERNS: [],
  CATEGORISED_PATHS: {
    'https://crawler-test.com': {
      'mobile': 'mobile.json',
      '*': 'general.json'
    },
  }
}
```