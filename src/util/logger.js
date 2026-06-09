const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

/**
 * Creates a small leveled logger that writes to the console.
 * @param {keyof typeof LEVELS} [level='info']
 */
export const createLogger = (level = 'info') => {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (lvl, method, args) => {
    if (threshold >= LEVELS[lvl]) console[method](...args);
  };

  return {
    level,
    error: (...args) => write('error', 'error', args),
    warn: (...args) => write('warn', 'warn', args),
    info: (...args) => write('info', 'log', args),
    debug: (...args) => write('debug', 'log', args)
  };
};
