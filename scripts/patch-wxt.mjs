import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const printHeaderPath =
  new URL('../node_modules/wxt/dist/core/utils/log/printHeader.mjs', import.meta.url);

if (!existsSync(printHeaderPath)) process.exit(0);

const source = await readFile(printHeaderPath, 'utf8');
const patched = source.replaceAll('"grey"', '"gray"');

if (patched !== source) {
  await writeFile(printHeaderPath, patched, 'utf8');
}
