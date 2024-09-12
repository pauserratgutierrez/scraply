import fs from 'node:fs';
import path from 'node:path';

export const loadJSON = (filePath) => fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

export const saveJSON = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const saveDataset = (data, fileNumber) => {
  if (!fs.existsSync(CONFIG.CRAWLER.CRAWLED_PATH)) fs.mkdirSync(CONFIG.CRAWLER.CRAWLED_PATH, { recursive: true });
  const filename = `${CONFIG.CRAWLER.CRAWLED_PATH}/${fileNumber}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
  return filename;
};

export const saveQueue = (urlData) => saveJSON(CONFIG.CRAWLER.QUEUE_PATH, urlData);

export const deleteDataFiles = (filePath) => {
  if (fs.existsSync(filePath)) {
    if (fs.lstatSync(filePath).isDirectory()) {
      fs.readdirSync(filePath).forEach((file) => {
        const currentPath = path.join(filePath, file);
        if (fs.lstatSync(currentPath).isDirectory()) {
          deleteDataFiles(currentPath);
        } else {
          fs.unlinkSync(currentPath);
        }
      });
      fs.rmdirSync(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  }
};
