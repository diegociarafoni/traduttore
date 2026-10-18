# Proxy verso DeepL

Il sito è statico e non può custodire segreti: tutto ciò che contiene è leggibile da chiunque. Per questo la chiave DeepL e la parola d'ordine stanno in un piccolo proxy su [Cloudflare Workers](https://developers.cloudflare.com/workers/), in `worker/`.

## Funzionamento

- Ogni richiesta deve avere l'intestazione `x-password` uguale al segreto `PASSWORD`; il confronto è a tempo costante. Senza parola d'ordine corretta la risposta è `401 {"error":"parola_d_ordine"}` e DeepL non viene contattato.
- La chiave `DEEPL_KEY` è aggiunta dal proxy; le chiavi gratuite (che finiscono in `:fx`) usano `api-free.deepl.com`, le altre `api.deepl.com`.
- CORS è consentito solo alle origini in `ALLOWED_ORIGINS` (in `worker/wrangler.toml`: `https://diegociarafoni.github.io`).

## Interfaccia

| Richiesta           | Corpo                                                | Risposta                                       |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `POST /api/traduci` | `{ "texts": [...], "target": "IT", "source": "EN" }` | `{ "translations": [{ "text", "detected" }] }` |
| `GET /api/utilizzo` | nessuno                                              | `{ "used": 1234, "limit": 500000 }`            |

`source` è facoltativo: senza, DeepL rileva la lingua. Il proxy inoltra a `/v2/translate` con `tag_handling: xml` e `preserve_formatting: true`.

## Limiti ed errori

- Al massimo 100 richieste al minuto per indirizzo IP, contate prima del controllo della parola d'ordine così da rallentare anche i tentativi di indovinarla (`LIMITATORE`, limite di frequenza di Cloudflare configurato in `worker/wrangler.toml`); oltre, `429 troppe_richieste`.
- Al massimo 50 testi e 120 kB per richiesta (`LIMITS` in `worker/src/index.js`); oltre, `413 troppo_grande`. Codici di lingua e forma del corpo sono validati prima dell'inoltro (`400 richiesta_non_valida`).
- Errori di DeepL: 403 (chiave non valida) diventa `502 configurazione`, 456 (quota esaurita) `429 quota`, 429 `429 troppe_richieste`, gli altri `502 servizio`. Segreti mancanti: `500 configurazione`.

## Variabili

| Nome              | Tipo      | Dove si imposta                                                          |
| ----------------- | --------- | ------------------------------------------------------------------------ |
| `DEEPL_KEY`       | segreto   | segreto del repository, copiato nel Worker dal workflow di pubblicazione |
| `PASSWORD`        | segreto   | segreto del repository, copiato nel Worker dal workflow di pubblicazione |
| `ALLOWED_ORIGINS` | variabile | `worker/wrangler.toml`; in locale `.dev.vars` in `worker/`               |

La pubblicazione è descritta in [pubblicazione.md](pubblicazione.md#proxy-su-cloudflare-workers); le prove in locale in [sviluppo.md](sviluppo.md#proxy-in-locale).
