import { domInlineToMarkdown, inlineToTagged, taggedToInline } from './inline.js';
import { escapeText, stripTags } from './tagged.js';

// Modello documento comune a tutti i formati:
// { title, chapters: [{ title, blocks }] }
// blocchi: heading {level,text} | paragraph {text} | list {ordered,items[]} | quote {text}
//          code {text} | table {rows: string[][]} | hr

// Restituisce i riferimenti a tutte le stringhe traducibili del documento.
function textSlots(doc) {
  const slots = [];
  const add = (obj, key, plain) => {
    if (typeof obj[key] === 'string' && obj[key].trim()) slots.push({ obj, key, plain: !!plain });
  };
  add(doc, 'title');
  for (const ch of doc.chapters) {
    add(ch, 'title');
    for (const b of ch.blocks) {
      if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote') add(b, 'text', b.plain);
      else if (b.type === 'list') b.items.forEach((_, i) => add(b.items, i, b.plain));
      else if (b.type === 'table') b.rows.forEach((row) => row.forEach((_, i) => add(row, i, b.plain)));
    }
  }
  return slots;
}

// Segmenti a tag numerati; i testi Markdown portano la formattazione come tag.
export function collectSegments(doc) {
  return textSlots(doc).map(({ obj, key, plain }) => (plain ? escapeText(obj[key]) : inlineToTagged(obj[key]).segment));
}

export function applySegments(doc, translated) {
  textSlots(doc).forEach(({ obj, key, plain }, i) => {
    if (translated[i] == null) return;
    obj[key] = plain ? stripTags(translated[i]) : taggedToInline(translated[i], inlineToTagged(obj[key]).map);
  });
  return doc;
}

export function documentText(doc) {
  return textSlots(doc)
    .map(({ obj, key }) => obj[key])
    .join('\n');
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'hr',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'aside',
  'nav',
  'main',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'body',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'caption',
]);

const clean = (s) => s.replace(/\s+/g, ' ').trim();

function hasBlockChild(el) {
  for (const c of el.children) if (BLOCK_TAGS.has(c.localName.toLowerCase())) return true;
  return false;
}

// Converte un sotto-albero HTML (mammoth, capitoli EPUB) in blocchi del modello.
export function htmlToBlocks(root) {
  const blocks = [];
  const walk = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = clean(node.nodeValue);
        if (t) blocks.push({ type: 'paragraph', text: t });
        continue;
      }
      if (node.nodeType !== 1) continue;
      const tag = node.localName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = clean(domInlineToMarkdown(node));
        if (text) blocks.push({ type: 'heading', level: Number(tag[1]), text });
      } else if (tag === 'p' || tag === 'figcaption' || tag === 'dt' || tag === 'dd' || tag === 'caption') {
        const text = clean(domInlineToMarkdown(node));
        if (text) blocks.push({ type: 'paragraph', text });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [];
        for (const li of node.children) {
          if (li.localName.toLowerCase() !== 'li') continue;
          const text = clean(domInlineToMarkdown(li));
          if (text) items.push(text);
        }
        if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      } else if (tag === 'blockquote') {
        if (hasBlockChild(node)) {
          const text = clean([...node.children].map((c) => domInlineToMarkdown(c)).join(' '));
          if (text) blocks.push({ type: 'quote', text });
        } else {
          const text = clean(domInlineToMarkdown(node));
          if (text) blocks.push({ type: 'quote', text });
        }
      } else if (tag === 'pre') {
        blocks.push({ type: 'code', text: node.textContent.replace(/\n$/, '') });
      } else if (tag === 'hr') {
        blocks.push({ type: 'hr' });
      } else if (tag === 'table') {
        const rows = [];
        for (const tr of node.querySelectorAll('tr')) {
          rows.push([...tr.children].map((td) => clean(domInlineToMarkdown(td))));
        }
        if (rows.length) blocks.push({ type: 'table', rows });
      } else if (tag === 'script' || tag === 'style' || tag === 'head') {
        continue;
      } else if (BLOCK_TAGS.has(tag) && hasBlockChild(node)) {
        walk(node);
      } else if (BLOCK_TAGS.has(tag)) {
        const text = clean(domInlineToMarkdown(node));
        if (text) blocks.push({ type: 'paragraph', text });
      } else {
        const text = clean(domInlineToMarkdown(node));
        if (text) blocks.push({ type: 'paragraph', text });
      }
    }
  };
  walk(root);
  return blocks;
}
