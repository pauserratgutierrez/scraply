import fs from 'node:fs';
import path from 'node:path';

export const formatData = (entry) => {
  if (entry.file && entry.error === null) {
    try {
      const url = new URL(entry.url);
      const pathname = url.pathname;
      const isExcluded = CONFIG.DATA_FORMATTER.EXCLUDED_PATTERNS.some(pattern => new RegExp(pattern).test(entry.url));
  
      if (!isExcluded) {
        const pathSegments = pathname.split('/').filter(Boolean); // filter out empty segments
        const categorisedPaths = CONFIG.DATA_FORMATTER.CATEGORISED_PATHS[url.origin];

        if (categorisedPaths) {
          // Try to match the full path segments, reducing specificity step by step
          let categorisedPath = null;

          for (let i = pathSegments.length; i >= 1; i--) {
            const pathKey = pathSegments.slice(0, i).join('/');
            categorisedPath = categorisedPaths[pathKey];
            if (categorisedPath) break;
          }

          // Fallback to wildcard match ('*') if no specific path is found
          if (!categorisedPath) categorisedPath = categorisedPaths['*'];
          if (categorisedPath) return path.join(CONFIG.DATA_FORMATTER.FORMATTED_PATH, categorisedPath); // Return the path where the data should be saved.
        }
      }
    } catch (e) {
      console.error(`Error formatting data for ${entry.url}: ${e.message}`);
    }
  }

  return null;
};

// Sort data consistently to always save it in the same order between each run, so GitHub doesn't show a diff for the same data.
function sortData(data, sortKey) {
  return data.sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return -1;
    if (a[sortKey] > b[sortKey]) return 1;
    return 0;
  });
};

export const saveSortedFormattedJSON = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sortedData = sortData(data, 'url'); // ensure data is sorted before saving
  return fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2), 'utf8');
};

export const saveHardcodedExtraLinks = async () => {
  const hardcodedLinks = CONFIG.DATA_FORMATTER.HARD_CODED_LINKS;

  for (const link of hardcodedLinks) {
    const filePath = path.join(CONFIG.DATA_FORMATTER.FORMATTED_PATH, link.file_name);
    saveSortedFormattedJSON(filePath, link.data);
  }

  return hardcodedLinks.reduce((acc, link) => acc + link.data.length, 0); // Total number of links saved
};
