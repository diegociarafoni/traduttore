import { ANGULAR_TYPES } from './commit-message.mjs';

export const BRANCH_TYPES = [...ANGULAR_TYPES, 'hotfix', 'chore'];
const FEATURE = new RegExp(`^(${BRANCH_TYPES.join('|')})/[a-z0-9][a-z0-9._-]*(/[a-z0-9][a-z0-9._-]*)*$`);
// Rami degli strumenti automatici. Non `claude/`: anche le sessioni di Claude Code usano i prefissi standard.
const AUTOMATION = ['dependabot/', 'release-please--'];

export function validateBranchName(name) {
  if (name === 'main' || name === 'master') {
    return `non si lavora direttamente su ${name}: crea un ramo tipo/descrizione`;
  }
  if (AUTOMATION.some((p) => name.startsWith(p)) || FEATURE.test(name)) return null;
  return `il ramo "${name}" non segue il formato tipo/descrizione-in-minuscolo (tipi: ${BRANCH_TYPES.join(', ')})`;
}

// Input del hook pre-push: "<ref locale> <sha locale> <ref remoto> <sha remoto>" per riga.
export function pushedBranches(input) {
  const zero = /^0+$/;
  return input
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 4 && !zero.test(p[1]) && p[2].startsWith('refs/heads/'))
    .map((p) => p[2].slice('refs/heads/'.length));
}
