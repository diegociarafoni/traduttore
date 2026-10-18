# Localizzazione

Tutti i testi che l'utente vede sono nel catalogo `src/i18n/it/`, diviso per funzione: un file JSON per area, fusi da `src/i18n/index.js`. Le aree e i prefissi delle chiavi ammessi in ciascun file sono in `tool/policy.json` (`i18n.areas`):

| File              | Prefissi                   |
| ----------------- | -------------------------- |
| `app.json`        | `app.`                     |
| `accesso.json`    | `key.`, `access.`          |
| `documento.json`  | `file.`, `info.`, `doc.`   |
| `opzioni.json`    | `opt.`, `note.`, `format.` |
| `traduzione.json` | `run.`                     |
| `errori.json`     | `error.`                   |
| `lingue.json`     | `lang.`                    |

- Nell'HTML: attributo `data-i18n="chiave"` per il contenuto, `data-i18n-<attributo>="chiave"` per un attributo; li applica `translateDom` all'avvio.
- Nel codice: `t('chiave', { parametro })`; i parametri si scrivono nel testo come `{parametro}`.
- I nomi delle lingue si leggono da `lang.<codice>`.

`tool/check-i18n.mjs` (in pre-commit e in CI) fallisce se:

- il codice usa una chiave assente dal catalogo, o il catalogo contiene chiavi non usate;
- un file contiene chiavi di un'altra area o una chiave è ripetuta;
- le frasi scritte direttamente nel codice di `src/` (stringhe con almeno due parole, esclusi chiavi, percorsi, indirizzi e markup) superano `i18n.maxHardcodedTexts` di `tool/policy.json`, oggi 0: il numero può solo scendere.

## Aggiungere una lingua dell'interfaccia

1. Copiare la cartella `src/i18n/it/` in `src/i18n/<codice>/` e tradurre i valori.
2. Registrare il catalogo in `src/i18n/index.js` e scegliere la lingua con `setLocale` (per esempio da `navigator.language`).
3. Estendere `tool/check-i18n.mjs` perché verifichi che ogni catalogo abbia le stesse chiavi dell'italiano.
