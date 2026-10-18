import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

// Variabili di colore del tema chiaro (primo :root) e del tema scuro (:root dentro prefers-color-scheme).
function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}
const light = tokens(css.split('@media (prefers-color-scheme: dark)')[0]);
const dark = { ...light, ...tokens(css.split('@media (prefers-color-scheme: dark)')[1].split(/\n}\n/)[0]) };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('RNF-02 contrasto dei colori del tema', () => {
  for (const [name, theme] of [
    ['chiaro', light],
    ['scuro', dark],
  ]) {
    it(`bordi dei campi e dell'area del file distinguibili (3:1, WCAG 1.4.11) nel tema ${name}`, () => {
      expect(contrast(theme['field-border'], theme.card)).toBeGreaterThanOrEqual(3);
      expect(contrast(theme['field-border'], theme.bg)).toBeGreaterThanOrEqual(3);
    });

    it(`testi e indicatore di focus leggibili (4,5:1, WCAG 1.4.3) nel tema ${name}`, () => {
      for (const key of ['text', 'muted', 'ok', 'warn', 'error', 'accent']) {
        expect(contrast(theme[key], theme.card), key).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme[key], theme.bg), key).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(theme['accent-ink'], theme.accent)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
