#!/usr/bin/env bash
# Unit test collegati ai file modificati rispetto a main (vitest related).
set -euo pipefail
git fetch -q origin main 2>/dev/null || true
base="$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD)"
mapfile -t files < <(git diff --name-only --diff-filter=d "$base" -- 'src/*.js' 'src/**/*.js' 'src/**/*.json' 'tool/*' 'tests/unit/*')
if [ "${#files[@]}" -eq 0 ]; then
  echo "✓ nessun file di codice modificato"
  exit 0
fi
npx vitest related --run --passWithNoTests "${files[@]}"
