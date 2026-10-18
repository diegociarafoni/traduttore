import { t } from '../i18n/index.js';
import { collectIds, escapeText, parseTagged, sameIds, stripTags } from './tagged.js';

// Formattazione in linea del modello documento: un sottoinsieme di Markdown
// (**grassetto**, *corsivo*, `codice`, [testo](url), ![alt](url)).

export function parseInline(text) {
  const runs = [];
  const re =
    /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`]+)`|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[3] !== undefined) {
      if (m[1]) runs.push({ text: m[2], image: m[3] });
      else runs.push(...parseInline(m[2]).map((r) => ({ ...r, link: m[3] })));
    } else if (m[4] !== undefined) runs.push({ text: m[4], code: true });
    else if (m[5] !== undefined || m[6] !== undefined) {
      runs.push(...parseInline(m[5] ?? m[6]).map((r) => ({ ...r, bold: true })));
    } else {
      runs.push(...parseInline(m[7] ?? m[8]).map((r) => ({ ...r, italic: true })));
    }
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.filter((r) => r.text !== '' || r.image);
}

export function plainInline(text) {
  return parseInline(text)
    .map((r) => (r.image ? (r.text ? `[${r.text}]` : '') : r.text))
    .join('');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inlineToHtml(text) {
  return parseInline(text)
    .map((r) => {
      if (r.image) return `<span class="img">[${esc(r.text || t('doc.image'))}]</span>`;
      let h = esc(r.text);
      if (r.code) h = `<code>${h}</code>`;
      if (r.bold) h = `<strong>${h}</strong>`;
      if (r.italic) h = `<em>${h}</em>`;
      if (r.link) h = `<a href="${esc(r.link)}">${h}</a>`;
      return h;
    })
    .join('');
}

// Conversione inversa: nodi DOM in linea -> Markdown in linea.
export function domInlineToMarkdown(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      out += child.nodeValue.replace(/\s+/g, ' ');
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.localName.toLowerCase();
    const inner = () => domInlineToMarkdown(child);
    if (tag === 'br') out += ' ';
    else if (tag === 'strong' || tag === 'b') out += wrap(inner(), '**');
    else if (tag === 'em' || tag === 'i') out += wrap(inner(), '*');
    else if (tag === 'code') out += wrap(child.textContent, '`');
    else if (tag === 'a' && child.getAttribute('href') && !child.getAttribute('href').startsWith('#')) {
      const t = inner();
      out += t.trim() ? `[${t}](${child.getAttribute('href')})` : t;
    } else if (tag === 'img') {
      const alt = child.getAttribute('alt');
      if (alt) out += `[${alt}]`;
    } else if (tag === 'script' || tag === 'style') continue;
    else out += inner();
  }
  return out;
}

function wrap(text, mark) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m[2]) return text;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

// Markdown in linea -> segmento a tag numerati, così il servizio di traduzione sposta la
// formattazione insieme alle parole. Codice e immagini diventano tag vuoti e non si traducono.
export function inlineToTagged(text) {
  const map = [];
  const add = (info) => {
    map.push(info);
    return map.length;
  };
  const styled = (r) => {
    const body = escapeText(r.text);
    if (!r.bold && !r.italic) return body;
    const id = add({ bold: r.bold, italic: r.italic });
    return `<${id}>${body}</${id}>`;
  };
  const runs = parseInline(text);
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (r.image) out += `<${add({ raw: `![${r.text}](${r.image})` })}/>`;
    else if (r.code) out += `<${add({ raw: `\`${r.text}\`` })}/>`;
    else if (r.link) {
      const id = add({ link: r.link });
      let inner = '';
      while (i < runs.length && runs[i].link === r.link && !runs[i].code) inner += styled(runs[i++]);
      i--;
      out += `<${id}>${inner}</${id}>`;
    } else out += styled(r);
  }
  return { segment: out, map };
}

export function taggedToInline(translated, map) {
  const tree = parseTagged(translated);
  const expected = map.map((_, i) => i + 1);
  if (!tree || !sameIds(collectIds(tree), expected)) return stripTags(translated);
  const render = (nodes) =>
    nodes
      .map((n) => {
        if (n.type === 'text') return n.text;
        const info = map[n.id - 1];
        if (info.raw) return info.raw;
        const inner = render(n.children);
        if (info.link) return `[${inner}](${info.link})`;
        const mark = info.bold && info.italic ? '***' : info.bold ? '**' : '*';
        const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
        return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
      })
      .join('');
  return render(tree);
}
