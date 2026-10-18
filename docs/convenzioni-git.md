# Convenzioni Git e flusso di lavoro

## Regole

1. **Mai direttamente su `main`**: ogni modifica passa da un ramo e da una pull request.
2. **Un ramo per ogni funzione o correzione**, con nome `tipo/descrizione-in-minuscolo`.
3. **Commit secondo la convenzione Angular**.
4. **Squash merge**: la PR diventa un solo commit su `main`, con il titolo della PR come messaggio.
5. **Revisione `/code-review` prima del merge**, oltre alla CI verde.
6. **Ogni PR porta unit test e test end-to-end** per ciò che cambia, e aggiorna `docs/`.

## Nomi dei rami

```
feat/glossario
fix/pdf-colonne
docs/guida-sviluppo
```

Tipi ammessi: quelli dei commit (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`) più `hotfix` e `chore`, che valgono solo per i rami. Solo minuscole, cifre, `.`, `_`, `-` e `/` tra le parti.

Sono accettati anche i rami degli strumenti automatici: `dependabot/…` e `release-please--…`. Le sessioni di Claude Code seguono le stesse regole delle persone: niente `claude/…`, anche quando l'ambiente propone quel nome.

Dopo il merge il ramo si elimina, su GitHub (vedi **Automatically delete head branches** più sotto) e in locale.

## Messaggi di commit (Angular)

```
tipo(ambito): descrizione al presente, minuscola, senza punto finale

Corpo facoltativo, separato da una riga vuota: il perché della modifica.

BREAKING CHANGE: cosa cambia per chi usa l'app o il codice.
```

| Tipo       | Uso                                           | Nel changelog (`release-please-config.json`) |
| ---------- | --------------------------------------------- | -------------------------------------------- |
| `feat`     | nuova funzione                                | Novità                                       |
| `fix`      | correzione di un difetto                      | Correzioni                                   |
| `perf`     | miglioramento delle prestazioni               | Prestazioni                                  |
| `revert`   | annullamento di un commit precedente          | Annullamenti                                 |
| `docs`     | solo documentazione                           | no                                           |
| `refactor` | riorganizzazione senza cambi di comportamento | no                                           |
| `test`     | test aggiunti o corretti                      | no                                           |
| `build`    | build, dipendenze, strumenti                  | no                                           |
| `ci`       | integrazione continua                         | no                                           |
| `style`    | formattazione, senza cambi di codice          | no                                           |

La descrizione inizia con la minuscola, tranne quando comincia con una sigla (`fix: PDF senza testo`). L'intestazione è lunga al massimo 100 caratteri. L'ambito è facoltativo, in minuscolo (`pdf`, `epub`, `i18n`, `deps`). Un `!` dopo tipo o ambito (`feat!:`) segnala una modifica incompatibile.

L'unico `chore` ammesso nei commit è quello generato da release-please (`chore(main): release x.y.z`). Nei commit del ramo sono ammessi anche i messaggi generati da git (`Merge branch …`, `Revert "…"`) e i `fixup!`/`squash!`/`amend!`, che spariscono con lo squash merge; il titolo della PR deve invece seguire sempre la convenzione.

Il controllo è in `tool/check-commit-msg.mjs` (regole in `tool/lib/commit-message.mjs`) e gira in locale (hook `commit-msg` e `pre-push`) e in CI su ogni commit della PR e sul suo titolo.

### Nessuna attribuzione a Claude

Commit, messaggi di squash e descrizioni delle PR non portano alcuna attribuzione a Claude. Il controllo rifiuta `Co-authored-by` con Claude o Anthropic, `Claude-Session`, i link `claude.ai/code/session_` e le righe «Generated with … Claude»; nei commit di un ramo rifiuta anche un autore o committer con l'identità di Claude (indirizzo @anthropic.com o nome «Claude»), che GitHub trasformerebbe in un `Co-authored-by` nel commit di squash. In locale `pre-commit` esegue `tool/check-autore.mjs` sull'identità di git. Se scatta, si imposta la propria identità con `git config user.name` e `git config user.email`.

## Hook locali (lefthook)

[lefthook](https://lefthook.dev) è una dipendenza di sviluppo: `npm ci` lo installa e attiva gli hook definiti in `lefthook.yml`. Gitleaks va installato a parte ([istruzioni](https://github.com/gitleaks/gitleaks#installing)).

| Hook         | Controlli                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | formattazione (Prettier) e analisi statica (ESLint senza avvisi) dei file in commit, catalogo dei testi, identità dell'autore, Gitleaks sui file in commit                                                                                          |
| `commit-msg` | messaggio secondo la convenzione Angular                                                                                                                                                                                                            |
| `pre-push`   | nome dei rami di destinazione (blocca anche `git push origin main`), messaggi di tutti i commit del ramo, documentazione, commenti, unit test collegati ai file modificati (`tool/test-veloci.sh`). La suite completa e gli end-to-end girano in CI |

### Sessioni di Claude Code nel cloud

L'hook di avvio `.claude/hooks/session-start.sh`, registrato in `.claude/settings.json`, installa le dipendenze e Gitleaks, imposta l'identità di git su quella degli ultimi commit di `main` al posto di quella di Claude ed esegue `lefthook install`. Gira solo nelle sessioni cloud (`CLAUDE_CODE_REMOTE=true`) ed è idempotente.

### Senza hook: `tool/verifica.sh`

Dove gli hook non sono attivi si lancia a mano, prima del push:

```sh
tool/verifica.sh --titolo "feat(pdf): titolo della PR" --test --e2e
```

Controlla nome del ramo, messaggi dei commit dal punto in cui il ramo si stacca da `main`, titolo della PR (facoltativo), identità, formattazione, analisi statica, documentazione, commenti, testi, licenze e sottomoduli nell'indice; con `--test` anche unit test, copertura, build e dimensioni; con `--e2e` gli end-to-end.

Per un'emergenza `git commit --no-verify` salta gli hook, ma la CI esegue comunque gli stessi controlli.

## Commenti nel codice

I commenti sono solo funzionali, brevi e sul perché: niente cronaca, riferimenti a PR o thread, descrizioni di ciò che il codice dice già. `tool/check-comments.mjs` blocca i commenti che rimandano a una PR o a un'issue (`PR #12`, `(#240)`) o contengono `TODO`, `FIXME`, `XXX`, `HACK` senza la forma `TODO: motivo` di almeno una frase; un commento con un indirizzo web è una fonte e non si controlla. Il resto lo giudica la revisione.

## Processo di merge

1. Aprire la PR dal proprio ramo verso `main`, con titolo secondo la convenzione Angular. Il modello della PR (`.github/pull_request_template.md`) chiede i requisiti coperti e la lista di verifica.
2. Attendere che tutti i controlli della PR siano verdi.
3. Eseguire la skill `/code-review` di Claude Code sulla PR e risolvere i risultati.
4. Unire con **Squash and merge**, attraverso la coda di merge dove è disponibile.

## Protezione di `main` (impostazione su GitHub)

Da fare una volta, in **Settings** del repository:

1. **General → Pull Requests**: lasciare attivo solo **Allow squash merging**, con messaggio predefinito **Pull request title**; disattivare **Allow merge commits** e **Allow rebase merging**; attivare **Automatically delete head branches**.
2. **Rules → Rulesets → New branch ruleset**: nome `main`, destinazione **Default branch**, stato **Active**, con **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (metodo **Squash**, con **Require conversation resolution before merging**) e **Require status checks to pass** con i controlli `test`, `e2e` e `Ramo, titolo della PR e commit`; dove GitHub lo offre, anche **Require merge queue** con metodo **Squash** (i workflow `ci.yml` e `conventions.yml` girano già sull'evento `merge_group`).

La coda di merge è disponibile solo per i repository di un'organizzazione: su un repository personale si unisce direttamente con **Squash and merge** dopo i controlli verdi. Su un account GitHub Free le regole dei rami valgono solo per i repository pubblici; su un repository privato servirebbe GitHub Pro, e fino ad allora l'hook `pre-push` e la CI restano l'unica protezione.
