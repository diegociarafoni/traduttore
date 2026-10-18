import { readFileSync } from 'node:fs';
import { checkI18n } from './lib/i18n.mjs';
import { listFiles, readAll } from './files.mjs';

const catalog = JSON.parse(readFileSync('src/i18n/it.json', 'utf8'));
const sources = readAll([...listFiles('src', (p) => p.endsWith('.js')), 'index.html']);
const problems = checkI18n(sources, catalog);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error('\nVedi docs/localizzazione.md');
  process.exit(1);
}
console.log(`✓ testi dell'interfaccia coerenti: ${Object.keys(catalog).length} chiavi`);
