# Mappa del codice

Ogni cartella di `src/` e di `src/lib/` ha qui il documento che la descrive. La tabella è controllata da `tool/check-docs.mjs`: una cartella nuova senza riga, o una riga per una cartella che non esiste più, fa fallire il controllo.

## Cartelle e documenti

| Cartella           | Documenti                                                          | Contenuto                                                                 |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/i18n/`        | [localizzazione.md](localizzazione.md)                             | Catalogo dei testi dell'interfaccia e funzione `t`                        |
| `src/lib/`         | [architettura.md](architettura.md), [traduzione.md](traduzione.md) | Logica: pipeline, modello documento, traduzione, rilevamento della lingua |
| `src/lib/formats/` | [formati.md](formati.md)                                           | Lettura e scrittura di md, txt, docx, epub e pdf                          |

## Altri file

| Percorso             | Contenuto                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `src/main.js`        | Interfaccia ([interfaccia.md](interfaccia.md))                                            |
| `worker/`            | Proxy verso DeepL su Cloudflare Workers ([proxy.md](proxy.md))                            |
| `tool/`              | Controlli di convenzioni, documentazione, licenze e dimensioni ([qualita.md](qualita.md)) |
| `tests/unit/`        | Unit test ([sviluppo.md](sviluppo.md#test))                                               |
| `tests/e2e/`         | Test end-to-end, accessibilità e schermate di riferimento                                 |
| `.github/workflows/` | CI, convenzioni, sicurezza, pubblicazione e changelog                                     |
