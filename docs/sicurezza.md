# Sicurezza e privacy

## Dati

- Il file non viene caricato su alcun server: lettura, analisi e scrittura avvengono nel browser.
- Verso l'esterno va solo il testo da tradurre, all'API di Anthropic (`api.anthropic.com`), con la chiave dell'utente. Si applicano le condizioni d'uso dell'API dell'account che possiede la chiave.
- Non ci sono analisi statistiche, cookie o tracciamenti.

## Chiave API

- La chiave è usata direttamente dal browser (`dangerouslyAllowBrowser` nell'SDK, intestazione `anthropic-dangerous-direct-browser-access`): è il modello previsto per le app in cui ciascuno usa la propria chiave.
- Viene conservata in `localStorage` solo se l'utente spunta «Memorizza la chiave in questo browser»; togliendo la spunta viene cancellata.
- Si consiglia una chiave dedicata, con limite di spesa impostato nella console di Anthropic.

## Content Security Policy

`index.html` dichiara una CSP che consente script, stili, caratteri e worker solo dallo stesso sito e connessioni solo verso lo stesso sito e `https://api.anthropic.com`. Riduce l'impatto di un eventuale codice iniettato, che non potrebbe inviare la chiave altrove.

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
