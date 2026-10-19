// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import worker, {
  CLAUDE_MODEL,
  LIMITS,
  deeplHost,
  handle,
  samePassword,
  validateTranslation,
} from '../../worker/src/index.js';

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
    expect(await res.json()).toEqual({ engines: ['deepl'], used: 10, limit: 500000 });
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
    expect(validateTranslation({ ...translateBody, engine: 'altro' })).toBe('engine');
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

  it("limita la frequenza delle richieste per indirizzo IP prima di controllare la parola d'ordine", async () => {
    const seen = [];
    const LIMITATORE = { limit: async ({ key }) => (seen.push(key), { success: seen.length <= 1 }) };
    const env = { ...ENV, LIMITATORE };
    const deepl = vi.fn(async () => json({ character_count: 1, character_limit: 2 }));
    const req = () => {
      const r = request('/api/utilizzo');
      r.headers.set('cf-connecting-ip', '203.0.113.7');
      return r;
    };
    expect((await handle(req(), env, deepl)).status).toBe(200);
    const blocked = await handle(req(), env, deepl);
    expect([blocked.status, (await blocked.json()).error]).toEqual([429, 'troppe_richieste']);
    expect(seen).toEqual(['203.0.113.7', '203.0.113.7']);
    expect(deepl).toHaveBeenCalledTimes(1);
  });

  it('espone il gestore predefinito per Cloudflare', async () => {
    const res = await worker.fetch(request('/api/utilizzo', { password: 'x' }), ENV);
    expect(res.status).toBe(401);
  });
});

// Risposta dell'API Messages di Claude con un unico blocco di testo.
function claudeMessage(text, stopReason = 'end_turn') {
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: CLAUDE_MODEL,
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
  return new Response(JSON.stringify(message), { status: 200, headers: { 'content-type': 'application/json' } });
}

const CLAUDE_ENV = { ANTHROPIC_API_KEY: 'sk-ant-prova', PASSWORD: 'segreta', ALLOWED_ORIGINS: ORIGIN };
const claudeError = (status) => async () =>
  new Response(JSON.stringify({ type: 'error', error: { type: 'errore', message: 'x' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('RF-22 motore Claude', () => {
  it('elenca i motori disponibili e la quota DeepL', async () => {
    const deepl = vi.fn(async () => json({ character_count: 10, character_limit: 500000 }));
    const res = await handle(request('/api/utilizzo'), { ...ENV, ...CLAUDE_ENV }, deepl);
    expect(await res.json()).toEqual({ engines: ['deepl', 'claude'], used: 10, limit: 500000 });
  });

  it('esclude DeepL se rifiuta la chiave ma Claude è configurato', async () => {
    const res = await handle(
      request('/api/utilizzo'),
      { ...ENV, ...CLAUDE_ENV },
      async () => new Response('', { status: 403 }),
    );
    expect([res.status, await res.json()]).toEqual([200, { engines: ['claude'] }]);
  });

  it('offre Claude anche se DeepL non risponde o risponde in modo illeggibile', async () => {
    const replies = [
      async () => new Response('<html>manutenzione</html>', { status: 200 }),
      async () => {
        throw new Error('rete');
      },
    ];
    for (const deepl of replies) {
      const res = await handle(request('/api/utilizzo'), { ...ENV, ...CLAUDE_ENV }, deepl);
      expect([res.status, await res.json()]).toEqual([200, { engines: ['claude'] }]);
    }
  });

  it('con la sola chiave Claude non contatta DeepL', async () => {
    const fetchImpl = vi.fn();
    const res = await handle(request('/api/utilizzo'), CLAUDE_ENV, fetchImpl);
    expect(await res.json()).toEqual({ engines: ['claude'] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ignora spazi e a capo attorno alle chiavi', async () => {
    const deepl = vi.fn(async () => json({ character_count: 1, character_limit: 2 }));
    await handle(request('/api/utilizzo'), { ...ENV, DEEPL_KEY: ' chiave:fx\n' }, deepl);
    const [url, init] = deepl.mock.calls[0];
    expect(url).toBe('https://api-free.deepl.com/v2/usage');
    expect(init.headers.authorization).toBe('DeepL-Auth-Key chiave:fx');
    const res = await handle(request('/api/utilizzo'), { PASSWORD: 'segreta', ANTHROPIC_API_KEY: '  ' }, vi.fn());
    expect([res.status, (await res.json()).error]).toEqual([500, 'configurazione']);
  });

  it('traduce con Claude chiedendo una risposta JSON con i tag conservati', async () => {
    const fetchImpl = vi.fn(async () => claudeMessage(JSON.stringify({ translations: ['Ciao <t1>mondo</t1>'] })));
    const body = { ...translateBody, engine: 'claude', source: 'EN-GB' };
    const res = await handle(request('/api/traduci', { method: 'POST', body }), { ...ENV, ...CLAUDE_ENV }, fetchImpl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translations: [{ text: 'Ciao <t1>mondo</t1>' }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(init.headers).get('x-api-key')).toBe('sk-ant-prova');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(CLAUDE_MODEL);
    expect(sent.stream).toBeUndefined();
    expect(sent.max_tokens).toBe(16000);
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(sent.system).toMatch(/tag/i);
    expect(JSON.parse(sent.messages[0].content)).toEqual({ source: 'EN-GB', target: 'IT', texts: translateBody.texts });
  });

  it('usa Claude in mancanza di DeepL e il modello configurato', async () => {
    const fetchImpl = vi.fn(async () => claudeMessage(JSON.stringify({ translations: ['a', 'b'] })));
    const env = { ...CLAUDE_ENV, CLAUDE_MODEL: 'claude-opus-5-5' };
    const res = await handle(
      request('/api/traduci', { method: 'POST', body: { texts: ['x', 'y'], target: 'IT' } }),
      env,
      fetchImpl,
    );
    expect(await res.json()).toEqual({ translations: [{ text: 'a' }, { text: 'b' }] });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('claude-opus-5-5');
  });

  it('lascia vuoto tutto il lotto se le traduzioni non si possono abbinare ai segmenti', async () => {
    const body = { texts: ['x', 'y'], target: 'IT', engine: 'claude' };
    const replies = [
      claudeMessage(JSON.stringify({ translations: ['x e y insieme'] })),
      claudeMessage(JSON.stringify({ translations: ['x', 'y', 'z'] })),
      claudeMessage(JSON.stringify({ translations: ['x', 2] })),
      claudeMessage('{"translations": ["x"', 'max_tokens'),
      claudeMessage('', 'refusal'),
      claudeMessage('non json'),
    ];
    for (const reply of replies) {
      const res = await handle(request('/api/traduci', { method: 'POST', body }), CLAUDE_ENV, async () => reply);
      expect([res.status, await res.json()]).toEqual([200, { translations: [null, null] }]);
    }
  });

  it('respinge un motore non configurato', async () => {
    const body = { ...translateBody, engine: 'claude' };
    const res = await handle(request('/api/traduci', { method: 'POST', body }), ENV, vi.fn());
    expect([res.status, await res.json()]).toEqual([400, { error: 'richiesta_non_valida', campo: 'engine' }]);
  });

  it('traduce gli errori di Claude in codici del proxy', async () => {
    const body = { ...translateBody, engine: 'claude' };
    const cases = [
      [401, 502, 'configurazione'],
      [403, 502, 'configurazione'],
      [429, 429, 'troppe_richieste'],
      [400, 400, 'richiesta_non_valida'],
      [529, 502, 'servizio'],
    ];
    for (const [claudeStatus, status, error] of cases) {
      const res = await handle(
        request('/api/traduci', { method: 'POST', body }),
        CLAUDE_ENV,
        claudeError(claudeStatus),
      );
      expect([res.status, (await res.json()).error]).toEqual([status, error]);
    }
  });
});
