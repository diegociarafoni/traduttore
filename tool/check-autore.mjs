import { execFileSync } from 'node:child_process';
import { isClaudeIdentity } from './lib/commit-message.mjs';

const get = (key) => {
  try {
    return execFileSync('git', ['config', key], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const name = get('user.name');
const email = get('user.email');
if (isClaudeIdentity(name, email)) {
  console.error(`✗ l'identità di git è ${name} <${email}>: impostare la propria con git config user.name / user.email`);
  process.exit(1);
}
console.log(`✓ autore: ${name} <${email}>`);
