import { checkComments } from './lib/comments.mjs';
import { listFiles, readAll } from './files.mjs';

const isCode = (p) => /\.(m?js|css|html)$/.test(p) && !/(^|\/)comments(\.test)?\.m?js$/.test(p);
const files = ['src', 'tests', 'tool', '.github'].flatMap((d) => listFiles(d, isCode));
const problems = checkComments(readAll(files));
if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`\n✗ ${problems.length} commenti fuori regola. Vedi docs/convenzioni-git.md#commenti-nel-codice`);
  process.exit(1);
}
console.log(`✓ commenti in regola: ${files.length} file controllati`);
