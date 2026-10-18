const CALL = /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g;
const ATTR = /data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_.]+)"/g;
const DYNAMIC = [/labelKey: '([a-zA-Z0-9_.]+)'/g];

// sources: percorso -> testo; catalog: chiave -> testo. Le chiavi "lang.*" sono costruite dal codice lingua.
export function checkI18n(sources, catalog, { dynamicPrefixes = ['lang.'] } = {}) {
  const used = new Set();
  const problems = [];
  for (const [path, text] of Object.entries(sources)) {
    for (const re of [CALL, ATTR, ...DYNAMIC]) {
      for (const m of text.matchAll(re)) {
        used.add(m[1]);
        if (!(m[1] in catalog)) problems.push(`${path}: chiave "${m[1]}" assente dal catalogo`);
      }
    }
  }
  for (const key of Object.keys(catalog)) {
    if (!used.has(key) && !dynamicPrefixes.some((p) => key.startsWith(p))) {
      problems.push(`catalogo: chiave "${key}" non usata`);
    }
  }
  return problems;
}
