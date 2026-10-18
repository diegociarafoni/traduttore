import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';

const policy = JSON.parse(readFileSync('./tool/policy.json', 'utf8'));
const { logicMinPercent: min, branchesMinPercent } = policy.coverage;

// L'origine del proxy di traduzione entra nella Content-Security-Policy della pagina.
function apiOrigin(mode) {
  const url = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL || process.env.VITE_API_URL;
  if (!url) {
    if (mode === 'test') return 'http://localhost:8787';
    throw new Error("VITE_API_URL non impostata: indicare l'indirizzo del proxy di traduzione.");
  }
  return new URL(url).origin;
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    {
      name: 'csp-api-origin',
      transformIndexHtml: (html) => html.replace('__API_ORIGIN__', apiOrigin(mode)),
    },
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Solo la logica: l'interfaccia (src/main.js) è coperta dai test end-to-end.
      include: ['src/lib/**', 'src/i18n/**', 'worker/src/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: min, statements: min, functions: min, branches: branchesMinPercent },
    },
  },
}));
