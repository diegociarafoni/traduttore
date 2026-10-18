import { readdirSync, readFileSync } from 'node:fs';
import { checkCatalogParts, checkI18n, hardcodedTexts } from './lib/i18n.mjs';
import { listFiles, readAll } from './files.mjs';

const policy = JSON.parse(readFileSync('tool/policy.json', 'utf8')).i18n;
const dir = 'src/i18n/it';
const parts = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [`${dir}/${f}`, JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))]),
);
const catalog = Object.assign({}, ...Object.values(parts));
const code = listFiles('src', (p) => p.endsWith('.js'));
const problems = [...checkCatalogParts(parts, policy.areas), ...checkI18n(readAll([...code, 'index.html']), catalog)];
const hardcoded = hardcodedTexts(readAll(code.filter((p) => !p.startsWith('src/i18n/'))));
if (hardcoded.length > policy.maxHardcodedTexts) {
  problems.push(
    `${hardcoded.length} testi scritti nel codice invece che nel catalogo (massimo ${policy.maxHardcodedTexts}):`,
    ...hardcoded.map((h) => `  ${h}`),
  );
}
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error('\nVedi docs/localizzazione.md');
  process.exit(1);
}
console.log(
  `✓ testi dell'interfaccia coerenti: ${Object.keys(catalog).length} chiavi in ${Object.keys(parts).length} file`,
);
