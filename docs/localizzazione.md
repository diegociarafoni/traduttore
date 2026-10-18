# Localizzazione

Tutti i testi che l'utente vede sono nel catalogo `src/i18n/it.json`, con chiavi raggruppate per area (`app.`, `key.`, `file.`, `info.`, `opt.`, `note.`, `run.`, `model.`, `format.`, `error.`, `doc.`, `lang.`).

- Nell'HTML: attributo `data-i18n="chiave"` per il contenuto, `data-i18n-<attributo>="chiave"` per un attributo; li applica `translateDom` all'avvio.
- Nel codice: `t('chiave', { parametro })`; i parametri si scrivono nel testo come `{parametro}`.
- I nomi delle lingue si leggono da `lang.<codice>`.

`tool/check-i18n.mjs` (in pre-commit e in CI) fallisce se il codice usa una chiave assente dal catalogo o se il catalogo contiene chiavi non usate.

## Aggiungere una lingua dell'interfaccia

1. Copiare `src/i18n/it.json` in `src/i18n/<codice>.json` e tradurre i valori.
2. Registrare il catalogo in `src/i18n/index.js` e scegliere la lingua con `setLocale` (per esempio da `navigator.language`).
3. Estendere `tool/check-i18n.mjs` perché verifichi che ogni catalogo abbia le stesse chiavi dell'italiano.
