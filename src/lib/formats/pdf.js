import { parseInline } from '../inline.js';
import { t } from '../../i18n/index.js';

export class NoTextLayerError extends Error {
  constructor() {
    super(t('error.pdfNoText'));
    this.name = 'NoTextLayerError';
  }
}

let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const BULLET = /^\s*([•●▪◦·\-–]|\d+[.)])\s+/;

// Ricostruisce righe e paragrafi a partire dai frammenti di testo posizionati del PDF.
// `pages` è un array di pagine, ognuna un array di { str, x, y, size } (y cresce verso l'alto).
export function layoutToBlocks(pages) {
  const lines = [];
  for (const items of pages) {
    const pageLines = [];
    for (const it of items) {
      if (!it.str) continue;
      const line = pageLines[pageLines.length - 1];
      if (line && Math.abs(line.y - it.y) <= Math.max(2, it.size * 0.4)) {
        const gap = it.x - line.xEnd;
        const needsSpace = gap > it.size * 0.15 && !line.text.endsWith(' ') && !it.str.startsWith(' ');
        line.text += (needsSpace ? ' ' : '') + it.str;
        line.xEnd = it.x + (it.width || 0);
        line.size = Math.max(line.size, it.size);
      } else {
        pageLines.push({ text: it.str, y: it.y, x: it.x, xEnd: it.x + (it.width || 0), size: it.size });
      }
    }
    const filtered = pageLines
      .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
      .filter((l) => l.text && !/^\d{1,4}$/.test(l.text));
    filtered.forEach((l, i) => (l.newPage = i === 0));
    lines.push(...filtered);
  }
  if (!lines.length) return [];

  const sizes = lines.map((l) => Math.round(l.size * 2) / 2).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] || 10;

  const blocks = [];
  let current = null;
  let prev = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const l of lines) {
    const isHeading = l.size >= body * 1.2 && l.text.length < 160;
    const bullet = BULLET.exec(l.text);
    const gap = prev && !l.newPage ? prev.y - l.y : 0;
    const bigGap = prev && !l.newPage && gap > Math.max(prev.size, l.size) * 1.6;
    const sizeChange = prev && Math.abs(prev.size - l.size) > body * 0.15;

    if (isHeading) {
      if (current && current.type === 'heading' && !bigGap && !sizeChange) {
        current.text += ' ' + l.text;
      } else {
        flush();
        current = { type: 'heading', level: l.size >= body * 1.6 ? 1 : 2, text: l.text };
      }
    } else if (bullet) {
      const ordered = /\d/.test(bullet[1]);
      const text = l.text.slice(bullet[0].length);
      if (current && current.type === 'list' && current.ordered === ordered && !bigGap) current.items.push(text);
      else {
        flush();
        current = { type: 'list', ordered, items: [text], plain: true };
      }
    } else if (current && current.type === 'list' && !bigGap && !sizeChange) {
      const i = current.items.length - 1;
      current.items[i] = joinLines(current.items[i], l.text);
    } else if (current && current.type === 'paragraph' && !bigGap && !sizeChange) {
      current.text = joinLines(current.text, l.text);
    } else {
      flush();
      current = { type: 'paragraph', text: l.text, plain: true };
    }
    prev = l;
  }
  flush();
  return blocks.map((b) => (b.type === 'heading' ? { ...b, plain: true } : b));
}

function joinLines(a, b) {
  if (/[A-Za-zÀ-ÿ]-$/.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

export async function parsePdf(buffer, name = t('doc.untitled')) {
  const pdfjs = await loadPdfjs();
  // pdf.js trasferisce i dati al worker e svuota il buffer: si passa una copia, perché l'originale serve ancora.
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((it) => typeof it.str === 'string')
        .map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          width: it.width,
          size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
        })),
    );
  }
  const meta = await pdf.getMetadata().catch(() => null);
  const blocks = layoutToBlocks(pages);
  if (!blocks.some((b) => (b.text || (b.items || []).join('')).replace(/\s/g, '').length)) throw new NoTextLayerError();
  return { title: meta?.info?.Title?.trim() || '', name, chapters: [{ title: '', blocks }] };
}

// ---------- Esportazione PDF ----------

const FONT_FILES = {
  normal: 'DejaVuSans.ttf',
  bold: 'DejaVuSans-Bold.ttf',
  italic: 'DejaVuSans-Oblique.ttf',
  bolditalic: 'DejaVuSans-BoldOblique.ttf',
  mono: 'DejaVuSansMono.ttf',
};

async function loadFonts() {
  const urls = await Promise.all([
    import('dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'),
    import('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url'),
    import('dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url'),
    import('dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf?url'),
    import('dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url'),
  ]);
  const keys = Object.keys(FONT_FILES);
  const data = await Promise.all(
    urls.map(async (u) => {
      const buf = await (await fetch(u.default)).arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }),
  );
  return Object.fromEntries(keys.map((k, i) => [k, data[i]]));
}

export async function renderPdf(doc, { fonts } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const f = fonts || (await loadFonts());
  for (const [style, file] of Object.entries(FONT_FILES)) {
    pdf.addFileToVFS(file, f[style]);
    if (style === 'mono') pdf.addFont(file, 'DejaVuMono', 'normal');
    else pdf.addFont(file, 'DejaVu', style);
  }
  pdf.setProperties({ title: doc.title || doc.name || t('doc.untitled') });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  const maxW = W - 2 * M;
  let y = M;

  const ensure = (h) => {
    if (y + h > H - M) {
      pdf.addPage();
      y = M;
    }
  };

  const setStyle = (r, base) => {
    const bold = r.bold || base.bold;
    const italic = r.italic || base.italic;
    if (r.code) pdf.setFont('DejaVuMono', 'normal');
    else pdf.setFont('DejaVu', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
    pdf.setTextColor(r.link ? '#1a56b0' : '#111111');
  };

  // Impaginazione parola per parola con stili misti nella stessa riga.
  const richText = (
    text,
    { size = 11, bold = false, italic = false, indent = 0, prefix = '', plain = false, after = 8 } = {},
  ) => {
    pdf.setFontSize(size);
    const lineH = size * 1.4;
    const runs = plain
      ? [{ text }]
      : parseInline(text).map((r) => (r.image ? { text: `[${r.text || t('doc.image')}]` } : r));
    const words = [];
    for (const r of runs) {
      for (const part of r.text.split(/(\s+)/)) if (part) words.push({ ...r, text: part });
    }
    const x0 = M + indent;
    const width = maxW - indent;
    ensure(lineH);
    if (prefix) {
      setStyle({}, { bold, italic });
      pdf.text(prefix, x0 - 14, y + size);
    }
    let x = x0;
    let lineStart = true;
    for (const w of words) {
      if (/^\s+$/.test(w.text)) {
        if (!lineStart) {
          setStyle(w, { bold, italic });
          x += pdf.getTextWidth(' ');
        }
        continue;
      }
      setStyle(w, { bold, italic });
      let tw = pdf.getTextWidth(w.text);
      if (x + tw > x0 + width && !lineStart) {
        y += lineH;
        ensure(lineH);
        x = x0;
      }
      let piece = w.text;
      while (tw > width) {
        let cut = piece.length - 1;
        while (cut > 1 && pdf.getTextWidth(piece.slice(0, cut)) > x0 + width - x) cut--;
        pdf.text(piece.slice(0, cut), x, y + size);
        piece = piece.slice(cut);
        y += lineH;
        ensure(lineH);
        x = x0;
        tw = pdf.getTextWidth(piece);
      }
      pdf.text(piece, x, y + size);
      if (w.link) pdf.link(x, y, tw, size * 1.2, { url: w.link });
      x += tw;
      lineStart = false;
    }
    y += lineH + after;
  };

  const HSIZE = [22, 17, 14, 12.5, 12, 11.5];
  if (doc.title) richText(doc.title, { size: 24, bold: true, after: 14 });
  const multi = doc.chapters.length > 1;
  doc.chapters.forEach((ch, ci) => {
    if (multi && ci > 0) {
      pdf.addPage();
      y = M;
    }
    if (multi && ch.title && !(ch.blocks[0]?.type === 'heading' && ch.blocks[0].text === ch.title)) {
      richText(ch.title, { size: HSIZE[0], bold: true, after: 10 });
    }
    for (const b of ch.blocks) {
      switch (b.type) {
        case 'heading': {
          const size = HSIZE[Math.min(b.level, 6) - 1];
          ensure(size * 3);
          y += 6;
          richText(b.text, { size, bold: true, plain: b.plain, after: 6 });
          break;
        }
        case 'paragraph':
          richText(b.text, { plain: b.plain });
          break;
        case 'quote':
          richText(b.text, { italic: true, indent: 24, plain: b.plain });
          break;
        case 'list':
          b.items.forEach((it, i) =>
            richText(it, { indent: 20, prefix: b.ordered ? `${(b.start || 1) + i}.` : '•', plain: b.plain, after: 3 }),
          );
          y += 5;
          break;
        case 'code':
          pdf.setFont('DejaVuMono', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor('#111111');
          for (const line of b.text.split('\n')) {
            for (const piece of pdf.splitTextToSize(line || ' ', maxW)) {
              ensure(13);
              pdf.text(piece, M, y + 9);
              y += 13;
            }
          }
          y += 8;
          break;
        case 'table':
          for (const row of b.rows) richText(row.join('  |  '), { size: 10, plain: b.plain, after: 2 });
          y += 6;
          break;
        case 'hr':
          ensure(16);
          pdf.setDrawColor('#999999');
          pdf.line(M, y + 6, W - M, y + 6);
          y += 16;
          break;
        default:
          break;
      }
    }
  });
  return pdf.output('blob');
}
