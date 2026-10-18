import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkLicenses } from './lib/licenses.mjs';

const policy = JSON.parse(readFileSync('tool/policy.json', 'utf8')).licenses;
const tree = JSON.parse(
  execFileSync('npm', ['ls', '--omit=dev', '--all', '--json', '--long'], { encoding: 'utf8', maxBuffer: 64 << 20 }),
);
const packages = new Map();
const walk = (deps = {}) => {
  for (const [name, info] of Object.entries(deps)) {
    if (!info.path || packages.has(`${name}@${info.version}`)) continue;
    const pkg = JSON.parse(readFileSync(`${info.path}/package.json`, 'utf8'));
    const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type;
    packages.set(`${name}@${info.version}`, { name, version: info.version, license });
    walk(info.dependencies);
  }
};
walk(tree.dependencies);
const problems = checkLicenses([...packages.values()], policy);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error('\nLicenze ammesse e eccezioni: tool/policy.json, docs/dipendenze-e-licenze.md');
  process.exit(1);
}
console.log(`✓ licenze compatibili: ${packages.size} pacchetti di produzione`);
