import { marked } from 'marked';
import { t } from '../../i18n/index.js';

function tokensToBlocks(tokens, blocks) {
  for (const t of tokens) {
    switch (t.type) {
      case 'heading':
        blocks.push({ type: 'heading', level: t.depth, text: t.text });
        break;
      case 'paragraph':
        blocks.push({ type: 'paragraph', text: t.text });
        break;
      case 'text':
        if (t.text.trim()) blocks.push({ type: 'paragraph', text: t.text });
        break;
      case 'list':
        blocks.push({
          type: 'list',
          ordered: t.ordered,
          start: typeof t.start === 'number' ? t.start : 1,
          items: t.items.map((it) => it.text.replace(/\n+/g, ' ').trim()),
        });
        break;
      case 'blockquote':
        blocks.push({ type: 'quote', text: t.text.replace(/\n+/g, ' ').trim() });
        break;
      case 'code':
        blocks.push({ type: 'code', text: t.text, lang: t.lang || '' });
        break;
      case 'table':
        blocks.push({
          type: 'table',
          rows: [t.header.map((c) => c.text), ...t.rows.map((r) => r.map((c) => c.text))],
        });
        break;
      case 'hr':
        blocks.push({ type: 'hr' });
        break;
      case 'html':
        if (t.text.trim()) blocks.push({ type: 'paragraph', text: t.text.trim() });
        break;
      default:
        break;
    }
  }
  return blocks;
}

// I link per riferimento ([testo][rif] con la definizione [rif]: url altrove) diventano link in linea,
// perché le definizioni non fanno parte del modello documento.
function inlineReferences(blocks, links) {
  const resolve = (whole, label, ref) => {
    const def = links[(ref || label).trim().toLowerCase().replace(/\s+/g, ' ')];
    return def ? `[${label}](${def.href})` : whole;
  };
  const fix = (text) => text.replace(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g, resolve);
  for (const b of blocks) {
    if (b.text && b.type !== 'code') b.text = fix(b.text);
    if (b.items) b.items = b.items.map(fix);
    if (b.rows) b.rows = b.rows.map((r) => r.map(fix));
  }
  return blocks;
}

export function parseMarkdown(text, name = t('doc.untitled')) {
  const tokens = marked.lexer(text.replace(/\r\n?/g, '\n'));
  const blocks = inlineReferences(tokensToBlocks(tokens, []), tokens.links || {});
  return { title: '', name, chapters: [{ title: '', blocks }] };
}

function blockToMarkdown(b) {
  switch (b.type) {
    case 'heading':
      return `${'#'.repeat(Math.min(b.level, 6))} ${b.text}`;
    case 'paragraph':
      return b.text;
    case 'list':
      return b.items.map((it, i) => (b.ordered ? `${(b.start || 1) + i}. ${it}` : `- ${it}`)).join('\n');
    case 'quote':
      return `> ${b.text}`;
    case 'code':
      return '```' + (b.lang || '') + '\n' + b.text + '\n```';
    case 'hr':
      return '---';
    case 'table': {
      const [head, ...rest] = b.rows;
      const row = (r) => `| ${r.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`;
      return [row(head), `| ${head.map(() => '---').join(' | ')} |`, ...rest.map(row)].join('\n');
    }
    default:
      return '';
  }
}

export function renderMarkdown(doc) {
  const parts = [];
  const multi = doc.chapters.length > 1;
  for (const ch of doc.chapters) {
    if (multi && ch.title && !(ch.blocks[0]?.type === 'heading' && ch.blocks[0].text === ch.title)) {
      parts.push(`# ${ch.title}`);
    }
    for (const b of ch.blocks) parts.push(blockToMarkdown(b));
  }
  if (doc.title && !parts[0]?.startsWith('# ')) parts.unshift(`# ${doc.title}`);
  return new Blob([parts.filter(Boolean).join('\n\n') + '\n'], { type: 'text/markdown;charset=utf-8' });
}
