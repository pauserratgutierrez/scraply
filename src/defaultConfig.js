export const DEFAULT_CONFIG = {
  MAIN_DIR: 'dataset',

  CRAWLER: {
    INITIAL_URLS: [
      'https://crawler-test.com/'
    ],
    INCLUDE_URLS: [
      'https://crawler-test.com/'
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
      'button',
      '[aria-modal]',
      '[role="dialog"]',
      '[role="alert"]',
      '[role="banner"]',
      '[role="form"]',
      '[role="navigation"]',
      '[role="search"]'
    ],
    DYNAMIC_CRAWLING: false,
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
};
