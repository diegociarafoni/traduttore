// Codifica "a tag numerati" usata per tradurre testo con formattazione in linea.
// Un segmento è una stringa come `Ciao <1>mondo</1><2/>`: i tag numerati
// rappresentano elementi originali (run di Word, <em>, <a>, <br> ...) che il
// modello deve lasciare intatti. Il testo è sempre escapato (&, <, >).

export function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function unescapeText(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Restituisce un albero [{type:'text', text} | {type:'el', id, children}]
// oppure null se la stringa non è ben formata.
export function parseTagged(input) {
  const root = { children: [] };
  const stack = [root];
  const re = /<(\/?)(\d+)(\/?)>/g;
  let last = 0;
  let m;
  while ((m = re.exec(input))) {
    if (m.index > last) {
      stack[stack.length - 1].children.push({ type: 'text', text: unescapeText(input.slice(last, m.index)) });
    }
    last = re.lastIndex;
    const [, closing, id, selfClosing] = m;
    if (closing && selfClosing) return null;
    if (selfClosing) {
      stack[stack.length - 1].children.push({ type: 'el', id: Number(id), children: [], void: true });
    } else if (closing) {
      const top = stack.pop();
      if (stack.length === 0 || top.id !== Number(id)) return null;
    } else {
      const el = { type: 'el', id: Number(id), children: [] };
      stack[stack.length - 1].children.push(el);
      stack.push(el);
    }
  }
  if (stack.length !== 1) return null;
  if (last < input.length) root.children.push({ type: 'text', text: unescapeText(input.slice(last)) });
  return root.children;
}

export function stripTags(input) {
  return unescapeText(input.replace(/<\/?\d+\/?>/g, ''));
}

// Elenco degli id usati in un albero, per verificare che il modello non ne abbia persi o inventati.
export function collectIds(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === 'el') {
      out.push(n.id);
      collectIds(n.children, out);
    }
  }
  return out;
}

export function sameIds(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}
