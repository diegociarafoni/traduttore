import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectFile, parseFile, renderDoc, translateFile } from '../../src/lib/pipeline.js';
import { htmlToBlocks, documentText } from '../../src/lib/model.js';
import { parseDocx, renderDocx } from '../../src/lib/formats/docx.js';
import { parseEpub, renderEpub } from '../../src/lib/formats/epub.js';
import { NoTextLayerError, renderPdf } from '../../src/lib/formats/pdf.js';
import { translateDom, t } from '../../src/i18n/index.js';
import { fakeTranslateAll } from './helpers.js';

const rich = () => ({
  title: 'Hello world',
  name: 'ricco',
  chapters: [
    {
      title: 'Introduction',
      blocks: [
        { type: 'heading', level: 2, text: 'Introduction' },
        {
          type: 'paragraph',
          text: 'This is a paragraph with *italic*, `code`, ![logo](a.png) and [link](https://e.it).',
        },
        { type: 'quote', text: 'Hello quote' },
        { type: 'list', ordered: true, start: 3, items: ['First item', 'Second item'] },
        { type: 'code', text: 'let a = 1;\nlet b = 2;' },
        { type: 'hr' },
        {
          type: 'table',
          rows: [
            ['Name', 'Value'],
            ['x', '1'],
          ],
        },
      ],
    },
    { title: 'Chapter two', blocks: [{ type: 'paragraph', text: 'Hello world', plain: true }] },
  ],
});

const fonts = () => {
  const dir = 'node_modules/dejavu-fonts-ttf/ttf/';
  const b64 = (f) => readFileSync(dir + f).toString('base64');
  return {
    normal: b64('DejaVuSans.ttf'),
    bold: b64('DejaVuSans-Bold.ttf'),
    italic: b64('DejaVuSans-Oblique.ttf'),
    bolditalic: b64('DejaVuSans-BoldOblique.ttf'),
    mono: b64('DejaVuSansMono.ttf'),
  };
};

describe('RF-08 conversione verso ogni formato di uscita', () => {
  it('Markdown con citazioni, elenchi numerati, codice, righe e tabelle', async () => {
    const md = await (await renderDoc(rich(), 'md')).text();
    expect(md).toContain('# Hello world');
    expect(md).toContain('# Chapter two');
    expect(md).toContain('> Hello quote');
    expect(md).toContain('3. First item\n4. Second item');
    expect(md).toContain('```\nlet a = 1;');
    expect(md).toContain('---');
  });

  it('testo semplice senza segni di formattazione', async () => {
    const txt = await (await renderDoc(rich(), 'txt')).text();
    expect(txt).toContain('HELLO WORLD');
    expect(txt).toContain('This is a paragraph with italic, code, [logo] and link.');
    expect(txt).toContain('Name\tValue');
    expect(txt).toContain('* * *');
  });

  it('Word ed EPUB rileggibili', async () => {
    const docx = await parseDocx(await (await renderDoc(rich(), 'docx')).arrayBuffer());
    const text = documentText(docx);
    expect(text).toContain('Hello quote');
    expect(text).toContain('let a = 1;');
    const epub = await parseEpub(await (await renderDoc(rich(), 'epub', { lang: 'it' })).arrayBuffer());
    expect(epub.chapters.map((c) => c.title)).toEqual(['Introduction', 'Chapter two']);
    expect(epub.chapters[0].blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'code',
      'hr',
      'table',
    ]);
  });

  it('PDF con tutti i tipi di blocco e testi lunghi', async () => {
    const doc = rich();
    doc.chapters[1].blocks.push({ type: 'paragraph', text: `${'parola '.repeat(800)}${'x'.repeat(300)}` });
    const blob = await renderPdf(doc, { fonts: fonts() });
    expect(blob.size).toBeGreaterThan(5000);
  });

  it('formato sconosciuto', async () => {
    await expect(renderDoc(rich(), 'odt')).rejects.toThrow('odt');
    await expect(parseFile(new ArrayBuffer(0), 'odt', 'x')).rejects.toThrow('odt');
  });
});

describe('RF-02 RF-10 analisi preliminare del file', () => {
  it('estrae i segmenti di md, txt, docx ed epub', async () => {
    const enc = (s) => new TextEncoder().encode(s).buffer;
    expect((await inspectFile(enc('﻿# Ciao\n\nTesto'), 'md', 'a.md')).segments).toEqual(['Ciao', 'Testo']);
    expect((await inspectFile(enc('Uno\n\nDue'), 'txt', 'a.txt')).segments).toEqual(['Uno', 'Due']);
    const docx = await (await renderDocx(rich())).arrayBuffer();
    expect((await inspectFile(docx, 'docx', 'a.docx')).segments).toContain('Hello quote');
    const epub = await (await renderEpub(rich())).arrayBuffer();
    expect((await inspectFile(epub, 'epub', 'a.epub')).segments).toContain('Hello quote');
  });

  it('segnala file danneggiati', async () => {
    const JSZip = (await import('jszip')).default;
    const empty = await new JSZip().file('a.txt', 'x').generateAsync({ type: 'arraybuffer' });
    await expect(inspectFile(empty, 'docx', 'a.docx')).rejects.toThrow(t('error.docxInvalid'));
    await expect(inspectFile(empty, 'epub', 'a.epub')).rejects.toThrow(t('error.epubNoContainer'));
  });

  it('RF-07 il PDF senza testo ha un messaggio dedicato', () => {
    expect(new NoTextLayerError().message).toBe(t('error.pdfNoText'));
  });
});

describe('RF-06 traduzione sul posto tramite la pipeline', () => {
  it('docx e epub mantengono il formato e il nome indica la lingua', async () => {
    const docx = await (await renderDocx(rich())).arrayBuffer();
    const r1 = await translateFile({
      buffer: docx,
      name: 'a.docx',
      inFormat: 'docx',
      outFormat: 'docx',
      translateAll: fakeTranslateAll,
      targetCode: 'it',
    });
    expect(r1.filename).toBe('a.it.docx');
    expect(documentText(await parseDocx(await r1.blob.arrayBuffer()))).toContain('Introduzione');
    const epub = await (await renderEpub(rich())).arrayBuffer();
    const r2 = await translateFile({
      buffer: epub,
      name: 'b.epub',
      inFormat: 'epub',
      outFormat: 'epub',
      translateAll: fakeTranslateAll,
      targetCode: 'it',
    });
    expect(r2.filename).toBe('b.it.epub');
    expect(documentText(await parseEpub(await r2.blob.arrayBuffer()))).toContain('Primo elemento');
  });
});

describe('RF-05 struttura da HTML', () => {
  it('riconosce blocchi annidati, citazioni, codice e testo sciolto', () => {
    const div = document.createElement('div');
    div.innerHTML =
      'sciolto<section><h3>T</h3><blockquote><p>a</p><p>b</p></blockquote><pre>x\n</pre><hr><dl><dt>k</dt><dd>v</dd></dl>' +
      '<ul><li>u</li></ul><ol><li>o</li></ol><span>in linea</span><script>no()</script><div>d</div></section>';
    expect(htmlToBlocks(div)).toEqual([
      { type: 'paragraph', text: 'sciolto' },
      { type: 'heading', level: 3, text: 'T' },
      { type: 'quote', text: 'a b' },
      { type: 'code', text: 'x' },
      { type: 'hr' },
      { type: 'paragraph', text: 'k' },
      { type: 'paragraph', text: 'v' },
      { type: 'list', ordered: false, items: ['u'] },
      { type: 'list', ordered: true, items: ['o'] },
      { type: 'paragraph', text: 'in linea' },
      { type: 'paragraph', text: 'd' },
    ]);
  });
});

describe('RNF-03 testi applicati alla pagina', () => {
  it('compila contenuti e attributi da data-i18n', () => {
    document.body.innerHTML = '<p data-i18n="run.translate"></p><input data-i18n-placeholder="key.label">';
    translateDom(document);
    expect(document.querySelector('p').textContent).toBe('Traduci');
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('Chiave API Anthropic');
    expect(document.title).toBe(t('app.title'));
  });
});
