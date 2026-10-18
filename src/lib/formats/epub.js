import JSZip from 'jszip';
import { htmlToBlocks } from '../model.js';
import { t } from '../../i18n/index.js';
import { inlineToHtml, parseInline } from '../inline.js';
import { escapeText, parseTagged, stripTags, collectIds, sameIds } from '../tagged.js';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XHTML_TYPES = new Set(['application/xhtml+xml', 'text/html']);

function resolve(base, href) {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const parts = (dir + decodeURIComponent(href.split('#')[0])).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

async function openPackage(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error(t('error.epubNoContainer'));
  const cdoc = new DOMParser().parseFromString(await container.async('string'), 'application/xml');
  const opfPath = cdoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error(t('error.epubNoOpf'));
  const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('string'), 'application/xml');
  const manifest = new Map();
  for (const item of opf.getElementsByTagName('item')) {
    manifest.set(item.getAttribute('id'), {
      href: resolve(opfPath, item.getAttribute('href')),
      type: item.getAttribute('media-type'),
      properties: item.getAttribute('properties') || '',
    });
  }
  const spine = [...opf.getElementsByTagName('itemref')]
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((it) => it && XHTML_TYPES.has(it.type));
  return { zip, opf, opfPath, manifest, spine };
}

function parseXhtml(text) {
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');
  return doc;
}

function metaTitle(opf) {
  const t = opf.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0];
  return t ? t.textContent.trim() : '';
}

export async function parseEpub(buffer, name = t('doc.untitled')) {
  const { zip, opf, spine } = await openPackage(buffer);
  const chapters = [];
  for (const item of spine) {
    const file = zip.file(item.href);
    if (!file) continue;
    const doc = parseXhtml(await file.async('string'));
    const body = doc.getElementsByTagName('body')[0];
    if (!body) continue;
    const blocks = htmlToBlocks(body);
    if (!blocks.length) continue;
    const heading = blocks.find((b) => b.type === 'heading');
    chapters.push({ title: heading ? heading.text : '', blocks });
  }
  return { title: metaTitle(opf), name, chapters };
}

// ---------- Esportazione da modello documento ----------

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function textHtml(text, plain) {
  return plain ? xmlEsc(text) : inlineToHtml(text);
}

function blockHtml(b) {
  const t = (s) => textHtml(s, b.plain);
  switch (b.type) {
    case 'heading':
      return `<h${Math.min(b.level, 6)}>${t(b.text)}</h${Math.min(b.level, 6)}>`;
    case 'paragraph':
      return `<p>${t(b.text)}</p>`;
    case 'quote':
      return `<blockquote><p>${t(b.text)}</p></blockquote>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((it) => `<li>${t(it)}</li>`).join('')}</${tag}>`;
    }
    case 'code':
      return `<pre><code>${xmlEsc(b.text)}</code></pre>`;
    case 'hr':
      return '<hr/>';
    case 'table':
      return `<table>${b.rows
        .map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${t(c)}</th>` : `<td>${t(c)}</td>`)).join('')}</tr>`)
        .join('')}</table>`;
    default:
      return '';
  }
}

const plainTitle = (s) =>
  parseInline(s)
    .map((r) => r.text)
    .join('');

function xhtmlPage(title, body, lang) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`;
}

const CSS = `body{font-family:serif;line-height:1.5;margin:0 5%}h1,h2,h3{font-family:sans-serif;line-height:1.2}
blockquote{margin-left:1.5em;font-style:italic}pre{white-space:pre-wrap;font-size:.85em;background:#f4f4f4;padding:.5em}
table{border-collapse:collapse}td,th{border:1px solid #999;padding:.2em .4em}`;

export async function renderEpub(doc, { lang = 'it' } = {}) {
  const zip = new JSZip();
  const title = plainTitle(doc.title || doc.name || t('doc.untitled'));
  const id = `urn:uuid:${crypto.randomUUID()}`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  zip.file('OEBPS/style.css', CSS);
  const chapters = doc.chapters.length ? doc.chapters : [{ title: '', blocks: [] }];
  const entries = chapters.map((ch, i) => {
    const chTitle = plainTitle(ch.title || '') || (chapters.length === 1 ? title : t('doc.chapter', { n: i + 1 }));
    const file = `chapter-${String(i + 1).padStart(3, '0')}.xhtml`;
    const startsWithHeading = ch.blocks[0]?.type === 'heading';
    const head = !startsWithHeading && ch.title ? `<h1>${inlineToHtml(ch.title)}</h1>\n` : '';
    zip.file(`OEBPS/${file}`, xhtmlPage(chTitle, head + ch.blocks.map(blockHtml).join('\n'), lang));
    return { file, title: chTitle, id: `c${i + 1}` };
  });
  zip.file(
    'OEBPS/nav.xhtml',
    xhtmlPage(
      title,
      `<nav epub:type="toc" id="toc"><h1>${t('doc.toc')}</h1><ol>${entries
        .map((e) => `<li><a href="${e.file}">${xmlEsc(e.title)}</a></li>`)
        .join('')}</ol></nav>`,
      lang,
    ),
  );
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${id}"/></head>
<docTitle><text>${xmlEsc(title)}</text></docTitle>
<navMap>${entries
      .map(
        (e, i) =>
          `<navPoint id="${e.id}" playOrder="${i + 1}"><navLabel><text>${xmlEsc(e.title)}</text></navLabel><content src="${e.file}"/></navPoint>`,
      )
      .join('')}</navMap>
</ncx>`,
  );
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${id}</dc:identifier>
<dc:title>${xmlEsc(title)}</dc:title>
<dc:language>${lang}</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
${entries.map((e) => `<item id="${e.id}" href="${e.file}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine toc="ncx">
${entries.map((e) => `<itemref idref="${e.id}"/>`).join('\n')}
</spine>
</package>`,
  );
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

// ---------- Traduzione "sul posto" (epub -> epub) ----------
// Si traducono i blocchi "foglia" di ogni pagina XHTML; gli elementi in linea
// (em, strong, a, span, br, img ...) diventano tag numerati e vengono ricostruiti
// clonando gli originali, così stili, link e immagini restano invariati.

const BLOCKS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'td',
  'th',
  'dt',
  'dd',
  'blockquote',
  'figcaption',
  'caption',
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'ol',
  'ul',
  'table',
  'tr',
  'tbody',
  'thead',
  'figure',
  'body',
  'title',
  'pre',
  'dl',
  'main',
  'hr',
]);
const SKIP = new Set(['script', 'style', 'pre', 'code', 'svg', 'math']);
const VOID = new Set(['br', 'img', 'hr', 'wbr', 'input']);

const lname = (el) => el.localName.toLowerCase();

function isLeafBlock(el) {
  if (!BLOCKS.has(lname(el)) || SKIP.has(lname(el))) return false;
  for (const c of el.getElementsByTagName('*')) if (BLOCKS.has(lname(c))) return false;
  return el.textContent.trim().length > 0;
}

function encode(el, map) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out += escapeText(node.nodeValue);
    else if (node.nodeType === 1) {
      const id = map.length + 1;
      map.push(node);
      if (VOID.has(lname(node)) || SKIP.has(lname(node))) out += `<${id}/>`;
      else out += `<${id}>${encode(node, map)}</${id}>`;
    }
  }
  return out;
}

function rebuild(target, nodes, map, used) {
  for (const n of nodes) {
    if (n.type === 'text') target.appendChild(target.ownerDocument.createTextNode(n.text));
    else {
      const orig = map[n.id - 1];
      if (used.has(n.id)) continue;
      used.add(n.id);
      if (VOID.has(lname(orig)) || SKIP.has(lname(orig))) {
        target.appendChild(orig.cloneNode(true));
      } else {
        const clone = orig.cloneNode(false);
        rebuild(clone, n.children, map, used);
        target.appendChild(clone);
      }
    }
  }
}

function collectUnits(doc) {
  const units = [];
  const title = doc.getElementsByTagName('title')[0];
  if (title && title.textContent.trim()) units.push({ el: title, map: [], segment: escapeText(title.textContent) });
  const body = doc.getElementsByTagName('body')[0];
  if (!body) return units;
  const walk = (el) => {
    for (const c of el.children) {
      if (SKIP.has(lname(c))) continue;
      if (isLeafBlock(c)) {
        const map = [];
        units.push({ el: c, map, segment: encode(c, map) });
      } else walk(c);
    }
  };
  walk(body);
  return units;
}

function applyUnit(unit, translated) {
  const { el, map } = unit;
  const tree = parseTagged(translated);
  const expected = map.map((_, i) => i + 1);
  while (el.firstChild) el.removeChild(el.firstChild);
  if (tree && sameIds(collectIds(tree), expected)) {
    rebuild(el, tree, map, new Set());
  } else {
    el.appendChild(el.ownerDocument.createTextNode(stripTags(translated)));
  }
}

export async function translateEpubInPlace(buffer, translateAll, { targetCode } = {}) {
  const { zip, opf, opfPath, manifest } = await openPackage(buffer);
  const pages = [];
  for (const item of manifest.values()) {
    if (!XHTML_TYPES.has(item.type) || !zip.file(item.href)) continue;
    const text = await zip.file(item.href).async('string');
    const doc = parseXhtml(text);
    pages.push({ item, doc, units: collectUnits(doc), xml: doc.documentElement.namespaceURI === XHTML_NS });
  }
  const ncxItem = [...manifest.values()].find((i) => i.type === 'application/x-dtbncx+xml');
  let ncx = null;
  if (ncxItem && zip.file(ncxItem.href)) {
    const ndoc = new DOMParser().parseFromString(await zip.file(ncxItem.href).async('string'), 'application/xml');
    ncx = {
      doc: ndoc,
      units: [...ndoc.getElementsByTagName('text')]
        .filter((t) => t.textContent.trim())
        .map((el) => ({ el, map: [], segment: escapeText(el.textContent) })),
    };
  }
  const dcTitles = [...opf.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')].map((el) => ({
    el,
    map: [],
    segment: escapeText(el.textContent),
  }));

  const all = [...pages.flatMap((p) => p.units), ...(ncx ? ncx.units : []), ...dcTitles];
  const translated = await translateAll(all.map((u) => u.segment));
  all.forEach((u, i) => applyUnit(u, translated[i]));

  const ser = new XMLSerializer();
  for (const p of pages) {
    if (targetCode) {
      const html = p.doc.documentElement;
      if (html.hasAttribute('lang')) html.setAttribute('lang', targetCode);
      if (html.hasAttribute('xml:lang')) html.setAttribute('xml:lang', targetCode);
    }
    let out = ser.serializeToString(p.doc);
    if (!out.startsWith('<?xml')) out = `<?xml version="1.0" encoding="utf-8"?>\n${out}`;
    zip.file(p.item.href, out);
  }
  if (ncx) zip.file(ncxItem.href, ser.serializeToString(ncx.doc));
  if (targetCode) {
    for (const l of opf.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'language'))
      l.textContent = targetCode;
  }
  zip.file(opfPath, ser.serializeToString(opf));

  // Il file "mimetype" deve essere il primo e non compresso.
  const out = new JSZip();
  out.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  for (const [path, f] of Object.entries(zip.files)) {
    if (path === 'mimetype' || f.dir) continue;
    out.file(path, await f.async('uint8array'));
  }
  return out.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

export async function epubSegmentsPreview(buffer) {
  const { zip, spine } = await openPackage(buffer);
  const segs = [];
  for (const item of spine.slice(0, 8)) {
    const f = zip.file(item.href);
    if (f) segs.push(...collectUnits(parseXhtml(await f.async('string'))).map((u) => u.segment));
  }
  return segs;
}
