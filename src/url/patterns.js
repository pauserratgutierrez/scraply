/**
 * Returns true when `value` lives under the URL prefix `pattern`, comparing by
 * origin + path segments so "https://site.com" does NOT match
 * "https://site.com.evil.com".
 */
const matchesUrlPrefix = (value, pattern) => {
  try {
    const normalizedPattern = pattern.endsWith('/') ? pattern : `${pattern}/`;
    const patternUrl = new URL(normalizedPattern);
    const valueUrl = new URL(value);

    if (patternUrl.origin !== valueUrl.origin) return false;
    if (patternUrl.pathname === '/') return true;

    const prefixPath = patternUrl.pathname.replace(/\/$/, '');
    return valueUrl.pathname === prefixPath || valueUrl.pathname.startsWith(`${prefixPath}/`);
  } catch {
    return value.startsWith(pattern);
  }
};

/**
 * Tests a single pattern against a value. Patterns can be:
 * - a RegExp,
 * - a "/.../flags" string (compiled to RegExp),
 * - an absolute URL prefix (origin + path aware),
 * - any other string (substring match).
 * @param {string} value
 * @param {string|RegExp} pattern
 */
export const matchesPattern = (value, pattern) => {
  if (pattern instanceof RegExp) return pattern.test(value);

  if (typeof pattern === 'string') {
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
      const lastSlash = pattern.lastIndexOf('/');
      const source = pattern.slice(1, lastSlash);
      const flags = pattern.slice(lastSlash + 1);
      return new RegExp(source, flags).test(value);
    }

    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      return matchesUrlPrefix(value, pattern);
    }

    return value.includes(pattern);
  }

  return false;
};

/**
 * @param {string} value
 * @param {Array<string|RegExp>} [patterns]
 */
export const matchesAnyPattern = (value, patterns = []) =>
  patterns.some((pattern) => matchesPattern(value, pattern));
