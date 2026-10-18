export const CHECKED_ROOTS = ['src', 'worker', 'tests', 'tool', 'docs', 'public', '.github', '.claude'];
export const INDEX_PATH = 'docs/README.md';
export const MAP_PATH = 'docs/mappa-del-codice.md';

const CODE = /`([^`]+)`/g;
const LINK = /\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g;
const HEADING = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function headingSlug(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

function proseLines(text) {
  const out = [];
  let fence = null;
  text.split('\n').forEach((line, i) => {
    const m = FENCE.exec(line);
    if (m) {
      if (!fence) {
        fence = m[1];
        return;
      }
      if (m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) {
        fence = null;
        return;
      }
    }
    if (!fence) out.push([i + 1, line]);
  });
  return out;
}

export function headingAnchors(text) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, line] of proseLines(text)) {
    const m = HEADING.exec(line);
    if (!m) continue;
    const slug = headingSlug(m[1]);
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    anchors.add(n === 0 ? slug : `${slug}-${n}`);
  }
  return anchors;
}

function resolve(from, target) {
  const parts = from.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

function citedPath(code) {
  if (/[\s<>*{}$]/.test(code) || !code.includes('/')) return null;
  if (!CHECKED_ROOTS.includes(code.split('/')[0])) return null;
  const path = code.replace(/:\d+(-\d+)?$/, '');
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function checkLink(from, target, docs, anchors, exists) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const hash = target.indexOf('#');
  const file = hash < 0 ? target : target.slice(0, hash);
  let anchor;
  try {
    anchor = hash < 0 ? null : decodeURIComponent(target.slice(hash + 1));
  } catch {
    return `ancora con caratteri non validi: ${target}`;
  }
  const resolved = file ? resolve(from, file) : from;
  if (resolved === null) return `link fuori dal repository: ${target}`;
  if (!exists(resolved)) return `link rotto: ${target}`;
  if (anchor && resolved.endsWith('.md') && docs[resolved] !== undefined) {
    if (!anchors.has(resolved)) anchors.set(resolved, headingAnchors(docs[resolved]));
    if (!anchors.get(resolved).has(anchor)) return `ancora inesistente: ${target}`;
  }
  return null;
}

// docs: percorso -> testo; exists(percorso) dice se esiste; codeDirs: cartelle da mappare (es. "src/lib/formats/").
export function checkDocs({ docs, exists, codeDirs }) {
  const problems = [];
  const anchors = new Map();
  for (const [path, text] of Object.entries(docs)) {
    for (const [n, line] of proseLines(text)) {
      for (const m of line.replace(CODE, '').matchAll(LINK)) {
        const p = checkLink(path, m[1] ?? m[2], docs, anchors, exists);
        if (p) problems.push(`${path}:${n} ${p}`);
      }
      for (const m of line.matchAll(CODE)) {
        const cited = citedPath(m[1]);
        if (cited && !exists(cited)) problems.push(`${path}:${n} percorso inesistente: ${m[1]}`);
      }
    }
  }
  const index = docs[INDEX_PATH];
  if (index === undefined) problems.push(`${INDEX_PATH} manca`);
  else {
    for (const path of Object.keys(docs)) {
      if (!path.startsWith('docs/') || path === INDEX_PATH) continue;
      const name = path.slice('docs/'.length);
      if (!name.includes('/') && name.endsWith('.md') && !index.includes(`(${name})`)) {
        problems.push(`${INDEX_PATH}: ${name} non è nell'indice`);
      }
    }
  }
  const map = docs[MAP_PATH];
  if (map === undefined) problems.push(`${MAP_PATH} manca`);
  else {
    const rows = new Set([...map.matchAll(/^\|\s*`(src\/[^`]*\/)`\s*\|/gm)].map((m) => m[1]));
    for (const dir of codeDirs) if (!rows.has(dir)) problems.push(`${MAP_PATH}: manca la riga per \`${dir}\``);
    for (const row of rows)
      if (!codeDirs.includes(row)) problems.push(`${MAP_PATH}: la cartella \`${row}\` non esiste più`);
  }
  return problems;
}
