# Pubblicazione

Il sito è statico: `npm run build` produce la cartella `dist/` con percorsi relativi, quindi funziona anche in una sottocartella come `https://diegociarafoni.github.io/traduttore/`.

## GitHub Pages

Il workflow `.github/workflows/pages.yml` costruisce e pubblica il sito a ogni modifica di `main` (escluse le modifiche alla sola documentazione) e a richiesta da **Actions → Pubblicazione → Run workflow**.

Impostazione da fare una volta: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Senza questa scelta il passo `deploy` fallisce con un errore di Pages non abilitato. Dopo la prima pubblicazione l'indirizzo compare nella stessa pagina e nell'ambiente `github-pages`.

## Versioni

`release-please` (`.github/workflows/release-please.yml`) tiene aperta una PR «chore(main): release X.Y.Z» con `CHANGELOG.md` calcolato dai commit di `main`; unirla crea il tag e la release su GitHub. La versione segue i tipi dei commit: `feat` aumenta la versione minore, `fix` la patch, `!` o `BREAKING CHANGE` la principale (dopo la 1.0.0).
