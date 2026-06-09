import path from 'node:path';
import { matchesPattern, matchesAnyPattern } from '../url/patterns.js';

/**
 * Decides which formatted file a crawled URL belongs in.
 *
 * `output.routes` maps a URL prefix to a `{ pathKey: filename, '*': fallback }`
 * object. The most specific matching prefix wins, then the most specific path
 * key within it, then the `'*'` fallback.
 *
 * @param {string} url
 * @param {import('../index.js').OutputConfig} output
 * @param {string} formattedDir
 * @returns {string|null} absolute-ish posix path of the target file, or null
 */
export const routeRecord = (url, output, formattedDir) => {
  if (matchesAnyPattern(url, output.exclude)) return null;

  const match = Object.entries(output.routes)
    .filter(([prefix]) => matchesPattern(url, prefix))
    .sort(([a], [b]) => b.length - a.length)[0];
  if (!match) return null;

  const routeMap = match[1];
  const segments = new URL(url).pathname.split('/').filter(Boolean);

  let file = null;
  for (let i = segments.length; i >= 1; i--) {
    const key = segments.slice(0, i).join('/');
    if (routeMap[key]) {
      file = routeMap[key];
      break;
    }
  }
  if (!file) file = routeMap['*'];
  if (!file) return null;

  return path.posix.join(formattedDir, file);
};
