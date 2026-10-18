import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, renderMarkdown } from '../../src/lib/formats/markdown.js';
import { parseText, renderText } from '../../src/lib/formats/text.js';
import { parseDocx, renderDocx, translateDocxInPlace } from '../../src/lib/formats/docx.js';
import { parseEpub, renderEpub, translateEpubInPlace } from '../../src/lib/formats/epub.js';
import { layoutToBlocks, renderPdf } from '../../src/lib/formats/pdf.js';
import { applySegments, collectSegments } from '../../src/lib/model.js';
import { formatFromName, translateFile } from '../../src/lib/pipeline.js';
import { blobToZip, fakeTranslate, fakeTranslateAll } from './helpers.js';

const MD = `# Introduction

This is a paragraph with **bold** text and a [link](https://example.com).

- First item
- Second item

| Name | Value |
| --- | --- |
| a | 1 |

\`\`\`js
const Hello = 1;
\`\`\`
`;

const sample = () => ({
  title: 'Hello world',
  name: 'sample',
  chapters: [
    {
      title: 'Chapter one',
      blocks: [
        { type: 'heading', level: 1, text: 'Chapter one' },
        { type: 'paragraph', text: 'This is a paragraph with **bold** text.' },
        { type: 'list', ordered: false, items: ['First item', 'Second item'] },
        {
          type: 'table',
          rows: [
            ['Name', 'Value'],
            ['a', '1'],
          ],
        },
      ],
    },
    { title: 'Chapter two', blocks: [{ type: 'paragraph', text: 'Hello world' }] },
  ],
});

describe('RF-05 Markdown', () => {
  it('conserva la struttura in andata e ritorno', async () => {
    const doc = parseMarkdown(MD);
    expect(doc.chapters[0].blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'table', 'code']);
    const out = await renderMarkdown(doc).text();
    expect(out).toContain('# Introduction');
    expect(out).toContain('**bold**');
    expect(out).toContain('- Second item');
    expect(out).toContain('| Name | Value |');
    expect(out).toContain('```js\nconst Hello = 1;\n```');
  });

  it('RF-13 non traduce i blocchi di codice', () => {
    const segs = collectSegments(parseMarkdown(MD));
    expect(segs.some((s) => s.includes('const'))).toBe(false);
  });
});

describe('RF-05 testo semplice', () => {
  it('riconosce paragrafi ed elenchi', async () => {
    const doc = parseText('Riga uno\ncontinua.\n\n- a\n- b\n');
    expect(doc.chapters[0].blocks).toEqual([
      { type: 'paragraph', text: 'Riga uno continua.', plain: true },
      { type: 'list', ordered: false, items: ['a', 'b'], plain: true },
    ]);
    expect(await renderText(doc).text()).toBe('Riga uno continua.\n\n- a\n- b\n');
  });
});

describe('RF-06 RF-08 Word', () => {
  it('genera un docx che si rilegge con la stessa struttura', async () => {
    const blob = await renderDocx(sample());
    const doc = await parseDocx(await blob.arrayBuffer());
    const types = doc.chapters[0].blocks.map((b) => b.type);
    expect(types).toContain('heading');
    expect(types).toContain('list');
    expect(types).toContain('table');
    const para = doc.chapters[0].blocks.find((b) => b.type === 'paragraph' && b.text.includes('paragraph'));
    expect(para.text).toContain('**bold**');
  });

  it('traduce sul posto mantenendo la formattazione dei run', async () => {
    const source = await renderDocx(sample());
    const seen = [];
    const out = await translateDocxInPlace(
      await source.arrayBuffer(),
      async (segs) => {
        seen.push(...segs);
        return segs.map(fakeTranslate);
      },
      { targetCode: 'it' },
    );
    expect(seen.some((s) => /<1>.*<\/1><2>bold<\/2>/.test(s))).toBe(true);
    const xml = await (await blobToZip(out)).file('word/document.xml').async('string');
    expect(xml).toContain('Questo è un paragrafo');
    expect(xml).toContain('grassetto');
    expect(xml).not.toContain('This is a paragraph');
    const reparsed = await parseDocx(await out.arrayBuffer());
    const para = reparsed.chapters[0].blocks.find((b) => b.text?.includes('paragrafo'));
    expect(para.text).toContain('**grassetto**');
  });

  it('ricade sul testo semplice se il modello perde i tag', async () => {
    const source = await renderDocx(sample());
    const out = await translateDocxInPlace(await source.arrayBuffer(), async (segs) =>
      segs.map((s) => fakeTranslate(s.replace(/<\/?\d+>/g, ''))),
    );
    const xml = await (await blobToZip(out)).file('word/document.xml').async('string');
    expect(xml).toContain('Questo è un paragrafo with grassetto text.');
  });
});

describe('RF-06 RF-08 EPUB', () => {
  it('genera un EPUB valido e lo rilegge', async () => {
    const blob = await renderEpub(sample(), { lang: 'it' });
    const zip = await blobToZip(blob);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    const doc = await parseEpub(await blob.arrayBuffer());
    expect(doc.title).toBe('Hello world');
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0].blocks.find((b) => b.type === 'list').items).toEqual(['First item', 'Second item']);
  });

  it('traduce sul posto mantenendo elementi in linea, indice e metadati', async () => {
    const source = await renderEpub(sample(), { lang: 'en' });
    const out = await translateEpubInPlace(await source.arrayBuffer(), fakeTranslateAll, { targetCode: 'it' });
    const zip = await blobToZip(out);
    const ch1 = await zip.file('OEBPS/chapter-001.xhtml').async('string');
    expect(ch1).toContain('<strong>grassetto</strong>');
    expect(ch1).toContain('Questo è un paragrafo');
    expect(ch1).toContain('lang="it"');
    const opf = await zip.file('OEBPS/content.opf').async('string');
    expect(opf).toContain('<dc:title>Ciao mondo</dc:title>');
    expect(opf).toContain('<dc:language>it</dc:language>');
    const ncx = await zip.file('OEBPS/toc.ncx').async('string');
    expect(ncx).toContain('Capitolo one');
  });
});

describe('RF-07 RF-08 PDF', () => {
  it('ricostruisce titoli, paragrafi ed elenchi dalle posizioni', () => {
    const it = (str, x, y, size = 10) => ({ str, x, y, size, width: str.length * size * 0.5 });
    const blocks = layoutToBlocks([
      [
        it('Big title', 50, 800, 20),
        it('First line of a para-', 50, 760),
        it('graph continues here.', 50, 748),
        it('Second paragraph.', 50, 710),
        it('• one', 50, 690),
        it('• two', 50, 678),
        it('3', 300, 40),
      ],
    ]);
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'Big title', plain: true },
      { type: 'paragraph', text: 'First line of a paragraph continues here.', plain: true },
      { type: 'paragraph', text: 'Second paragraph.', plain: true },
      { type: 'list', ordered: false, items: ['one', 'two'], plain: true },
    ]);
  });

  it('genera un PDF con caratteri accentati', async () => {
    const dir = 'node_modules/dejavu-fonts-ttf/ttf/';
    const b64 = (f) => readFileSync(dir + f).toString('base64');
    const fonts = {
      normal: b64('DejaVuSans.ttf'),
      bold: b64('DejaVuSans-Bold.ttf'),
      italic: b64('DejaVuSans-Oblique.ttf'),
      bolditalic: b64('DejaVuSans-BoldOblique.ttf'),
      mono: b64('DejaVuSansMono.ttf'),
    };
    const doc = sample();
    applySegments(doc, collectSegments(doc).map(fakeTranslate));
    const blob = await renderPdf(doc, { fonts });
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe('RF-04 RF-08 pipeline', () => {
  it('riconosce il formato dal nome del file', () => {
    expect(formatFromName('a.MD')).toBe('md');
    expect(formatFromName('a.markdown')).toBe('md');
    expect(formatFromName('a.odt')).toBeNull();
  });

  it('converte Markdown in EPUB traducendo il testo', async () => {
    const buffer = new TextEncoder().encode(MD).buffer;
    const { blob, filename } = await translateFile({
      buffer,
      name: 'guida.md',
      inFormat: 'md',
      outFormat: 'epub',
      translateAll: fakeTranslateAll,
      targetCode: 'it',
    });
    expect(filename).toBe('guida.it.epub');
    const doc = await parseEpub(await blob.arrayBuffer());
    const blocks = doc.chapters.flatMap((c) => c.blocks);
    expect(blocks[0]).toMatchObject({ type: 'heading', text: 'Introduzione' });
    expect(blocks.find((b) => b.type === 'list').items).toEqual(['Primo elemento', 'Secondo elemento']);
  });

  it('traduce Markdown in Markdown', async () => {
    const buffer = new TextEncoder().encode(MD).buffer;
    const { blob } = await translateFile({
      buffer,
      name: 'g.md',
      inFormat: 'md',
      outFormat: 'md',
      translateAll: fakeTranslateAll,
      targetCode: 'it',
    });
    const out = await blob.text();
    expect(out).toContain('# Introduzione');
    expect(out).toContain('Questo è un paragrafo with **grassetto** text and a [link](https://example.com).');
  });
});
