import { plainInline } from '../inline.js';
import { t } from '../../i18n/index.js';

const BULLET = /^\s*([-*•–·]|\d+[.)])\s+/;

export function parseText(text, name = t('doc.untitled')) {
  const blocks = [];
  const normalized = text.replace(/\r\n?/g, '\n');
  let paragraphs = normalized.split(/\n\s*\n/);
  // Senza righe vuote ogni riga è un paragrafo, tranne le voci di elenco consecutive.
  if (paragraphs.length === 1) {
    paragraphs = [];
    for (const line of normalized.split('\n')) {
      const last = paragraphs.length - 1;
      if (last >= 0 && BULLET.test(line) && BULLET.test(paragraphs[last])) paragraphs[last] += `\n${line}`;
      else paragraphs.push(line);
    }
  }
  for (const para of paragraphs) {
    const lines = para.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.length > 1 && lines.every((l) => BULLET.test(l))) {
      blocks.push({
        type: 'list',
        ordered: /^\s*\d/.test(lines[0]),
        items: lines.map((l) => l.replace(BULLET, '').trim()),
        plain: true,
      });
    } else {
      blocks.push({ type: 'paragraph', text: lines.map((l) => l.trim()).join(' '), plain: true });
    }
  }
  return { title: '', name, chapters: [{ title: '', blocks }] };
}

function blockToText(b) {
  const t = (s) => (b.plain ? s : plainInline(s));
  switch (b.type) {
    case 'heading':
      return b.level <= 1 ? t(b.text).toUpperCase() : t(b.text);
    case 'paragraph':
    case 'quote':
      return t(b.text);
    case 'list':
      return b.items.map((it, i) => (b.ordered ? `${(b.start || 1) + i}. ` : '- ') + t(it)).join('\n');
    case 'code':
      return b.text;
    case 'table':
      return b.rows.map((r) => r.map(t).join('\t')).join('\n');
    case 'hr':
      return '* * *';
    default:
      return '';
  }
}

export function renderText(doc) {
  const parts = [];
  if (doc.title) parts.push(doc.title.toUpperCase());
  const multi = doc.chapters.length > 1;
  for (const ch of doc.chapters) {
    if (multi && ch.title && !(ch.blocks[0]?.type === 'heading' && ch.blocks[0].text === ch.title)) {
      parts.push(plainInline(ch.title).toUpperCase());
    }
    for (const b of ch.blocks) parts.push(blockToText(b));
  }
  return new Blob([parts.filter(Boolean).join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
}
