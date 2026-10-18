# Backlog

Documento unico dei requisiti. I codici (RF funzionali, RNF non funzionali) compaiono nei nomi dei test che li verificano e nelle PR che li toccano: non vanno cambiati.

- **Stato**: _fatta_ (nel codice, nei test e in `docs/`), _parziale_, _da fare_.
- **Priorità**: P0 indispensabile, P1 alto valore, P2 evolutivo.

## Requisiti funzionali (RF)

| ID    | Requisito                                                                                                    | Priorità | Stato   | Test                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------- | ------- | ------------------------------------------------------------ |
| RF-01 | Caricare un file md, docx, txt, epub o pdf, scegliendolo o trascinandolo; rifiutare gli altri formati        | P0       | fatta   | `tests/e2e/traduzione.spec.js`                               |
| RF-02 | Lingua di origine facoltativa: se non indicata viene rilevata                                                | P0       | fatta   | `tests/unit/detect.test.js`, e2e                             |
| RF-03 | Lingua di destinazione a scelta, predefinita italiano                                                        | P0       | fatta   | `tests/unit/api.test.js`, e2e                                |
| RF-04 | Formato di uscita a scelta, predefinito quello di ingresso; nome del file con il codice della lingua         | P0       | fatta   | `tests/unit/formats.test.js`, e2e                            |
| RF-05 | Traduzione che conserva titoli, paragrafi, elenchi, citazioni, tabelle e formattazione in linea              | P0       | fatta   | `tests/unit/formats.test.js`, `tests/unit/translate.test.js` |
| RF-06 | docx→docx ed epub→epub «sul posto»: stili, immagini, tabelle, metadati e grassetti/corsivi restano dove sono | P0       | fatta   | `tests/unit/formats.test.js`, e2e                            |
| RF-07 | PDF: estrazione del livello di testo; messaggio chiaro se il PDF non ne ha                                   | P0       | fatta   | `tests/unit/formats.test.js`, e2e                            |
| RF-08 | Conversione tra tutti i formati supportati                                                                   | P1       | fatta   | `tests/unit/pipeline.test.js`, e2e                           |
| RF-09 | Chiave API dell'utente, conservata nel browser solo se richiesto                                             | P0       | fatta   | e2e                                                          |
| RF-10 | Stima di caratteri, token e costo prima di tradurre                                                          | P1       | fatta   | `tests/unit/translate.test.js`, e2e                          |
| RF-11 | Avanzamento della traduzione e annullamento                                                                  | P1       | fatta   | `tests/unit/translate.test.js`                               |
| RF-12 | Errori del servizio spiegati in italiano                                                                     | P1       | fatta   | `tests/unit/api.test.js`, e2e                                |
| RF-13 | Codice non tradotto; testi ripetuti tradotti una sola volta                                                  | P1       | fatta   | `tests/unit/translate.test.js`                               |
| RF-14 | OCR dei PDF scansionati                                                                                      | P1       | da fare |                                                              |
| RF-15 | Altri formati: odt, html, srt/vtt, pptx, xlsx                                                                | P2       | da fare |                                                              |
| RF-16 | Glossario dell'utente (termini da non tradurre o con traduzione fissa)                                       | P1       | da fare |                                                              |
| RF-17 | Anteprima affiancata originale/traduzione prima del download                                                 | P2       | da fare |                                                              |
| RF-18 | PDF→PDF con impaginazione originale (sostituzione del testo nelle stesse posizioni)                          | P2       | da fare |                                                              |
| RF-19 | Elenchi annidati e note a piè di pagina nella conversione tra formati                                        | P2       | da fare |                                                              |

## Requisiti non funzionali (RNF)

| ID     | Requisito                                                                                 | Priorità | Stato   | Test o controllo                                                      |
| ------ | ----------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------- |
| RNF-01 | Il file non lascia il dispositivo: all'esterno va solo il testo, verso l'API di Anthropic | P0       | fatta   | Content Security Policy in `index.html`, [sicurezza.md](sicurezza.md) |
| RNF-02 | Accessibilità WCAG 2.1 AA in tema chiaro e scuro, uso da tastiera, schermo del telefono   | P0       | fatta   | `tests/e2e/aspetto.spec.js`                                           |
| RNF-03 | Testi dell'interfaccia nel catalogo `src/i18n/it.json`                                    | P1       | fatta   | `tool/check-i18n.mjs`, `tests/unit/api.test.js`                       |
| RNF-04 | Sito statico pubblicato su GitHub Pages                                                   | P0       | fatta   | `.github/workflows/pages.yml`                                         |
| RNF-05 | Convenzioni di rami, commit e commenti verificate in automatico                           | P1       | fatta   | `tests/unit/tool/conventions.test.js`                                 |
| RNF-06 | Solo dipendenze con licenza compatibile                                                   | P1       | fatta   | `tool/check-licenses.mjs`                                             |
| RNF-07 | Documentazione coerente con il codice                                                     | P1       | fatta   | `tool/check-docs.mjs`, `tests/unit/tool/docs.test.js`                 |
| RNF-08 | Interfaccia in altre lingue oltre all'italiano                                            | P2       | da fare |                                                                       |
