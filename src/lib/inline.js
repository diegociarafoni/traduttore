import { t } from '../i18n/index.js';

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
