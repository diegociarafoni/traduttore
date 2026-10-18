import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../../src/lib/detect.js';

describe('RF-02 rilevamento della lingua di origine', () => {
  it("riconosce l'inglese", () => {
    const lang = detectLanguage([
      'The quick brown fox jumps over the lazy dog while the children are playing in the garden.',
    ]);
    expect(lang.code).toBe('en');
  });

  it('riconosce il tedesco', () => {
    const lang = detectLanguage([
      'Die Katze sitzt auf der Matte und schaut aus dem Fenster, während es draußen regnet.',
    ]);
    expect(lang.code).toBe('de');
  });

  it('restituisce null con testo insufficiente', () => {
    expect(detectLanguage(['Ok'])).toBeNull();
  });
});
