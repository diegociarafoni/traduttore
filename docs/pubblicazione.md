# Pubblicazione

Il workflow `.github/workflows/pages.yml` gira a ogni modifica di `main` (escluse le modifiche alla sola documentazione) e a richiesta da **Actions → Pubblicazione → Run workflow**. Ha tre passi:

1. `worker`: pubblica il proxy su Cloudflare Workers e copia nel Worker i segreti `DEEPL_KEY` e `PASSWORD`;
2. `build`: costruisce il sito con `VITE_API_URL` uguale all'indirizzo del Worker appena pubblicato;
3. `deploy`: pubblica `dist/` su GitHub Pages.

## Segreti del repository

In **Settings → Secrets and variables → Actions → Secrets**:

| Segreto                 | Contenuto                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `DEEPL_KEY`             | chiave API di DeepL                                                                               |
| `PASSWORD`              | parola d'ordine richiesta agli utenti                                                             |
| `CLOUDFLARE_API_TOKEN`  | token API di Cloudflare con il modello «Edit Cloudflare Workers» (permesso Workers Scripts: Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | identificativo dell'account Cloudflare (pagina **Workers & Pages**, colonna a destra)             |

Il workflow accetta i valori anche come variabili (**Variables**) al posto dei segreti, ma `DEEPL_KEY`, `PASSWORD` e il token devono stare tra i segreti, che GitHub non mostra nei log. Se ne manca uno il passo `worker` si ferma con l'elenco dei nomi mancanti.

Per cambiare la parola d'ordine basta aggiornare il segreto `PASSWORD` e rilanciare il workflow.

## Proxy su Cloudflare Workers

Il Worker si chiama `traduttore` e risponde su `https://traduttore.<sottodominio>.workers.dev`. Al primo uso di Workers l'account Cloudflare deve avere un sottodominio `workers.dev`, che si sceglie una volta in **Workers & Pages**. La configurazione è in `worker/wrangler.toml`; il proxy è descritto in [proxy.md](proxy.md).

## GitHub Pages

Il sito è statico: `npm run build` produce `dist/` con percorsi relativi, quindi funziona anche in una sottocartella come `https://diegociarafoni.github.io/traduttore/`. La Content Security Policy della pagina consente connessioni solo verso l'origine di `VITE_API_URL`.

Impostazione da fare una volta: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Senza questa scelta il passo `deploy` fallisce con un errore di Pages non abilitato. Dopo la prima pubblicazione l'indirizzo compare nella stessa pagina e nell'ambiente `github-pages`.

## Versioni

`release-please` (`.github/workflows/release-please.yml`) tiene aperta una PR «chore(main): release X.Y.Z» con `CHANGELOG.md` calcolato dai commit di `main`; unirla crea il tag e la release su GitHub. La versione segue i tipi dei commit: `feat` aumenta la versione minore, `fix` la patch, `!` o `BREAKING CHANGE` la principale (dopo la 1.0.0).
