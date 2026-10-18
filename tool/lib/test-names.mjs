const SUITE = /\b(?:test\.)?describe\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
const CASE = /^(\s*)(?:it|test)\(\s*(['"`])((?:\\.|(?!\2).)*)\2/gm;

// Ogni test deve citare il codice di un requisito di docs/backlog.md, nel proprio nome
// o in quello del gruppo (describe) che lo contiene.
export function checkTestNames(sources, codePattern) {
  const code = new RegExp(codePattern);
  const problems = [];
  for (const [path, text] of Object.entries(sources)) {
    const suites = [...text.matchAll(SUITE)];
    for (const s of suites) if (!code.test(s[2])) problems.push(`${path}: gruppo "${s[2]}" senza codice di requisito`);
    if (suites.length) continue;
    for (const c of text.matchAll(CASE)) {
      if (!code.test(c[3])) problems.push(`${path}: test "${c[3]}" senza codice di requisito`);
    }
  }
  return problems;
}
