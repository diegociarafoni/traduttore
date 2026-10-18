import { applySegments, collectSegments } from './model.js';
import { parseMarkdown, renderMarkdown } from './formats/markdown.js';
import { parseText, renderText } from './formats/text.js';
import { parseDocx, renderDocx, translateDocxInPlace, docxSegmentsPreview } from './formats/docx.js';
import { parseEpub, renderEpub, translateEpubInPlace, epubSegmentsPreview } from './formats/epub.js';
import { parsePdf, renderPdf } from './formats/pdf.js';
import { t } from '../i18n/index.js';

export const FORMATS = {
  md: { labelKey: 'format.md', ext: 'md' },
  docx: { labelKey: 'format.docx', ext: 'docx' },
  txt: { labelKey: 'format.txt', ext: 'txt' },
  epub: { labelKey: 'format.epub', ext: 'epub' },
  pdf: { labelKey: 'format.pdf', ext: 'pdf' },
};

const ALIASES = { markdown: 'md', text: 'txt' };

export function formatFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const f = ALIASES[ext] || ext;
  return FORMATS[f] ? f : null;
}

export function baseName(name) {
  return name.replace(/\.[^.]+$/, '');
}

const decode = (buffer) => new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');

export async function parseFile(buffer, format, name) {
  switch (format) {
    case 'md':
      return parseMarkdown(decode(buffer), name);
    case 'txt':
      return parseText(decode(buffer), name);
    case 'docx':
      return parseDocx(buffer, name);
    case 'epub':
      return parseEpub(buffer, name);
    case 'pdf':
      return parsePdf(buffer, name);
    default:
      throw new Error(t('error.unsupportedFormat', { format }));
  }
}

export async function renderDoc(doc, format, { lang } = {}) {
  switch (format) {
    case 'md':
      return renderMarkdown(doc);
    case 'txt':
      return renderText(doc);
    case 'docx':
      return renderDocx(doc);
    case 'epub':
      return renderEpub(doc, { lang });
    case 'pdf':
      return renderPdf(doc);
    default:
      throw new Error(t('error.unsupportedFormat', { format }));
  }
}

const inPlace = (inFormat, outFormat) => inFormat === outFormat && (inFormat === 'docx' || inFormat === 'epub');

// Analizza il file senza tradurlo: restituisce i segmenti (per rilevare la lingua e stimare il costo).
export async function inspectFile(buffer, format, name) {
  if (format === 'docx') return { segments: await docxSegmentsPreview(buffer) };
  if (format === 'epub') {
    const doc = await parseEpub(buffer, name);
    const segments = collectSegments(doc);
    return { segments: segments.length ? segments : await epubSegmentsPreview(buffer) };
  }
  const doc = await parseFile(buffer, format, name);
  return { segments: collectSegments(doc) };
}

// `translateAll(segments) => Promise<string[]>` è iniettata: in produzione chiama il modello,
// nei test è un traduttore finto.
export async function translateFile({ buffer, name, inFormat, outFormat, translateAll, targetCode }) {
  const outName = `${baseName(name)}.${targetCode || 'tradotto'}.${FORMATS[outFormat].ext}`;
  if (inPlace(inFormat, outFormat)) {
    const blob =
      inFormat === 'docx'
        ? await translateDocxInPlace(buffer, translateAll, { targetCode })
        : await translateEpubInPlace(buffer, translateAll, { targetCode });
    return { blob, filename: outName };
  }
  const doc = await parseFile(buffer, inFormat, baseName(name));
  const translated = await translateAll(collectSegments(doc));
  applySegments(doc, translated);
  const blob = await renderDoc(doc, outFormat, { lang: targetCode });
  return { blob, filename: outName };
}
