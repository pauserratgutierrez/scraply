/**
 * Minimal hook registry used for crawler lifecycle callbacks.
 * - `emit` runs handlers for their side effects.
 * - `reduce` threads a value through handlers; a handler may return a replacement.
 */
export const createHooks = () => {
  const handlers = new Map();

  const on = (name, fn) => {
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(fn);

    return () => {
      const list = handlers.get(name) ?? [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
    };
  };

  const emit = async (name, ...args) => {
    for (const fn of handlers.get(name) ?? []) await fn(...args);
  };

  const reduce = async (name, value, ...rest) => {
    let current = value;
    for (const fn of handlers.get(name) ?? []) {
      const result = await fn(current, ...rest);
      if (result !== undefined) current = result;
    }
    return current;
  };

  return { on, emit, reduce };
};
