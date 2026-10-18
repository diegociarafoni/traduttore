import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'coverage']);

export function listFiles(dir, filter = () => true) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (IGNORED.has(name)) continue;
    const path = join(dir, name).replace(/\\/g, '/');
    if (statSync(path).isDirectory()) out.push(...listFiles(path, filter));
    else if (filter(path)) out.push(path);
  }
  return out;
}

export function readAll(paths) {
  return Object.fromEntries(paths.map((p) => [p, readFileSync(p, 'utf8')]));
}
