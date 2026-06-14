import { writeText } from '../storage/files.js';
import { routeRecord } from './router.js';

const sortByUrl = (records) => [...records].sort((a, b) => a.url.localeCompare(b.url));

// Internal bookkeeping fields kept on disk but omitted from formatted output.
const OUTPUT_OMIT = new Set(['hash', 'crawledAt', 'file']);

/** Projects a stored record to its public output shape (url, content, data, any transform fields). */
const toOutputRecord = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !OUTPUT_OMIT.has(key)));

/**
 * Serializes records. Sorting by URL keeps output stable across runs so version
 * control does not show spurious diffs for unchanged data.
 *
 * @param {Array<{ url: string, content: string }>} records
 * @param {'json'|'jsonl'|'lines'} format
 */
const serialize = (records, format) => {
  const sorted = sortByUrl(records);

  if (format === 'lines') return sorted.map((record) => `${record.url} ${record.content}`).join('\n');

  const projected = sorted.map(toOutputRecord);
  if (format === 'jsonl') return `${projected.map((record) => JSON.stringify(record)).join('\n')}\n`;
  return JSON.stringify(projected, null, 2);
};

/** Writes a single group of records to `filePath`. */
export const writeRecords = (filePath, records, format = 'json') => {
  writeText(filePath, serialize(records, format));
};

/**
 * Groups records by routed output file and writes each group.
 *
 * @param {Array<{ url: string, content: string }>} records
 * @param {{ output: import('../index.js').OutputConfig, formattedDir: string }} options
 * @returns {Map<string, Array<{ url: string, content: string }>>} written file -> records
 */
export const formatRecords = (records, { output, formattedDir }) => {
  const groups = new Map();

  for (const record of records) {
    const filePath = routeRecord(record.url, output, formattedDir);
    if (!filePath) continue;
    if (!groups.has(filePath)) groups.set(filePath, []);
    groups.get(filePath).push(record);
  }

  for (const [filePath, group] of groups) {
    writeRecords(filePath, group, output.format);
  }

  return groups;
};
