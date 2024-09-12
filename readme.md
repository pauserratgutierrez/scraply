# Scraply
Scraply is a customizable and efficient web crawler and data scraper for Node.js, designed to handle various web crawling needs with ease. You can define the URLs to crawl, configure patterns to include/exclude, and format the output data in JSON. Scraply is built to be flexible, with user-configurable settings and dynamic paths.

Go to Scraply's GitHub for Bugs, Errors and Dev stuff [Scraply's GitHub](https://github.com/pauserratgutierrez/scraply)

# Installation
Using npm:
`npm install scraply`

# Working Example
It's that simple
`
import { scraply } from 'scraply';

scraply({
  CRAWLER: {
    INITIAL_URLS: ['https://example.com']
  }
});
`
This will initialize Scraply with the provided URLs to start crawling.

# How Scraply Works
## Persistent Data Storage
Scraply persistently saves the state of the crawler in JSON files (the queue, crawled data, etc.). If the crawler is interrupted or rate-limited, all progress is saved, and the crawler will automatically stop. When restarted, Scraply resumes crawling exactly where it left off, without reprocessing already crawled URLs.

## Handling Rate Limiting
Scraply is designed to handle rate-limiting gracefully. If the crawler encounters rate-limited responses (e.g., status code `429`), it stops processing further requests and saves everything in the queue. Once restarted, it resumes the crawling process from where it stopped.

This makes Scraply ideal for long-running, continuous crawling tasks. You can integrate Scraply with GitHub Actions or other CI/CD pipelines to perform endless crawling jobs over time. Simply schedule Scraply to run periodically, and it will continue gathering data without duplicating work.

## Integration with GitHub Actions
Scraply can be easily integrated into a GitHub Action workflow for continuous, long-running crawling tasks. You can set it up to crawl for a set duration or number of URLs, persistently saving the progress, and then resuming where it left off on the next run.

# Config Options
Scraply allows you to pass a configuration object to customize the crawling behavior. Below are the main configuration options:
**`MAIN_DIR`**
- **Type:** string
- **Default:** dataset
- **Description:** The main directory where crawled data, queues, and formatted files are saved.
`CRAWLER`
This section controls the behavior of the crawler.

INITIAL_URLS
Type: Array<string>
Default: []
Description: The list of URLs where the crawler will start. These URLs will automatically be included in INCLUDE_URLS if INCLUDE_URLS is not specified.
INCLUDE_URLS
Type: Array<string>
Default: Contains INITIAL_URLS if not specified.
Description: A list of URL patterns (regular expressions) to include in the crawl. If not provided, the crawler will include the INITIAL_URLS with a .* pattern.
EXCLUDE_URLS
Type: Array<string>
Description: URL patterns to exclude from the crawl. These URLs will not be crawled.
ALLOWED_CONTENT_TYPES
Type: Array<string>
Default: ['text/html']
Description: Specifies the content types that the crawler should process. Common values include text/html.
RETRY_STATUS_CODES
Type: Array<number>
Default: [408, 429, 500, 502, 503, 504]
Description: A list of HTTP status codes for which the crawler should retry the request.
REQUEST_TIMEOUT
Type: number
Default: 4000
Description: Timeout for each HTTP request, in milliseconds.
MAX_REDIRECTS
Type: number
Default: 3
Description: The maximum number of redirects to follow during a crawl.
MAX_RETRIES
Type: number
Default: 2
Description: The maximum number of retries for failed requests.
CRAWL_DELAY_MS
Type: number
Default: 200
Description: The delay between each request, in milliseconds.
CRAWL_ERROR_RETRY_DELAY_MS
Type: number
Default: 800
Description: The delay between retrying a failed request, in milliseconds.
DATA_FORMATTER
This section configures how crawled data should be formatted.

FORMATTED_PATH
Type: string
Default: 'dataset/formatted'
Description: The path where formatted data will be saved.
ERROR_REPORT_PATH
Type: string
Default: 'dataset/error-report.json'
Description: The path where error reports will be saved.
CATEGORISED_PATHS
Type: object
Description: Allows you to specify categories for saving data from different URLs. Each URL can be mapped to specific file paths based on patterns.
EXCLUDED_PATTERNS
Type: Array<string>
Default: []
Description: URL patterns to exclude during the formatting phase, independent of the crawler's exclusions.