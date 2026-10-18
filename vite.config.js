import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const policy = JSON.parse(readFileSync('./tool/policy.json', 'utf8'));
const min = policy.coverage.logicMinPercent;

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Solo la logica: l'interfaccia (src/main.js) è coperta dai test end-to-end.
      include: ['src/lib/**', 'src/i18n/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: min, statements: min, functions: min, branches: min - 10 },
    },
  },
});
