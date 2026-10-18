import { readFileSync } from 'node:fs';
import { checkTestNames } from './lib/test-names.mjs';
import { listFiles, readAll } from './files.mjs';

const { requirementCode } = JSON.parse(readFileSync('tool/policy.json', 'utf8')).tests;
const files = listFiles('tests', (p) => /\.(test|spec)\.js$/.test(p));
const problems = checkTestNames(readAll(files), requirementCode);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error('\nVedi docs/sviluppo.md#metodo');
  process.exit(1);
}
console.log(`✓ nomi dei test con codice di requisito: ${files.length} file controllati`);
