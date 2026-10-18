import { existsSync, readdirSync, statSync } from 'node:fs';
import { checkDocs } from './lib/docs.mjs';
import { listFiles, readAll } from './files.mjs';

const top = readdirSync('.').filter((f) => f.endsWith('.md'));
const docs = readAll([...top, ...listFiles('docs', (p) => p.endsWith('.md'))]);
const dirsOf = (root) =>
  readdirSync(root)
    .filter((d) => statSync(`${root}/${d}`).isDirectory())
    .map((d) => `${root}/${d}/`);
const codeDirs = [...dirsOf('src'), ...dirsOf('src/lib')].sort();
const problems = checkDocs({ docs, exists: (p) => existsSync(p), codeDirs });
if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`\n✗ ${problems.length} problemi nella documentazione. Vedi docs/mappa-del-codice.md`);
  process.exit(1);
}
console.log(`✓ documentazione coerente: ${Object.keys(docs).length} file controllati`);
