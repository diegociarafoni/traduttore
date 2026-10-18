import { applySegments, collectSegments } from './model.js';
import { parseMarkdown, renderMarkdown } from './formats/markdown.js';
import { parseText, renderText } from './formats/text.js';
import { parseDocx, renderDocx, translateDocxInPlace, docxSegmentsPreview } from './formats/docx.js';
import { parseEpub, renderEpub, translateEpubInPlace, epubSegmentsPreview } from './formats/epub.js';
import { parsePdf, renderPdf } from './formats/pdf.js';
import { t } from '../i18n/index.js';

const decode = (buffer) => new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');

// Registro dei formati: per aggiungerne uno basta una voce qui.
// `parse(buffer, name)` e `render(doc, { lang })` passano dal modello documento comune;
// `inPlace(buffer, translateAll, { targetCode })` traduce senza conversione, conservando il file originale;
// `inspect(buffer, name)` restituisce i segmenti da contare quando differiscono da quelli del modello.
export const FORMATS = {
  md: {
    labelKey: 'format.md',
    ext: 'md',
    parse: (buffer, name) => parseMarkdown(decode(buffer), name),
    render: renderMarkdown,
  },
  docx: {
    labelKey: 'format.docx',
    ext: 'docx',
    parse: parseDocx,
    render: renderDocx,
    inPlace: translateDocxInPlace,
    inspect: docxSegmentsPreview,
  },
  txt: {
    labelKey: 'format.txt',
    ext: 'txt',
    parse: (buffer, name) => parseText(decode(buffer), name),
    render: renderText,
  },
  epub: {
    labelKey: 'format.epub',
    ext: 'epub',
    parse: parseEpub,
    render: renderEpub,
    inPlace: translateEpubInPlace,
    // Un EPUB senza capitoli riconoscibili si conta sul testo dei suoi file XHTML.
    inspect: async (buffer, name) => {
      const segments = collectSegments(await parseEpub(buffer, name));
      return segments.length ? segments : epubSegmentsPreview(buffer);
    },
  },
  // renderPdf riceve solo il documento: il suo secondo argomento sono i caratteri, non la lingua.
  pdf: { labelKey: 'format.pdf', ext: 'pdf', parse: parsePdf, render: (doc) => renderPdf(doc) },
};

const ALIASES = { markdown: 'md', text: 'txt' };

export function formatFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const f = ALIASES[ext] || ext;
  return Object.hasOwn(FORMATS, f) ? f : null;
}

export function baseName(name) {
  return name.replace(/\.[^.]+$/, '');
}

function formatOf(format) {
  if (!Object.hasOwn(FORMATS, format)) throw new Error(t('error.unsupportedFormat', { format }));
  return FORMATS[format];
}

export async function parseFile(buffer, format, name) {
  return formatOf(format).parse(buffer, name);
}

export async function renderDoc(doc, format, { lang } = {}) {
  return formatOf(format).render(doc, { lang });
}

// Analizza il file senza tradurlo: restituisce i segmenti (per rilevare la lingua e contare i caratteri).
export async function inspectFile(buffer, format, name) {
  const { inspect } = formatOf(format);
  if (inspect) return { segments: await inspect(buffer, name) };
  return { segments: collectSegments(await parseFile(buffer, format, name)) };
}

// `translateAll(segments) => Promise<string[]>` è iniettata: in produzione chiama il servizio di traduzione,
// nei test è un traduttore finto.
export async function translateFile({ buffer, name, inFormat, outFormat, translateAll, targetCode }) {
  const outName = `${baseName(name)}.${targetCode || 'tradotto'}.${formatOf(outFormat).ext}`;
  const { inPlace } = formatOf(inFormat);
  if (inPlace && inFormat === outFormat) {
    return { blob: await inPlace(buffer, translateAll, { targetCode }), filename: outName };
  }
  const doc = await parseFile(buffer, inFormat, baseName(name));
  const translated = await translateAll(collectSegments(doc));
  applySegments(doc, translated);
  const blob = await renderDoc(doc, outFormat, { lang: targetCode });
  return { blob, filename: outName };
}
