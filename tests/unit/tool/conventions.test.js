import { describe, expect, it } from 'vitest';
import { hasClaudeAttribution, isClaudeIdentity, validateCommitMessage } from '../../../tool/lib/commit-message.mjs';
import { pushedBranches, validateBranchName } from '../../../tool/lib/branch-name.mjs';
import { checkComments } from '../../../tool/lib/comments.mjs';
import { checkLicenses, spdxAlternatives } from '../../../tool/lib/licenses.mjs';
import { checkCatalogParts, checkI18n, hardcodedTexts } from '../../../tool/lib/i18n.mjs';
import { checkTestNames } from '../../../tool/lib/test-names.mjs';

describe('RNF-05 messaggi di commit secondo la convenzione Angular', () => {
  it('accetta messaggi validi', () => {
    expect(validateCommitMessage('feat(pdf): estrazione del testo')).toEqual([]);
    expect(validateCommitMessage('fix: PDF senza testo')).toEqual([]);
    expect(validateCommitMessage('feat!: nuovo formato\n\ncorpo')).toEqual([]);
    expect(validateCommitMessage('chore(main): release 1.2.0')).toEqual([]);
  });

  it('rifiuta tipo, maiuscola, punto finale e corpo attaccato', () => {
    expect(validateCommitMessage('chore: x')[0]).toContain('tipo "chore"');
    expect(validateCommitMessage('feat: Aggiunge')).toContain('la descrizione inizia con la minuscola');
    expect(validateCommitMessage('feat: aggiunge.')).toContain('la descrizione non termina con il punto');
    expect(validateCommitMessage('feat: a\ncorpo')).toContain('serve una riga vuota tra intestazione e corpo');
    expect(validateCommitMessage('aggiunge cose')[0]).toContain('formato atteso');
  });

  it('ammette merge e fixup nei commit del ramo ma non nel titolo della PR', () => {
    expect(validateCommitMessage("Merge branch 'main' into feat/x")).toEqual([]);
    expect(validateCommitMessage('fixup! feat: a')).toEqual([]);
    expect(validateCommitMessage('fixup! feat: a', 'title')).not.toEqual([]);
  });

  it('ignora i commenti di git nel file del hook', () => {
    expect(validateCommitMessage('feat: a\n# commento di git', 'editor')).toEqual([]);
  });

  it("rifiuta l'attribuzione e l'identità di Claude", () => {
    expect(validateCommitMessage('feat: a\n\nCo-Authored-By: Claude <noreply@anthropic.com>')[0]).toContain(
      'attribuzione',
    );
    expect(hasClaudeAttribution('🤖 Generated with [Claude Code](https://claude.com/claude-code)')).toBe(true);
    expect(hasClaudeAttribution('Before: niente\nAfter: tutto')).toBe(false);
    expect(isClaudeIdentity('Claude', 'x@example.com')).toBe(true);
    expect(isClaudeIdentity('Diego', 'noreply@anthropic.com')).toBe(true);
    expect(isClaudeIdentity('Claudia', 'c@example.com')).toBe(false);
  });
});

describe('RNF-05 nomi dei rami', () => {
  it('accetta tipo/descrizione e i rami automatici', () => {
    expect(validateBranchName('feat/prima-versione')).toBeNull();
    expect(validateBranchName('dependabot/npm_and_yarn/vite-8')).toBeNull();
    expect(validateBranchName('release-please--branches--main')).toBeNull();
  });

  it('rifiuta main, claude/ e maiuscole', () => {
    expect(validateBranchName('main')).toContain('direttamente');
    expect(validateBranchName('claude/abc')).toContain('non segue');
    expect(validateBranchName('feat/Nuovo')).toContain('non segue');
  });

  it("legge i rami di destinazione dall'input di pre-push", () => {
    const input =
      'refs/heads/a 1111 refs/heads/main 0000\nrefs/heads/a 0000000 refs/heads/x 1111\nrefs/tags/v1 22 refs/tags/v1 0\n';
    expect(pushedBranches(input)).toEqual(['main']);
  });
});

describe('RNF-05 commenti nel codice', () => {
  it('segnala rimandi a PR e promemoria senza motivo', () => {
    const problems = checkComments({
      'a.js':
        '// vedi PR #12\n// TODO\n// TODO: gestire gli allegati che oggi vengono ignorati\n// fonte https://x/PR/1\nconst x = 1; // TODO',
    });
    expect(problems).toEqual([
      "a.js:1: il commento rimanda a una PR o a un'issue",
      'a.js:2: promemoria senza motivo, scrivi "TODO: " e almeno una frase che dica cosa manca',
    ]);
  });
});

describe('RNF-06 licenze delle dipendenze', () => {
  const policy = { allowed: ['MIT', 'Apache-2.0', 'GPL-3.0'], overrides: { x: { license: 'MIT' } } };

  it('interpreta le espressioni SPDX', () => {
    expect(spdxAlternatives('(MIT OR GPL-3.0-or-later)')).toEqual([['MIT'], ['GPL-3.0-or-later']]);
    expect(spdxAlternatives('Apache-2.0 AND MIT')).toEqual([['Apache-2.0', 'MIT']]);
  });

  it('accetta licenze ammesse, alternative ed eccezioni documentate', () => {
    const pkgs = [
      { name: 'a', version: '1', license: 'MIT' },
      { name: 'b', version: '1', license: '(BSD-4-Clause OR GPL-3.0-or-later)' },
      { name: 'x', version: '1', license: 'BSD' },
    ];
    expect(checkLicenses(pkgs, policy)).toEqual([]);
  });

  it('rifiuta licenze non ammesse o assenti', () => {
    const pkgs = [
      { name: 'c', version: '2', license: 'AGPL-3.0' },
      { name: 'd', version: '3', license: undefined },
    ];
    expect(checkLicenses(pkgs, policy)).toEqual(['c@2: licenza "AGPL-3.0" non ammessa', 'd@3: licenza non dichiarata']);
  });
});

describe('RNF-03 catalogo dei testi', () => {
  it('segnala chiavi mancanti e inutilizzate', () => {
    const sources = { 'a.js': 't(\'a.uno\'); t("a.due")', 'index.html': '<p data-i18n="a.tre"></p>' };
    const catalog = { 'a.uno': '1', 'a.tre': '3', 'a.zero': '0', 'lang.it': 'Italiano' };
    expect(checkI18n(sources, catalog)).toEqual([
      'a.js: chiave "a.due" assente dal catalogo',
      'catalogo: chiave "a.zero" non usata',
    ]);
  });
});

describe('RNF-03 catalogo diviso per funzione e testi nel codice', () => {
  it('accetta in ogni file solo le chiavi della sua area, senza doppioni', () => {
    const areas = { app: ['app.'], errori: ['error.'] };
    const parts = {
      'it/app.json': { 'app.title': 'T', 'error.x': 'E' },
      'it/errori.json': { 'error.x': 'E' },
      'it/altro.json': {},
    };
    expect(checkCatalogParts(parts, areas)).toEqual([
      'it/app.json: chiave "error.x" fuori dall\'area app',
      'it/errori.json: chiave "error.x" già in it/app.json',
      'it/altro.json: area "altro" non prevista in tool/policy.json',
    ]);
  });

  it('trova le frasi scritte nel codice, ignorando chiavi, percorsi, markup e commenti', () => {
    const sources = {
      'a.js': [
        '// Commento con più parole',
        "t('error.quota'); fetch('https://x.it/a b');",
        'const html = `<p>${x} testo</p>`;',
        "throw new Error('Formato non supportato');",
        'const m = `Scarica ${file} adesso`;',
      ].join('\n'),
    };
    expect(hardcodedTexts(sources)).toEqual(["a.js: 'Formato non supportato'", 'a.js: `Scarica ${file} adesso`']);
  });
});

describe('RNF-05 nomi dei test con codice di requisito', () => {
  const code = '\\bRN?F-\\d{2,}\\b';
  it('richiede il codice nel gruppo, o nel test se non ci sono gruppi', () => {
    const sources = {
      'a.test.js': "describe('RF-01 caricamento', () => { it('va', () => {}); });\ndescribe('senza codice', () => {});",
      'b.test.js': "it('RNF-02 accessibile', () => {});\nit('anonimo', () => {});",
    };
    expect(checkTestNames(sources, code)).toEqual([
      'a.test.js: gruppo "senza codice" senza codice di requisito',
      'b.test.js: test "anonimo" senza codice di requisito',
    ]);
  });
});
