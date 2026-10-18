import { readFileSync, statSync } from 'node:fs';
import { listFiles } from './files.mjs';

const { budget } = JSON.parse(readFileSync('tool/policy.json', 'utf8'));
const files = listFiles('dist');
if (!files.length) {
  console.error('✗ cartella dist vuota: eseguire prima npm run build');
  process.exit(2);
}
const html = readFileSync('dist/index.html', 'utf8');
const entry = /src="\.\/(assets\/index-[^"]+\.js)"/.exec(html)?.[1];
const entryKb = entry ? statSync(`dist/${entry}`).size / 1024 : 0;
const totalMb = files.reduce((n, f) => n + statSync(f).size, 0) / 1024 / 1024;
let failed = false;
if (entryKb > budget.mainChunkMaxKilobytes) {
  failed = true;
  console.error(`✗ script principale ${entryKb.toFixed(0)} KB, limite ${budget.mainChunkMaxKilobytes} KB`);
}
if (totalMb > budget.distMaxMegabytes) {
  failed = true;
  console.error(`✗ sito ${totalMb.toFixed(1)} MB, limite ${budget.distMaxMegabytes} MB`);
}
if (failed) process.exit(1);
console.log(`✓ dimensioni: script principale ${entryKb.toFixed(0)} KB, sito ${totalMb.toFixed(1)} MB`);
