# Sicurezza e privacy

## Dati

- Il file non viene caricato su alcun server: lettura, analisi e scrittura avvengono nel browser.
- Verso l'esterno va solo il testo da tradurre, al proxy su Cloudflare Workers e da lì a DeepL. Il proxy non conserva né registra i testi (osservabilità disattivata in `worker/wrangler.toml`). Si applicano le condizioni d'uso dell'account DeepL che possiede la chiave: con l'API DeepL Pro i testi non vengono conservati, con l'API gratuita DeepL può usarli per migliorare il servizio.
- Non ci sono analisi statistiche, cookie o tracciamenti.

## Segreti e parola d'ordine

- La chiave DeepL e la parola d'ordine non entrano mai nel sito: sono segreti del repository copiati nel Worker al momento della pubblicazione ([pubblicazione.md](pubblicazione.md#segreti-del-repository)).
- Il proxy confronta la parola d'ordine a tempo costante e rifiuta ogni richiesta senza di essa prima di contattare DeepL ([proxy.md](proxy.md)).
- Nel browser la parola d'ordine si conserva in `localStorage` solo se l'utente spunta «Memorizza la parola d'ordine in questo browser»; togliendo la spunta, o se l'accesso fallisce, viene cancellata.
- La parola d'ordine protegge la quota DeepL, non i dati: chi la conosce può tradurre. Si consiglia una parola lunga e una chiave DeepL con limite di spesa; per revocare l'accesso si cambia il segreto `PASSWORD` e si rilancia il workflow.

## Content Security Policy

`index.html` dichiara una CSP che consente script, stili, caratteri e worker solo dallo stesso sito e connessioni solo verso lo stesso sito e l'origine del proxy, inserita al build da `vite.config.js` a partire da `VITE_API_URL`. Riduce l'impatto di un eventuale codice iniettato, che non potrebbe inviare testi o parola d'ordine altrove.

## Controlli automatici

| Controllo                                                                                                                                         | Dove                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gitleaks sui file in commit                                                                                                                       | hook `pre-commit`                                                                                     |
| Gitleaks sui commit della PR                                                                                                                      | `.github/workflows/conventions.yml`                                                                   |
| Trivy (vulnerabilità HIGH e CRITICAL, segreti, configurazioni), OSV-Scanner, Gitleaks su tutta la cronologia, zizmor sui workflow, SBOM CycloneDX | `.github/workflows/security.yml`, settimanale, su `main` e sulle PR che toccano dipendenze o workflow |
| OpenSSF Scorecard                                                                                                                                 | `.github/workflows/scorecard.yml`, settimanale                                                        |
| Azioni GitHub fissate allo SHA, Dependabot settimanale con attesa di 7 giorni                                                                     | `.github/workflows/`, `.github/dependabot.yml`                                                        |

## Vulnerabilità note accettate

`npm audit` segnala `sprintf-js` (gravità moderata, negazione del servizio con specificatori di precisione molto grandi), arrivato tramite `argparse`, che `mammoth` usa solo per la sua riga di comando. Nel browser quel codice non viene eseguito; si rivaluta a ogni aggiornamento di `mammoth`.
