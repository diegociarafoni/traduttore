import JSZip from 'jszip';

const DICT = [
  ['Hello', 'Ciao'],
  ['world', 'mondo'],
  ['Introduction', 'Introduzione'],
  ['First item', 'Primo elemento'],
  ['Second item', 'Secondo elemento'],
  ['This is a paragraph', 'Questo è un paragrafo'],
  ['bold', 'grassetto'],
  ['Chapter', 'Capitolo'],
  ['Name', 'Nome'],
  ['Value', 'Valore'],
];

export function fakeTranslate(text) {
  let out = text;
  for (const [a, b] of DICT) out = out.split(a).join(b);
  return out;
}

export const fakeTranslateAll = async (segments) => segments.map(fakeTranslate);

export async function blobToZip(blob) {
  return JSZip.loadAsync(await blob.arrayBuffer());
}
