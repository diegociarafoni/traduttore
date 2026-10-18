export const ANGULAR_TYPES = ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'];

const MAX_HEADER = 100;
const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?: (?<subject>.*)$/;
const SCOPE = /^[a-z0-9][a-z0-9._/-]*$/;
const GIT_MERGE = /^Merge (branch|remote-tracking branch|pull request|commit) /;
const GIT_REVERT = /^Revert "/;
const RELEASE = /^chore\(main\): release \S+$/;
// Una sigla (PDF, EPUB, RF-10) può aprire la descrizione.
const ACRONYM = /^[A-Z][A-Z0-9]+(?![A-Za-z])/;
const AUTOSQUASH = /^(fixup|squash|amend)! /;
const ATTRIBUTION =
  /^\s*(co-authored-by:.*(claude|anthropic)|claude-session:)|claude\.ai\/code\/session_|generated with .*claude/im;

export function isClaudeIdentity(name, email) {
  return /@anthropic\.com$/i.test(email.trim()) || name.trim().toLowerCase() === 'claude';
}

export function hasClaudeAttribution(text) {
  return ATTRIBUTION.test(text);
}

// source: 'editor' (hook commit-msg, righe # ignorate), 'history' (commit del ramo), 'title' (titolo della PR).
export function validateCommitMessage(message, source = 'history') {
  const lines = message
    .split('\n')
    .filter((l) => source !== 'editor' || !l.startsWith('#'))
    .map((l) => l.trimEnd());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  if (!lines.length) return ['messaggio vuoto'];
  if (hasClaudeAttribution(lines.join('\n'))) {
    return ['attribuzione a Claude non ammessa (Co-authored-by, Claude-Session, link alla sessione, «Generated with»)'];
  }
  let header = lines[0];
  if (RELEASE.test(header) || GIT_REVERT.test(header)) return [];
  if (source !== 'title') {
    if (GIT_MERGE.test(header)) return [];
    while (AUTOSQUASH.test(header)) header = header.replace(AUTOSQUASH, '');
  }
  const errors = [];
  if (header.length > MAX_HEADER) errors.push(`intestazione oltre ${MAX_HEADER} caratteri`);
  if (lines.length > 1 && lines[1]) errors.push('serve una riga vuota tra intestazione e corpo');
  const m = HEADER.exec(header);
  if (!m) {
    errors.push(`formato atteso "tipo(ambito): descrizione", tipi: ${ANGULAR_TYPES.join(', ')}`);
    return errors;
  }
  const { type, scope, subject } = m.groups;
  if (!ANGULAR_TYPES.includes(type)) errors.push(`tipo "${type}" non ammesso; tipi: ${ANGULAR_TYPES.join(', ')}`);
  if (scope !== undefined && !SCOPE.test(scope)) errors.push(`ambito "${scope}" non valido: minuscole, cifre, . _ / -`);
  if (!subject.trim()) errors.push('descrizione mancante');
  else {
    if (subject[0] !== subject[0].toLowerCase() && !ACRONYM.test(subject)) {
      errors.push('la descrizione inizia con la minuscola');
    }
    if (subject.endsWith('.')) errors.push('la descrizione non termina con il punto');
  }
  return errors;
}
