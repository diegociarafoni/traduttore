# Traduttore

Applicazione web che traduce documenti **Markdown, Word (.docx), testo, EPUB e PDF** mantenendo la struttura del file di ingresso, oppure convertendolo in un altro di questi formati.

- Lingua di origine scelta a mano o rilevata in automatico; lingua di destinazione predefinita: italiano.
- Formato di uscita uguale a quello di ingresso (predefinito) o diverso.
- Il file viene elaborato nel browser: all'esterno va solo il testo da tradurre, verso DeepL, attraverso un piccolo proxy che custodisce la chiave.
- L'uso è riservato: serve la parola d'ordine impostata dall'amministratore.

L'app è pubblicata su GitHub Pages: <https://diegociarafoni.github.io/traduttore/>.

La documentazione completa è in [docs/README.md](docs/README.md).

## Avvio rapido per lo sviluppo

```sh
npm ci
npm run worker     # proxy DeepL su http://localhost:8787 (richiede worker/.dev.vars, vedi docs/sviluppo.md)
npm run dev        # http://localhost:5173
npm test           # unit test
npm run test:e2e   # test end-to-end con Playwright
```

## Licenza

GPL-3.0 o successiva: vedi [LICENSE](LICENSE).
