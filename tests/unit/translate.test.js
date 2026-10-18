import { describe, expect, it, vi } from 'vitest';
import {
  countCharacters,
  fromDeeplXml,
  makeBatches,
  needsTranslation,
  splitLong,
  toDeeplXml,
  translateSegments,
} from '../../src/lib/translate.js';

describe('RF-05 lotti e tag', () => {
  it('converte i tag numerati in XML valido per DeepL e ritorno', () => {
    const s = 'a <1>b <2/></1> &amp; c';
    expect(toDeeplXml(s)).toBe('a <t1>b <t2/></t1> &amp; c');
    expect(fromDeeplXml(toDeeplXml(s))).toBe(s);
    expect(fromDeeplXml('<t3 />x')).toBe('<3/>x');
  });

  it('divide in lotti per dimensione e per numero di segmenti', () => {
    const items = Array.from({ length: 5 }, () => ({ text: 'x'.repeat(40) }));
    expect(makeBatches(items, 100, 10).map((b) => b.length)).toEqual([2, 2, 1]);
    expect(makeBatches(items, 1000, 2).map((b) => b.length)).toEqual([2, 2, 1]);
  });

  it('RF-13 ignora segmenti senza lettere', () => {
    expect(needsTranslation('12.3 — <1/>')).toBe(false);
    expect(needsTranslation('Ciao')).toBe(true);
  });

  it('RF-10 conta i caratteri fatturati, senza tag e senza segmenti non traducibili', () => {
    expect(countCharacters(['<1>Ciao</1> &amp; tu', '42'])).toBe(9);
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

  it('dopo gli ultimi tentativi accetta la traduzione anche senza tag', async () => {
    const batch = async (texts) => texts.map((t) => t.replace(/<\/?1>/g, ''));
    expect(await translateSegments(['a <1>b</1>', 'c <1>d</1>'], batch)).toEqual(['a b', 'c d']);
  });

  it('divide i testi troppo lunghi a fine riga, a fine frase o a uno spazio', () => {
    expect(splitLong('aaaa\nbbbb\ncc', 10)).toEqual(['aaaa\nbbbb\n', 'cc']);
    expect(splitLong('Uno due. Tre quattro cinque', 12)).toEqual(['Uno due. ', 'Tre quattro ', 'cinque']);
    expect(splitLong('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(splitLong('abcdefg&amp;h', 9)).toEqual(['abcdefg', '&amp;h']);
  });

  it('traduce a pezzi un segmento oltre il limite di una richiesta e lo ricompone', async () => {
    const long = `${'Parola '.repeat(4000)}fine.\n${'Altra '.repeat(3000)}`;
    const sizes = [];
    const batch = async (texts) => {
      sizes.push(...texts.map((x) => x.length));
      return texts.map((x) => x.trimEnd().toUpperCase());
    };
    const [out] = await translateSegments([long], batch);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(20000);
    expect(out).toBe(long.toUpperCase());
  });

  it('al primo errore smette di inviare altri lotti', async () => {
    const segments = Array.from({ length: 200 }, (_, i) => `testo ${i} ${'x'.repeat(i)}`);
    let calls = 0;
    const batch = async () => {
      calls++;
      throw new Error('quota');
    };
    await expect(translateSegments(segments, batch, { concurrency: 2 })).rejects.toThrow('quota');
    expect(calls).toBe(2);
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
