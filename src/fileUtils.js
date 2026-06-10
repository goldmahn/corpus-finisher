import fs from 'node:fs/promises';
import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from './config.js';

/**
 * @param {string} folderPath
 * @returns {Promise<string[]>}
 */
export async function discoverWavFiles(folderPath) {
  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      throw new Error(`Input folder does not exist: ${folderPath}`);
    }
    throw err;
  }

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(folderPath, name));
}

/**
 * @param {string} folderPath
 */
export async function ensureFolder(folderPath) {
  await fs.mkdir(folderPath, { recursive: true });
}

/**
 * @param {string} inputPath
 * @param {string} outputFolder
 * @returns {string}
 */
export function buildOutputPath(inputPath, outputFolder) {
  return path.join(outputFolder, path.basename(inputPath));
}
