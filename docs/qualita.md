# Qualità

Ogni controllo ha un limite misurabile e blocca la CI se non è rispettato. I limiti numerici sono in `tool/policy.json`, così si cambiano in un solo punto e con una revisione visibile.

| Controllo                | Strumento                                                 | Limite                                                                                                                | Dove gira                                               |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Formattazione            | Prettier                                                  | nessuna differenza                                                                                                    | pre-commit, CI                                          |
| Analisi statica          | ESLint (`eslint.config.js`)                               | nessun errore né avviso                                                                                               | pre-commit, CI                                          |
| Testi dell'interfaccia   | `tool/check-i18n.mjs`                                     | chiavi usate e presenti, ogni file nella sua area, frasi nel codice ≤ `i18n.maxHardcodedTexts`                        | pre-commit, CI                                          |
| Unit test                | Vitest                                                    | tutti verdi                                                                                                           | pre-push (solo i test collegati ai file modificati), CI |
| Copertura della logica   | Vitest con v8                                             | righe, istruzioni e funzioni almeno `coverage.logicMinPercent` (80%), rami almeno `coverage.branchesMinPercent` (80%) | CI                                                      |
| End-to-end               | Playwright                                                | tutti verdi in tema chiaro, scuro e su telefono                                                                       | CI                                                      |
| Accessibilità            | axe-core                                                  | nessuna violazione WCAG 2.1 A e AA                                                                                    | CI                                                      |
| Schermate di riferimento | Playwright `toHaveScreenshot`                             | differenza al massimo 2% dei pixel                                                                                    | CI                                                      |
| Dimensioni del sito      | `tool/check-bundle.mjs`                                   | script principale entro `budget.mainChunkMaxKilobytes`, sito entro `budget.distMaxMegabytes`                          | CI                                                      |
| Documentazione           | `tool/check-docs.mjs`                                     | link, ancore e percorsi validi, indice e mappa completi                                                               | pre-push, CI                                            |
| Commenti                 | `tool/check-comments.mjs`                                 | nessun rimando a PR o issue, nessun TODO senza motivo                                                                 | pre-push, CI                                            |
| Nomi dei test            | `tool/check-test-names.mjs`                               | ogni gruppo di test (o test senza gruppo) cita un codice di requisito (`tests.requirementCode`)                       | pre-push, CI                                            |
| Licenze                  | `tool/check-licenses.mjs`                                 | solo licenze ammesse                                                                                                  | CI                                                      |
| Convenzioni git          | `tool/check-branch-name.mjs`, `tool/check-commit-msg.mjs` | [convenzioni-git.md](convenzioni-git.md)                                                                              | commit-msg, pre-push, CI                                |
| Sicurezza                | Gitleaks, Trivy, OSV-Scanner, zizmor, Scorecard           | [sicurezza.md](sicurezza.md)                                                                                          | pre-commit, CI, settimanale                             |

## Copertura della logica

La logica è tutto ciò che sta in `src/lib/`, `src/i18n/` e `worker/src/`; l'interfaccia (`src/main.js`) è esclusa dalla misura ed è coperta dai test end-to-end. La separazione è voluta: una regola nuova va in `src/lib/`, dove si può provare senza browser.

## Test deterministici

- Nessuna attesa a tempo fisso: le asserzioni di Playwright e Vitest aspettano la condizione e scadono con un messaggio che dice cosa mancava.
- Nessuna rete: l'API è sempre simulata, nei unit test con un `fetch` finto (anche per il proxy verso DeepL) e negli end-to-end con `page.route`.
- Le schermate usano un carattere incluso nel repository, non quelli del sistema.
- Un test instabile si corregge, non si rilancia.
