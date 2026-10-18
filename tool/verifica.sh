#!/usr/bin/env bash
# Gli stessi controlli veloci della CI, da lanciare a mano dove gli hook non sono installati.
# Uso: tool/verifica.sh [--titolo "feat: titolo della PR"] [--test] [--e2e]
set -euo pipefail
titolo=""
test=false
e2e=false
while [ $# -gt 0 ]; do
  case "$1" in
    --titolo) titolo="$2"; shift 2 ;;
    --test) test=true; shift ;;
    --e2e) e2e=true; shift ;;
    *) echo "opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
done

git fetch -q origin main 2>/dev/null || true
node tool/check-branch-name.mjs "$(git rev-parse --abbrev-ref HEAD)"
node tool/check-commit-msg.mjs --range "$(git merge-base origin/main HEAD)..HEAD"
[ -n "$titolo" ] && node tool/check-commit-msg.mjs --text "$titolo"
node tool/check-autore.mjs
npm run --silent format:check
npm run --silent lint
npm run --silent check:conventions
if git ls-files -s | grep -q '^160000'; then
  echo "✗ sottomodulo nell'indice: rimuoverlo con git rm --cached <percorso>" >&2
  exit 1
fi
if $test; then
  npm run --silent test:coverage
  npm run --silent build
  node tool/check-bundle.mjs
fi
if $e2e; then npm run --silent test:e2e; fi
echo "✓ verifica completata"
