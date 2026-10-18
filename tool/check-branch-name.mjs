import { readFileSync } from 'node:fs';
import { pushedBranches, validateBranchName } from './lib/branch-name.mjs';

// Uso: <ramo> | --pre-push (input del hook su stdin).
const arg = process.argv[2];
if (!arg) {
  console.error('uso: check-branch-name.mjs <ramo> | --pre-push');
  process.exit(2);
}
const names = arg === '--pre-push' ? pushedBranches(readFileSync(0, 'utf8')) : [arg];
let failed = false;
for (const name of names) {
  const error = validateBranchName(name);
  if (error) {
    failed = true;
    console.error(`✗ ${error}`);
  } else console.log(`✓ ramo "${name}" conforme`);
}
if (failed) {
  console.error('Convenzione: docs/convenzioni-git.md');
  process.exit(1);
}
