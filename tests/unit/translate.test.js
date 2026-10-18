import { describe, expect, it, vi } from 'vitest';
import {
  buildSystemPrompt,
  estimateCost,
  formatBatch,
  makeBatches,
  needsTranslation,
  parseBatch,
  translateSegments,
} from '../../src/lib/translate.js';
import { byCode } from '../../src/lib/languages.js';

describe('RF-05 lotti e analisi della risposta', () => {
  it('formatta e rilegge i segmenti numerati', () => {
    const text = formatBatch(['uno', 'due <1>tre</1>']);
    expect(parseBatch(text, 2)).toEqual(['uno', 'due <1>tre</1>']);
  });

  it('segnala i segmenti mancanti con null', () => {
    expect(parseBatch('<s i="2">b</s>', 3)).toEqual([null, 'b', null]);
  });

  it('divide in lotti per dimensione', () => {
    const items = Array.from({ length: 5 }, () => ({ text: 'x'.repeat(40) }));
    expect(makeBatches(items, 100, 10).map((b) => b.length)).toEqual([2, 2, 1]);
  });

  it('RF-13 ignora segmenti senza lettere', () => {
    expect(needsTranslation('12.3 — <1/>')).toBe(false);
    expect(needsTranslation('Ciao')).toBe(true);
  });

  it('RF-02 RF-03 include lingua di origine e destinazione nel prompt', () => {
    const p = buildSystemPrompt({ sourceLang: byCode('en'), targetLang: byCode('it') });
    expect(p).toContain('from English into Italian');
    expect(buildSystemPrompt({ sourceLang: null, targetLang: byCode('it') })).toContain('detect it automatically');
  });

  it('RF-10 stima il costo in base al modello', () => {
    const e = estimateCost(['a'.repeat(3500)], 'claude-haiku-5-5');
    expect(e.tokens).toBe(1000);
    expect(e.usd).toBeGreaterThan(0);
  });
});

describe('RF-05 translateSegments', () => {
  it("RF-13 deduplica, salta i segmenti non traducibili e mantiene l'ordine", async () => {
    const batch = vi.fn(async (texts) => texts.map((t) => `IT:${t}`));
    const out = await translateSegments(['Hello', '42', 'Hello', 'World'], batch);
    expect(out).toEqual(['IT:Hello', '42', 'IT:Hello', 'IT:World']);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toEqual(['Hello', 'World']);
  });

  it('RF-06 ritenta i segmenti con tag persi', async () => {
    let calls = 0;
    const batch = async (texts) => {
      calls++;
      return texts.map((t) => (calls === 1 ? t.replace(/<\/?1>/g, '') : t.toUpperCase()));
    };
    const out = await translateSegments(['a <1>b</1>'], batch);
    expect(out).toEqual(['A <1>B</1>']);
    expect(calls).toBe(2);
  });

  it('ritenta i segmenti mancanti nella risposta', async () => {
    let calls = 0;
    const batch = async (texts) => {
      calls++;
      return texts.map((t, i) => (calls === 1 && i === 1 ? null : `T:${t}`));
    };
    const out = await translateSegments(['uno', 'due', 'tre'], batch);
    expect(out).toEqual(['T:uno', 'T:due', 'T:tre']);
  });

  it("RF-11 riporta l'avanzamento", async () => {
    const progress = [];
    await translateSegments(['a', 'b'], async (t) => t, { onProgress: (d, n) => progress.push([d, n]) });
    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it('RF-11 si interrompe se annullato', async () => {
    const c = new AbortController();
    c.abort();
    await expect(translateSegments(['a'], async (t) => t, { signal: c.signal })).rejects.toThrow('annullata');
  });
});
