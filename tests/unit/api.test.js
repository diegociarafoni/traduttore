import { describe, expect, it, vi } from 'vitest';
import { ServiceError, createClient, describeError } from '../../src/lib/translate.js';
import { byCode, byIso3, LANGUAGES } from '../../src/lib/languages.js';
import { t } from '../../src/i18n/index.js';
import { PASSWORD, USAGE, fakeTranslations } from '../support/fake-api.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const client = (fetch, extra = {}) =>
  createClient({ apiUrl: 'https://proxy.test/', password: PASSWORD, fetch, sleep: async () => {}, ...extra });

describe('RF-09 RF-05 chiamata al proxy di traduzione', () => {
  it("invia la parola d'ordine, i tag in forma XML e la lingua di destinazione DeepL", async () => {
    const fetch = vi.fn(async (url, init) => json(fakeTranslations(JSON.parse(init.body))));
    const translate = client(fetch).translator({ sourceLang: null, targetLang: byCode('it') });
    expect(await translate(['Hello', 'a <1>b</1> <2/>'])).toEqual(['[it] Hello', '[it] a <1>b</1> <2/>']);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://proxy.test/api/traduci');
    expect(init.headers['x-password']).toBe(PASSWORD);
    expect(JSON.parse(init.body)).toEqual({ texts: ['Hello', 'a <t1>b</t1> <t2/>'], target: 'IT' });
  });

  it('RF-02 RF-03 passa la lingua di origine scelta e la variante di destinazione', async () => {
    const fetch = vi.fn(async (url, init) => json(fakeTranslations(JSON.parse(init.body))));
    await client(fetch).translator({ sourceLang: byCode('fr'), targetLang: byCode('pt') })(['Bonjour']);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ source: 'FR', target: 'PT-PT' });
  });

  it('segnala con null le traduzioni mancanti', async () => {
    const fetch = vi.fn(async () => json({ translations: [{ text: 'uno' }] }));
    expect(await client(fetch).translator({ targetLang: byCode('it') })(['a', 'b'])).toEqual(['uno', null]);
  });

  it('RF-10 legge la quota DeepL', async () => {
    const fetch = vi.fn(async () => json(USAGE));
    expect(await client(fetch).usage()).toEqual(USAGE);
    expect(fetch.mock.calls[0][0]).toBe('https://proxy.test/api/utilizzo');
  });

  it('riprova con attesa crescente sugli errori temporanei', async () => {
    const sleep = vi.fn(async () => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: 'troppe_richieste' }, 429))
      .mockResolvedValueOnce(json({ error: 'servizio' }, 502))
      .mockResolvedValueOnce(json(USAGE));
    expect(await client(fetch, { sleep }).usage()).toEqual(USAGE);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('RF-12 riporta il codice di errore del proxy dopo gli ultimi tentativi', async () => {
    const fetch = vi.fn(async () => json({ error: 'troppe_richieste' }, 429));
    const err = await client(fetch, { retries: 1 })
      .usage()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.code).toBe('troppe_richieste');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('RF-12 non ritenta quando la quota DeepL è esaurita', async () => {
    const fetch = vi.fn(async () => json({ error: 'quota' }, 429));
    await expect(client(fetch).usage()).rejects.toMatchObject({ code: 'quota' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("RF-12 distingue parola d'ordine errata, rete assente e risposta illeggibile", async () => {
    const wrong = await client(async () => json({ error: 'parola_d_ordine' }, 401))
      .usage()
      .catch((e) => e);
    expect(wrong.code).toBe('parola_d_ordine');
    const offline = await client(async () => {
      throw new TypeError('Failed to fetch');
    })
      .usage()
      .catch((e) => e);
    expect(offline.code).toBe('connessione');
    const broken = await client(async () => new Response('x', { status: 400 }))
      .usage()
      .catch((e) => e);
    expect(broken).toMatchObject({ code: 'servizio', status: 400 });
  });

  it("RF-11 propaga l'annullamento", async () => {
    const fetch = async () => {
      throw new DOMException('x', 'AbortError');
    };
    await expect(client(fetch).usage()).rejects.toHaveProperty('name', 'AbortError');
  });
});

describe('RF-12 messaggi di errore comprensibili', () => {
  it('traduce i codici del proxy', () => {
    expect(describeError(new ServiceError('parola_d_ordine', 401))).toBe(t('error.password'));
    expect(describeError(new ServiceError('quota', 429))).toBe(t('error.quota'));
    expect(describeError(new ServiceError('troppe_richieste', 429))).toBe(t('error.rateLimit'));
    expect(describeError(new ServiceError('connessione'))).toBe(t('error.connection'));
    expect(describeError(new ServiceError('configurazione', 502))).toBe(t('error.config'));
    expect(describeError(new ServiceError('troppo_grande', 413))).toBe(t('error.tooLarge'));
    expect(describeError(new ServiceError('servizio', 500))).toBe('Errore del servizio di traduzione (500).');
    expect(describeError(new ServiceError('altro'))).toContain('n/d');
    expect(describeError(new DOMException('x', 'AbortError'))).toBe(t('error.aborted'));
    expect(describeError(new Error('altro'))).toBe('altro');
  });
});

describe('RNF-03 testi e lingue', () => {
  it('sostituisce i parametri e ricade sulla chiave se manca', () => {
    expect(t('run.progress', { done: 1, total: 3 })).toBe('1 / 3 segmenti');
    expect(t('chiave.assente')).toBe('chiave.assente');
    expect(t('run.download')).toBe('Scarica {file}');
  });

  it("RF-03 offre l'italiano, i nomi delle lingue dal catalogo e i codici DeepL", () => {
    expect(byCode('it').name).toBe('Italiano');
    expect(byIso3('deu').code).toBe('de');
    expect(byCode('xx')).toBeNull();
    expect(LANGUAGES.every((l) => l.name && !l.name.startsWith('lang.'))).toBe(true);
    expect(
      LANGUAGES.every((l) => /^[A-Z]{2}$/.test(l.deepl.source) && /^[A-Z]{2}(-[A-Z]+)?$/.test(l.deepl.target)),
    ).toBe(true);
  });
});
