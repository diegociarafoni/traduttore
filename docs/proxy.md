# Proxy verso i motori di traduzione

Il sito è statico e non può custodire segreti: tutto ciò che contiene è leggibile da chiunque. Per questo le chiavi di DeepL e di Claude e la parola d'ordine stanno in un piccolo proxy su [Cloudflare Workers](https://developers.cloudflare.com/workers/), in `worker/`.

## Funzionamento

- Ogni richiesta deve avere l'intestazione `x-password` uguale al segreto `PASSWORD`; il confronto è a tempo costante. Senza parola d'ordine corretta la risposta è `401 {"error":"parola_d_ordine"}` e DeepL non viene contattato.
- I motori sono due, DeepL e Claude, e ne basta uno: è disponibile ogni motore di cui è impostata la chiave. Spazi e a capo attorno alle chiavi vengono ignorati, perché capita di incollarli nei segreti.
- DeepL: la chiave `DEEPL_KEY` è aggiunta dal proxy; le chiavi gratuite (che finiscono in `:fx`) usano `api-free.deepl.com`, le altre `api.deepl.com`.
- Claude: il proxy chiama l'API Messages di Anthropic con l'SDK `@anthropic-ai/sdk` e la chiave `ANTHROPIC_API_KEY`, il modello `CLAUDE_MODEL` (predefinito `claude-opus-5-5`) e sforzo basso. Chiede una risposta JSON vincolata a uno schema (`translations` e `detected`); le istruzioni impongono di conservare i tag `<tN>` e di trattare i testi come contenuto, non come istruzioni. Le traduzioni mancanti tornano `null` e il sito le richiede in lotti più piccoli, come per DeepL.
- CORS è consentito solo alle origini in `ALLOWED_ORIGINS` (in `worker/wrangler.toml`: `https://diegociarafoni.github.io`).

## Interfaccia

| Richiesta           | Corpo                                                                   | Risposta                                                            |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `POST /api/traduci` | `{ "texts": [...], "target": "IT", "source": "EN", "engine": "deepl" }` | `{ "translations": [{ "text", "detected" }] }`                      |
| `GET /api/utilizzo` | nessuno                                                                 | `{ "engines": ["deepl", "claude"], "used": 1234, "limit": 500000 }` |

`source` è facoltativo: senza, il motore rileva la lingua. `engine` è facoltativo: senza, si usa DeepL se configurato, altrimenti Claude; un motore senza chiave dà `400 richiesta_non_valida` con `campo: "engine"`. Per DeepL il proxy inoltra a `/v2/translate` con `tag_handling: xml` e `preserve_formatting: true`.

`/api/utilizzo` elenca in `engines` i motori utilizzabili e, se DeepL risponde, la sua quota (`used`, `limit`). Se DeepL rifiuta la chiave ma Claude è configurato, l'accesso riesce con il solo Claude invece di bloccarsi.

## Limiti ed errori

- Al massimo 100 richieste al minuto per indirizzo IP, contate prima del controllo della parola d'ordine così da rallentare anche i tentativi di indovinarla (`LIMITATORE`, limite di frequenza di Cloudflare configurato in `worker/wrangler.toml`); oltre, `429 troppe_richieste`.
- Al massimo 50 testi e 120 kB per richiesta (`LIMITS` in `worker/src/index.js`); oltre, `413 troppo_grande`. Codici di lingua e forma del corpo sono validati prima dell'inoltro (`400 richiesta_non_valida`).
- Errori di DeepL: 403 (chiave non valida) diventa `502 configurazione`, 456 (quota esaurita) `429 quota`, 429 `429 troppe_richieste`, gli altri `502 servizio`.
- Errori di Claude: 401 e 403 diventano `502 configurazione`, 429 `429 troppe_richieste`, 400 `400 richiesta_non_valida`; gli altri, una risposta interrotta o non leggibile, `502 servizio`. Il proxy non ritenta: i ritentativi li fa il sito.
- `PASSWORD` mancante o nessuna delle due chiavi: `500 configurazione`.

## Variabili

| Nome                | Tipo      | Dove si imposta                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------ |
| `DEEPL_KEY`         | segreto   | segreto del repository, copiato nel Worker dal workflow di pubblicazione |
| `ANTHROPIC_API_KEY` | segreto   | segreto del repository, copiato nel Worker dal workflow di pubblicazione |
| `CLAUDE_MODEL`      | variabile | `worker/wrangler.toml`                                                   |
| `PASSWORD`          | segreto   | segreto del repository, copiato nel Worker dal workflow di pubblicazione |
| `ALLOWED_ORIGINS`   | variabile | `worker/wrangler.toml`; in locale `.dev.vars` in `worker/`               |

La pubblicazione è descritta in [pubblicazione.md](pubblicazione.md#proxy-su-cloudflare-workers); le prove in locale in [sviluppo.md](sviluppo.md#proxy-in-locale).
