import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { hasClaudeAttribution, isClaudeIdentity, validateCommitMessage } from './lib/commit-message.mjs';

// Uso: <file> (hook commit-msg) | --range a..b (commit del ramo) | --text "titolo" | --attribuzione "descrizione".
const [mode, value] = process.argv.slice(2);
const messages = new Map();
const identities = new Map();
let source = 'history';

if (mode === '--range' && value) {
  const log = execFileSync('git', ['log', '--no-merges', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x01', value], {
    encoding: 'utf8',
  });
  for (const entry of log.split('\x01')) {
    const parts = entry.trim().split('\x00');
    if (parts.length !== 6) continue;
    const id = parts[0].slice(0, 8);
    messages.set(id, parts[5]);
    if (isClaudeIdentity(parts[1], parts[2])) identities.set(id, `${parts[1]} <${parts[2]}>`);
    if (isClaudeIdentity(parts[3], parts[4])) identities.set(id, `${parts[3]} <${parts[4]}>`);
  }
} else if (mode === '--attribuzione' && value !== undefined) {
  if (hasClaudeAttribution(value)) {
    console.error('✗ la descrizione della PR attribuisce il lavoro a Claude');
    process.exit(1);
  }
  console.log('✓ nessuna attribuzione a Claude nella descrizione');
  process.exit(0);
} else if (mode === '--text' && value !== undefined) {
  messages.set('titolo', value);
  source = 'title';
} else if (mode && !value) {
  messages.set('messaggio', readFileSync(mode, 'utf8'));
  source = 'editor';
} else {
  console.error('uso: check-commit-msg.mjs <file> | --range a..b | --text "titolo" | --attribuzione "testo"');
  process.exit(2);
}

let failed = false;
for (const [id, message] of messages) {
  const errors = validateCommitMessage(message, source);
  if (!errors.length) continue;
  failed = true;
  console.error(`✗ ${id}: ${message.split('\n')[0]}`);
  for (const e of errors) console.error(`    - ${e}`);
}
for (const [id, who] of identities) {
  failed = true;
  console.error(`✗ ${id}: autore o committer è ${who}`);
  console.error('    - usare la propria identità: git config user.name / user.email');
}
if (failed) {
  console.error('\nConvenzione: docs/convenzioni-git.md');
  process.exit(1);
}
console.log(`✓ ${messages.size} messaggi conformi alla convenzione`);
