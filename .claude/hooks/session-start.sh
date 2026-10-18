#!/usr/bin/env bash
# Prepara le sessioni cloud: dipendenze npm, Gitleaks, identità di git e hook di lefthook.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

gitleaks_version="8.30.1" # la stessa di .github/workflows/conventions.yml
gitleaks_sha="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"

npm ci --no-audit --no-fund

if ! command -v gitleaks >/dev/null; then
  tmp="$(mktemp -d)"
  curl -fsSL --retry 3 -o "$tmp/gitleaks.tar.gz" \
    "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaks_version}/gitleaks_${gitleaks_version}_linux_x64.tar.gz"
  echo "$gitleaks_sha  $tmp/gitleaks.tar.gz" | sha256sum -c -
  tar xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
  install -m 0755 "$tmp/gitleaks" /usr/local/bin/gitleaks 2>/dev/null || install -m 0755 "$tmp/gitleaks" "$HOME/.local/bin/gitleaks"
  rm -rf "$tmp"
fi

# Il progetto non attribuisce i commit a Claude: se l'identità è la sua,
# si usa quella di chi ha scritto gli ultimi commit su main.
if [ "$(git config user.name)" = "Claude" ] || git config user.email | grep -qi '@anthropic\.com$'; then
  git fetch -q origin main || true
  nome="$(git log -1 --format=%an origin/main 2>/dev/null || true)"
  email="$(git log -1 --format=%ae origin/main 2>/dev/null || true)"
  if [ -n "$nome" ] && [ -n "$email" ] && [ "$nome" != "Claude" ] && ! echo "$email" | grep -qi '@anthropic\.com$'; then
    git config user.name "$nome"
    git config user.email "$email"
  fi
fi

npx lefthook install
