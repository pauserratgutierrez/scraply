import fs from 'node:fs';
import path from 'node:path';

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/** Reads and parses a JSON file, returning `fallback` when it does not exist. */
export const loadJSON = (filePath, fallback = null) =>
  fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;

export const saveJSON = (filePath, data) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const writeText = (filePath, text) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, text, 'utf8');
};

/** Recursively removes a file or directory; a no-op when the path is missing. */
export const deletePath = (target) => {
  fs.rmSync(target, { recursive: true, force: true });
};

/**
 * Deletes any file under `dir` that is not in `tracked`, recursing into
 * subdirectories. Used to prune stale formatted output between runs.
 *
 * @param {string} dir
 * @param {Set<string>} tracked - posix file paths produced by the current run
 * @param {{ debug: Function }} [logger]
 */
export const deleteUntracked = (dir, tracked, logger) => {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir)) {
    const current = path.posix.join(dir, entry);
    if (fs.lstatSync(current).isDirectory()) {
      deleteUntracked(current, tracked, logger);
    } else if (!tracked.has(current)) {
      logger?.debug?.(`Deleting untracked file: ${current}`);
      fs.unlinkSync(current);
    }
  }
};
