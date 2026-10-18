# Sviluppo

## Requisiti

Node.js 22 (versione in `.nvmrc`), git, [Gitleaks](https://github.com/gitleaks/gitleaks) per l'hook di pre-commit. `npm ci` installa anche [lefthook](https://lefthook.dev) e attiva gli hook git ([convenzioni-git.md](convenzioni-git.md#hook-locali-lefthook)).

## Comandi

| Comando                             | Effetto                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run worker`                    | proxy DeepL in locale su `http://localhost:8787`, con i valori di `.dev.vars` in `worker/` |
| `npm run dev`                       | server di sviluppo con ricarica automatica, collegato al proxy locale                      |
| `npm run build` / `npm run preview` | sito di produzione in `dist/` e sua anteprima                                              |
| `npm test`                          | unit test (Vitest, ambiente jsdom)                                                         |
| `npm run test:coverage`             | unit test con soglia di copertura della logica                                             |
| `npm run test:e2e`                  | test end-to-end, accessibilità e schermate (Playwright, Chromium)                          |
| `npm run lint` / `npm run format`   | ESLint senza avvisi / Prettier                                                             |
| `npm run check:conventions`         | documentazione, commenti, testi dell'interfaccia, licenze                                  |
| `npm run verifica -- --test`        | i controlli veloci della CI, da lanciare prima del push se gli hook non sono attivi        |

## Proxy in locale

Il sito di sviluppo chiama il proxy indicato da `VITE_API_URL` (in `.env.development`: `http://localhost:8787`). Per provare traduzioni vere si copia `worker/.dev.vars.example` in `.dev.vars` nella stessa cartella (escluso da git), vi si scrivono una chiave DeepL e una parola d'ordine qualsiasi, e si lancia `npm run worker` accanto a `npm run dev`. Il build di produzione fallisce se `VITE_API_URL` manca.

## Metodo

1. Ogni funzione parte da un requisito con codice in [backlog.md](backlog.md).
2. Prima i test (unit in `tests/unit/`, end-to-end in `tests/e2e/`), con il codice del requisito nel nome; si verifica che falliscano.
3. Poi il codice minimo che li fa passare, con la logica in `src/lib/` separata dall'interfaccia (`src/main.js`).
4. Infine `docs/`: il documento della funzione, il backlog e, per una cartella nuova, [mappa-del-codice.md](mappa-del-codice.md).

## Test

- **Unit**: Vitest in `tests/unit/`; i test dei formati generano i file di prova con le stesse librerie, senza file binari nel repository. Le chiamate al proxy e a DeepL usano un `fetch` finto (`tests/support/fake-api.js`); il proxy si prova chiamando direttamente il suo gestore (`tests/unit/worker.test.js`).
- **End-to-end**: Playwright in `tests/e2e/`, sul sito di produzione servito da `vite preview`. `tests/e2e/global-setup.js` crea i file di prova; il proxy è intercettato con `page.route` all'indirizzo fittizio `https://proxy.traduttore.test` (impostato in `playwright.config.js`) e risponde con una traduzione finta (`[it]` davanti a ogni segmento). Tre progetti: `chiaro`, `scuro`, `telefono`.
- **Schermate di riferimento**: in `tests/e2e/__screenshots__/`, con un carattere fisso (DejaVu Sans) caricato dal test per non dipendere dai font del sistema. Dopo una modifica grafica voluta si aggiornano con `npx playwright test --update-snapshots` e si rivedono le immagini nella PR.
- **Determinismo**: niente attese fisse; si aspetta lo stato della pagina con le asserzioni di Playwright, che riprovano fino alla scadenza.

Nelle sessioni cloud di Claude Code l'hook `.claude/hooks/session-start.sh` installa le dipendenze e Gitleaks, imposta l'identità di git e attiva gli hook.
