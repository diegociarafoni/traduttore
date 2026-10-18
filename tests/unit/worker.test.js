// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import worker, { LIMITS, deeplHost, handle, samePassword, validateTranslation } from '../../worker/src/index.js';

const ORIGIN = 'https://diegociarafoni.github.io';
const ENV = { DEEPL_KEY: 'chiave:fx', PASSWORD: 'segreta', ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:5173` };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function request(path, { method = 'GET', password = 'segreta', body, origin = ORIGIN } = {}) {
  const headers = { origin };
  if (password != null) headers['x-password'] = password;
  return new Request(`https://traduttore.workers.dev${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const translateBody = { texts: ['Hello <t1>world</t1>'], target: 'IT' };

describe("RF-09 parola d'ordine sul proxy", () => {
  it("confronta la parola d'ordine in modo esatto", () => {
    expect(samePassword('segreta', 'segreta')).toBe(true);
    expect(samePassword('segret', 'segreta')).toBe(false);
    expect(samePassword('segretaa', 'segreta')).toBe(false);
    expect(samePassword(null, 'segreta')).toBe(false);
    expect(samePassword('', '')).toBe(false);
  });

  it("respinge le richieste senza parola d'ordine corretta senza contattare DeepL", async () => {
    const deepl = vi.fn();
    for (const password of [null, 'sbagliata']) {
      const res = await handle(request('/api/utilizzo', { password }), ENV, deepl);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'parola_d_ordine' });
      expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    }
    expect(deepl).not.toHaveBeenCalled();
  });

  it('segnala la configurazione mancante', async () => {
    const res = await handle(request('/api/utilizzo'), { PASSWORD: 'segreta' }, vi.fn());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'configurazione' });
  });
});

describe('RF-05 RF-10 inoltro a DeepL', () => {
  it('sceglie il server DeepL in base al tipo di chiave', () => {
    expect(deeplHost('abc:fx')).toBe('https://api-free.deepl.com');
    expect(deeplHost('abc')).toBe('https://api.deepl.com');
  });

  it('traduce con i tag XML e restituisce la lingua rilevata', async () => {
    const deepl = vi.fn(async () =>
      json({ translations: [{ text: 'Ciao <t1>mondo</t1>', detected_source_language: 'EN' }] }),
    );
    const res = await handle(request('/api/traduci', { method: 'POST', body: translateBody }), ENV, deepl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translations: [{ text: 'Ciao <t1>mondo</t1>', detected: 'EN' }] });
    const [url, init] = deepl.mock.calls[0];
    expect(url).toBe('https://api-free.deepl.com/v2/translate');
    expect(init.headers.authorization).toBe('DeepL-Auth-Key chiave:fx');
    expect(JSON.parse(init.body)).toEqual({
      text: ['Hello <t1>world</t1>'],
      target_lang: 'IT',
      tag_handling: 'xml',
      preserve_formatting: true,
    });
  });

  it('RF-02 riduce la lingua di origine al codice accettato da DeepL', async () => {
    const deepl = vi.fn(async () => json({ translations: [{ text: 'x' }] }));
    await handle(request('/api/traduci', { method: 'POST', body: { ...translateBody, source: 'EN-GB' } }), ENV, deepl);
    expect(JSON.parse(deepl.mock.calls[0][1].body).source_lang).toBe('EN');
  });

  it('restituisce caratteri usati e limite mensile', async () => {
    const deepl = vi.fn(async () => json({ character_count: 10, character_limit: 500000 }));
    const res = await handle(request('/api/utilizzo'), ENV, deepl);
    expect(await res.json()).toEqual({ used: 10, limit: 500000 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('RF-12 traduce gli errori di DeepL in codici del proxy', async () => {
    const cases = [
      [403, 502, 'configurazione'],
      [456, 429, 'quota'],
      [429, 429, 'troppe_richieste'],
      [400, 400, 'richiesta_non_valida'],
      [503, 502, 'servizio'],
    ];
    for (const [deeplStatus, status, error] of cases) {
      const res = await handle(request('/api/utilizzo'), ENV, async () => new Response('', { status: deeplStatus }));
      expect([res.status, (await res.json()).error]).toEqual([status, error]);
    }
    const down = await handle(request('/api/utilizzo'), ENV, async () => {
      throw new Error('rete');
    });
    expect([down.status, (await down.json()).error]).toEqual([502, 'servizio']);
  });
});

describe('RNF-01 limiti e origini consentite', () => {
  it('valida il corpo della richiesta di traduzione', () => {
    expect(validateTranslation(translateBody)).toBeNull();
    expect(validateTranslation(null)).toBe('texts');
    expect(validateTranslation({ texts: [], target: 'IT' })).toBe('texts');
    expect(validateTranslation({ texts: Array(LIMITS.maxTexts + 1).fill('a'), target: 'IT' })).toBe('texts');
    expect(validateTranslation({ texts: [1], target: 'IT' })).toBe('texts');
    expect(validateTranslation({ texts: ['a'], target: 'italiano' })).toBe('target');
    expect(validateTranslation({ texts: ['a'], target: 'IT', source: 'x' })).toBe('source');
  });

  it('respinge corpi non validi o troppo grandi', async () => {
    const deepl = vi.fn();
    const bad = await handle(request('/api/traduci', { method: 'POST', body: '{' }), ENV, deepl);
    expect(bad.status).toBe(400);
    const invalid = await handle(request('/api/traduci', { method: 'POST', body: { texts: 'a' } }), ENV, deepl);
    expect(await invalid.json()).toEqual({ error: 'richiesta_non_valida', campo: 'texts' });
    const big = { texts: ['a'.repeat(LIMITS.maxBodyBytes)], target: 'IT' };
    const tooBig = await handle(request('/api/traduci', { method: 'POST', body: big }), ENV, deepl);
    expect([tooBig.status, (await tooBig.json()).error]).toEqual([413, 'troppo_grande']);
    expect(deepl).not.toHaveBeenCalled();
  });

  it('risponde 404 ai percorsi sconosciuti', async () => {
    const res = await handle(request('/altro'), ENV, vi.fn());
    expect(res.status).toBe(404);
  });

  it('autorizza CORS solo per le origini configurate', async () => {
    const pre = await handle(request('/api/traduci', { method: 'OPTIONS', password: null }), ENV, vi.fn());
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(pre.headers.get('access-control-allow-headers')).toContain('x-password');
    const other = await handle(request('/api/utilizzo', { origin: 'https://altro.example' }), ENV, vi.fn());
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('espone il gestore predefinito per Cloudflare', async () => {
    const res = await worker.fetch(request('/api/utilizzo', { password: 'x' }), ENV);
    expect(res.status).toBe(401);
  });
});
