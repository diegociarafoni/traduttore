import { describe, expect, it } from 'vitest';
import { checkDocs, headingAnchors, headingSlug } from '../../../tool/lib/docs.mjs';

const exists = (files) => (p) => files.includes(p) || files.some((f) => f.startsWith(`${p}/`));

describe('RNF-07 documentazione', () => {
  it('calcola le ancore come GitHub', () => {
    expect(headingSlug('Formati di ingresso e uscita')).toBe('formati-di-ingresso-e-uscita');
    expect(headingSlug('Cos’è `md`?')).toBe('cosè-md');
    expect([...headingAnchors('# A\n## A\n```\n# no\n```')]).toEqual(['a', 'a-1']);
  });

  it('segnala link rotti, ancore, percorsi, indice e mappa', () => {
    const docs = {
      'docs/README.md': '[a](a.md)',
      'docs/a.md':
        '# Titolo\n[ok](#titolo) [no](#altro) [rotto](b.md) [web](https://x.it)\n`src/lib/assente.js` `src/lib/x.js` `esempio [x](y.md)`',
      'docs/c.md': 'non in indice',
      'docs/mappa-del-codice.md': '| `src/lib/` | x |\n| `src/vecchia/` | y |',
    };
    const files = [...Object.keys(docs), 'src/lib/x.js'];
    expect(checkDocs({ docs, exists: exists(files), codeDirs: ['src/lib/', 'src/i18n/'] })).toEqual([
      'docs/a.md:2 ancora inesistente: #altro',
      'docs/a.md:2 link rotto: b.md',
      'docs/a.md:3 percorso inesistente: src/lib/assente.js',
      'docs/mappa-del-codice.md:2 percorso inesistente: src/vecchia/',
      "docs/README.md: c.md non è nell'indice",
      "docs/README.md: mappa-del-codice.md non è nell'indice",
      'docs/mappa-del-codice.md: manca la riga per `src/i18n/`',
      'docs/mappa-del-codice.md: la cartella `src/vecchia/` non esiste più',
    ]);
  });
});
