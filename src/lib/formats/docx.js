import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { htmlToBlocks } from '../model.js';
import { t } from '../../i18n/index.js';
import { parseInline } from '../inline.js';
import { escapeText, parseTagged, stripTags, collectIds, sameIds } from '../tagged.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function parseDocx(buffer, name = t('doc.untitled')) {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer, buffer });
  const dom = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
  return { title: '', name, chapters: [{ title: '', blocks: htmlToBlocks(dom.body) }] };
}

// ---------- Esportazione da modello documento ----------

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function runs(text, plain, extra = {}) {
  const parts = plain ? [{ text }] : parseInline(text);
  return parts.map((r) => {
    const run = new TextRun({
      text: r.image ? `[${r.text || t('doc.image')}]` : r.text,
      bold: r.bold || extra.bold,
      italics: r.italic || extra.italics,
      font: r.code ? 'Consolas' : undefined,
      style: r.link ? 'Hyperlink' : undefined,
    });
    return r.link ? new ExternalHyperlink({ link: r.link, children: [run] }) : run;
  });
}

export async function renderDocx(doc) {
  const children = [];
  let listInstance = 0;
  if (doc.title) children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(doc.title) }));
  const multi = doc.chapters.length > 1;
  doc.chapters.forEach((ch, ci) => {
    const startsWithTitle = ch.blocks[0]?.type === 'heading' && ch.blocks[0].text === ch.title;
    if (multi && ch.title && !startsWithTitle) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: ci > 0, children: runs(ch.title) }),
      );
    }
    for (const b of ch.blocks) {
      switch (b.type) {
        case 'heading':
          children.push(
            new Paragraph({ heading: HEADINGS[Math.min(b.level, 6) - 1], children: runs(b.text, b.plain) }),
          );
          break;
        case 'paragraph':
          children.push(new Paragraph({ children: runs(b.text, b.plain), spacing: { after: 160 } }));
          break;
        case 'quote':
          children.push(
            new Paragraph({
              children: runs(b.text, b.plain, { italics: true }),
              indent: { left: 720 },
              spacing: { after: 160 },
            }),
          );
          break;
        case 'list': {
          listInstance += 1;
          for (const it of b.items) {
            children.push(
              new Paragraph({
                children: runs(it, b.plain),
                numbering: { reference: b.ordered ? 'numbers' : 'bullets', level: 0, instance: listInstance },
              }),
            );
          }
          break;
        }
        case 'code':
          for (const line of b.text.split('\n')) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 19 })],
                shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
                spacing: { after: 0 },
              }),
            );
          }
          children.push(new Paragraph({ children: [] }));
          break;
        case 'hr':
          children.push(
            new Paragraph({
              children: [],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
            }),
          );
          break;
        case 'table': {
          const cols = Math.max(...b.rows.map((r) => r.length));
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: b.rows.map(
                (r, ri) =>
                  new TableRow({
                    children: Array.from(
                      { length: cols },
                      (_, i) =>
                        new TableCell({
                          children: [new Paragraph({ children: runs(r[i] || '', b.plain, { bold: ri === 0 }) })],
                        }),
                    ),
                  }),
              ),
            }),
          );
          children.push(new Paragraph({ children: [] }));
          break;
        }
        default:
          break;
      }
    }
  });

  const level = (format, text) => ({
    level: 0,
    format,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
  });
  const document = new Document({
    title: doc.title || doc.name,
    numbering: {
      config: [
        { reference: 'bullets', levels: [level(LevelFormat.BULLET, '•')] },
        { reference: 'numbers', levels: [level(LevelFormat.DECIMAL, '%1.')] },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBlob(document);
}

// ---------- Traduzione "sul posto" (docx -> docx) ----------
// Mantiene stili, tabelle, immagini, intestazioni e piè di pagina: si sostituisce solo il testo.
// I run consecutivi con la stessa formattazione vengono fusi; quelli con formattazione diversa
// diventano tag numerati, così grassetti e corsivi restano sulle parole giuste.

function ownRuns(p) {
  const out = [];
  for (const r of p.getElementsByTagNameNS(W, 'r')) {
    let a = r.parentNode;
    while (a && !(a.namespaceURI === W && a.localName === 'p')) a = a.parentNode;
    if (a === p && r.getElementsByTagNameNS(W, 't').length) out.push(r);
  }
  return out;
}

function runText(r) {
  return [...r.getElementsByTagNameNS(W, 't')].map((t) => t.textContent).join('');
}

function runFormat(r) {
  const rPr = [...r.childNodes].find((c) => c.localName === 'rPr');
  return rPr ? new XMLSerializer().serializeToString(rPr) : '';
}

function setRunText(r, text) {
  const ts = [...r.getElementsByTagNameNS(W, 't')];
  ts.forEach((t, i) => {
    if (i === 0) {
      t.textContent = text;
      t.setAttribute('xml:space', 'preserve');
    } else {
      t.parentNode.removeChild(t);
    }
  });
}

function paragraphUnits(xmlDoc) {
  const units = [];
  for (const p of xmlDoc.getElementsByTagNameNS(W, 'p')) {
    const rs = ownRuns(p);
    if (!rs.length) continue;
    const groups = [];
    for (const r of rs) {
      const fmt = runFormat(r);
      const last = groups[groups.length - 1];
      if (last && last.fmt === fmt) last.runs.push(r);
      else groups.push({ fmt, runs: [r] });
    }
    const texts = groups.map((g) => g.runs.map(runText).join(''));
    if (!texts.join('').trim()) continue;
    const segment =
      groups.length === 1
        ? escapeText(texts[0])
        : texts.map((t, i) => `<${i + 1}>${escapeText(t)}</${i + 1}>`).join('');
    units.push({ groups, segment });
  }
  return units;
}

function applyUnit(unit, translated) {
  const { groups } = unit;
  let texts;
  if (groups.length === 1) {
    texts = [stripTags(translated)];
  } else {
    const tree = parseTagged(translated);
    const expected = groups.map((_, i) => i + 1);
    const flat = tree && tree.every((n) => n.type === 'text' || n.children.every((c) => c.type === 'text'));
    if (tree && flat && sameIds(collectIds(tree), expected)) {
      texts = new Array(groups.length).fill('');
      let pending = '';
      for (const n of tree) {
        if (n.type === 'text') pending += n.text;
        else {
          texts[n.id - 1] = pending + n.children.map((c) => c.text).join('');
          pending = '';
        }
      }
      if (pending) texts[texts.length - 1] += pending;
    } else {
      texts = [stripTags(translated), ...new Array(groups.length - 1).fill('')];
    }
  }
  groups.forEach((g, i) => {
    g.runs.forEach((r, j) => setRunText(r, j === 0 ? texts[i] : ''));
  });
}

const PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

export async function translateDocxInPlace(buffer, translateAll, { targetCode } = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = [];
  for (const path of Object.keys(zip.files)
    .filter((p) => PARTS.test(p))
    .sort()) {
    const xml = await zip.file(path).async('string');
    const xmlDoc = new DOMParser().parseFromString(xml, 'application/xml');
    parts.push({ path, xmlDoc, units: paragraphUnits(xmlDoc) });
  }
  const all = parts.flatMap((p) => p.units);
  const translated = await translateAll(all.map((u) => u.segment));
  all.forEach((u, i) => applyUnit(u, translated[i]));
  for (const p of parts) {
    if (targetCode) {
      for (const lang of p.xmlDoc.getElementsByTagNameNS(W, 'lang')) {
        if (lang.getAttributeNS(W, 'val')) lang.setAttributeNS(W, 'w:val', targetCode);
      }
    }
    zip.file(p.path, new XMLSerializer().serializeToString(p.xmlDoc));
  }
  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
}

export function docxSegmentsPreview(buffer) {
  return JSZip.loadAsync(buffer).then(async (zip) => {
    const file = zip.file('word/document.xml');
    if (!file) throw new Error(t('error.docxInvalid'));
    const xmlDoc = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
    return paragraphUnits(xmlDoc).map((u) => u.segment);
  });
}
