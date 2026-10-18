import { mkdirSync, writeFileSync } from 'node:fs';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { FIXTURES } from './fixtures.js';

const EN = 'The translation service keeps the structure of the original document intact.';

async function docx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('User guide')] }),
          new Paragraph({
            children: [
              new TextRun(`${EN} `),
              new TextRun({ text: 'Bold words', bold: true }),
              new TextRun(' stay bold.'),
            ],
          }),
        ],
      },
    ],
  });
  return Buffer.from(await (await Packer.toBlob(doc)).arrayBuffer());
}

async function epub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/content.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">x</dc:identifier><dc:title>Short story</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>',
  );
  zip.file(
    'OEBPS/c1.xhtml',
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Chapter one</title></head><body><h1>Chapter one</h1><p>${EN} <em>Italic words</em> remain italic.</p></body></html>`,
  );
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

function pdf(withText) {
  const doc = new jsPDF();
  if (withText) {
    doc.setFontSize(22);
    doc.text('Annual report', 20, 30);
    doc.setFontSize(11);
    doc.text(EN, 20, 50);
    doc.text('The second paragraph explains the results of the year in detail.', 20, 70);
  } else {
    doc.rect(20, 20, 100, 60, 'F');
  }
  return Buffer.from(doc.output('arraybuffer'));
}

export default async function globalSetup() {
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(`${FIXTURES}/guida.md`, `# User guide\n\n${EN}\n\n- First item\n- Second item\n`);
  writeFileSync(`${FIXTURES}/note.txt`, `${EN}\n\nThe second paragraph explains the results of the year in detail.\n`);
  writeFileSync(`${FIXTURES}/guida.docx`, await docx());
  writeFileSync(`${FIXTURES}/racconto.epub`, await epub());
  writeFileSync(`${FIXTURES}/relazione.pdf`, pdf(true));
  writeFileSync(`${FIXTURES}/scansione.pdf`, pdf(false));
  writeFileSync(`${FIXTURES}/foglio.odt`, 'x');
}
