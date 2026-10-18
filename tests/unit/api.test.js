import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createAnthropicTranslator, describeApiError } from '../../src/lib/translate.js';
import { byCode, byIso3, LANGUAGES } from '../../src/lib/languages.js';
import { t } from '../../src/i18n/index.js';
import { fakeReply, sseBody } from '../support/fake-api.js';

const sse = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': status === 200 ? 'text/event-stream' : 'application/json' },
  });

function fakeFetch(handler) {
  return vi.fn(async (url, init) => handler(JSON.parse(init.body), init));
}

const opts = (fetch, model = 'claude-opus-5-5') => ({
  apiKey: 'sk-test',
  model,
  sourceLang: byCode('en'),
  targetLang: byCode('it'),
  fetch,
});

describe('RF-09 RF-05 chiamata al servizio di traduzione', () => {
  it('invia i segmenti numerati con il fallback lato server e rilegge la risposta', async () => {
    const fetch = fakeFetch((body) => sse(sseBody(fakeReply(body))));
    const translate = createAnthropicTranslator(opts(fetch));
    expect(await translate(['Hello', 'a <1>b</1>'])).toEqual(['[it] Hello', '[it] a <1>b</1>']);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain('/v1/messages');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.system).toContain('from English into Italian');
    expect(new Headers(init.headers).get('anthropic-dangerous-direct-browser-access')).toBe('true');
  });

  it('non chiede il fallback lato server con Haiku', async () => {
    const fetch = fakeFetch((body) => sse(sseBody(fakeReply(body))));
    await createAnthropicTranslator(opts(fetch, 'claude-haiku-5-5'))(['Hello']);
    expect(JSON.parse(fetch.mock.calls[0][1].body).fallbacks).toBeUndefined();
  });

  it('riprova senza fallback se il servizio non lo accetta', async () => {
    let calls = 0;
    const fetch = fakeFetch((body) => {
      calls++;
      if (body.fallbacks) {
        return sse(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'fallbacks: not supported' },
          }),
          400,
        );
      }
      return sse(sseBody(fakeReply(body)));
    });
    const translate = createAnthropicTranslator(opts(fetch));
    expect(await translate(['Hello'])).toEqual(['[it] Hello']);
    expect(await translate(['World'])).toEqual(['[it] World']);
    expect(calls).toBe(3);
  });

  it('RF-12 segnala il rifiuto del modello', async () => {
    const fetch = fakeFetch(() => sse(sseBody('', { stopReason: 'refusal' })));
    await expect(createAnthropicTranslator(opts(fetch))(['Hello'])).rejects.toThrow(t('error.refusal'));
  });
});

describe('RF-12 messaggi di errore comprensibili', () => {
  const apiError = (status) => Anthropic.APIError.generate(status, { error: { message: 'x' } }, 'x', new Headers());

  it('traduce gli errori del servizio', () => {
    expect(describeApiError(apiError(401))).toBe(t('error.auth'));
    expect(describeApiError(apiError(403))).toBe(t('error.permission'));
    expect(describeApiError(apiError(429))).toBe(t('error.rateLimit'));
    expect(describeApiError(apiError(500))).toContain('500');
    expect(describeApiError(new Anthropic.APIConnectionError({ message: 'rete' }))).toBe(t('error.connection'));
    expect(describeApiError(new DOMException('x', 'AbortError'))).toBe(t('error.aborted'));
    expect(describeApiError(new Error('altro'))).toBe('altro');
  });
});

describe('RNF-03 testi e lingue', () => {
  it('sostituisce i parametri e ricade sulla chiave se manca', () => {
    expect(t('run.progress', { done: 1, total: 3 })).toBe('1 / 3 segmenti');
    expect(t('chiave.assente')).toBe('chiave.assente');
    expect(t('run.download')).toBe('Scarica {file}');
  });

  it("RF-03 offre l'italiano e i nomi delle lingue dal catalogo", () => {
    expect(byCode('it').name).toBe('Italiano');
    expect(byIso3('deu').code).toBe('de');
    expect(byCode('xx')).toBeNull();
    expect(LANGUAGES.every((l) => l.name && !l.name.startsWith('lang.'))).toBe(true);
  });
});
