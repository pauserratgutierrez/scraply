export const DEFAULT_CONFIG = {
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
    RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504],
    REQUEST_TIMEOUT: 4000,
    MAX_REDIRECTS: 3,
    MAX_RETRIES: 2,
    CRAWL_DELAY_MS: 200,
    CRAWL_ERROR_RETRY_DELAY_MS: 800,
  },

  DATA_FORMATTER: {
    EXCLUDED_PATTERNS: [],
    CATEGORISED_PATHS: {
      'https://crawler-test.com': {
        'mobile': 'mobile.json',
        '*': 'general.json'
      },
    },
    HARD_CODED_LINKS: [
      // {
      //   file_name: 'hc-links.json',
      //   data: [
      //     {
      //       "url": "https://custom-link.com",
      //       "content": "That's a custom link content, you can add as many as you want."
      //     },
      //   ]
      // }
    ]
  }
};
