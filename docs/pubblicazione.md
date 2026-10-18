# Pubblicazione

Il workflow `.github/workflows/pages.yml` gira a ogni modifica di `main` (escluse le modifiche alla sola documentazione) e a richiesta da **Actions → Pubblicazione → Run workflow**. Ha tre passi:

1. `worker`: pubblica il proxy su Cloudflare Workers e copia nel Worker i segreti `PASSWORD`, `DEEPL_KEY` e `ANTHROPIC_API_KEY` che hanno un valore;
2. `build`: costruisce il sito con `VITE_API_URL` uguale all'indirizzo del Worker appena pubblicato;
3. `deploy`: pubblica `dist/` su GitHub Pages.

## Segreti del repository

In **Settings → Secrets and variables → Actions → Secrets**:

| Segreto                 | Contenuto                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DEEPL_KEY`             | chiave API di DeepL (facoltativa se c'è `ANTHROPIC_API_KEY`)                                                     |
| `ANTHROPIC_API_KEY`     | chiave API di Claude, da [console.anthropic.com](https://console.anthropic.com) (facoltativa se c'è `DEEPL_KEY`) |
| `PASSWORD`              | parola d'ordine richiesta agli utenti                                                                            |
| `CLOUDFLARE_API_TOKEN`  | token API di Cloudflare con il modello «Edit Cloudflare Workers» (permesso Workers Scripts: Edit)                |
| `CLOUDFLARE_ACCOUNT_ID` | identificativo dell'account Cloudflare (pagina **Workers & Pages**, colonna a destra)                            |

Serve almeno una delle due chiavi; con entrambe l'utente sceglie il motore. `ANTHROPIC_API_KEY` è una chiave dell'API di Anthropic, a consumo: l'abbonamento a Claude.ai non la include. I valori si incollano senza spazi né a capo, anche se il proxy li ignora. Il workflow accetta come variabili (**Variables**) `DEEPL_KEY`, `PASSWORD` e `CLOUDFLARE_ACCOUNT_ID`, ma chiavi, parola d'ordine e token devono stare tra i segreti, che GitHub non mostra nei log. Se manca qualcosa il passo `worker` si ferma con l'elenco dei nomi mancanti.

Togliere una chiave dal repository non la toglie dal Worker: per disattivare un motore si elimina anche il segreto in Cloudflare (**Workers & Pages → traduttore → Settings → Variables and Secrets**).

Per cambiare la parola d'ordine basta aggiornare il segreto `PASSWORD` e rilanciare il workflow.

## Proxy su Cloudflare Workers

Il Worker si chiama `traduttore` e risponde su `https://traduttore.<sottodominio>.workers.dev`. Al primo uso di Workers l'account Cloudflare deve avere un sottodominio `workers.dev`, che si sceglie una volta in **Workers & Pages**. La configurazione è in `worker/wrangler.toml`; il proxy è descritto in [proxy.md](proxy.md).

## GitHub Pages

Il sito è statico: `npm run build` produce `dist/` con percorsi relativi, quindi funziona anche in una sottocartella come `https://diegociarafoni.github.io/traduttore/`. La Content Security Policy della pagina consente connessioni solo verso l'origine di `VITE_API_URL`.

Impostazione da fare una volta: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Senza questa scelta il passo `deploy` fallisce con un errore di Pages non abilitato. Dopo la prima pubblicazione l'indirizzo compare nella stessa pagina e nell'ambiente `github-pages`.

## Versioni

`release-please` (`.github/workflows/release-please.yml`) tiene aperta una PR «chore(main): release X.Y.Z» con `CHANGELOG.md` calcolato dai commit di `main`; unirla crea il tag e la release su GitHub. La versione segue i tipi dei commit: `feat` aumenta la versione minore, `fix` la patch, `!` o `BREAKING CHANGE` la principale (dopo la 1.0.0).
