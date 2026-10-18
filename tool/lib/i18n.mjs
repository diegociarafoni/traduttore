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

// Ogni file del catalogo contiene solo le chiavi della propria area: <area>.json -> prefissi ammessi.
export function checkCatalogParts(parts, areas) {
  const problems = [];
  const seen = new Map();
  for (const [file, keys] of Object.entries(parts)) {
    const area = file.replace(/^.*\//, '').replace(/\.json$/, '');
    const prefixes = areas[area];
    if (!prefixes) {
      problems.push(`${file}: area "${area}" non prevista in tool/policy.json`);
      continue;
    }
    for (const key of Object.keys(keys)) {
      if (!prefixes.some((p) => key.startsWith(p))) problems.push(`${file}: chiave "${key}" fuori dall'area ${area}`);
      if (seen.has(key)) problems.push(`${file}: chiave "${key}" già in ${seen.get(key)}`);
      seen.set(key, file);
    }
  }
  return problems;
}

const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const PROSE = /\p{L}{2,}[,.:;!?']?\s+\p{L}{2,}/u;

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Frasi scritte nel codice invece che nel catalogo: stringhe con almeno due parole.
// Interpolazioni ${…}, espressioni regolari e indirizzi non contano.
export function hardcodedTexts(sources) {
  const found = [];
  for (const [path, text] of Object.entries(sources)) {
    for (const m of stripComments(text).matchAll(LITERAL)) {
      const value = m[2].replace(/\$\{[^}]*\}/g, ' ');
      if (/^https?:|^[./<]|<[a-z]/i.test(value)) continue;
      if (PROSE.test(value)) found.push(`${path}: ${m[0].slice(0, 60)}`);
    }
  }
  return found;
}
