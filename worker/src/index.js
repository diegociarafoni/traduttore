// Proxy tra il sito statico e DeepL: custodisce la chiave DeepL, controlla la parola d'ordine
// e limita le richieste. Variabili: DEEPL_KEY e PASSWORD (segreti), ALLOWED_ORIGINS (elenco separato da virgole),
// LIMITATORE (limite di frequenza per indirizzo IP, configurato in wrangler.toml).

export const LIMITS = { maxTexts: 50, maxBodyBytes: 120_000 };

const TARGET_ONLY = { 'EN-GB': 'EN', 'EN-US': 'EN', 'PT-PT': 'PT', 'PT-BR': 'PT', 'ZH-HANS': 'ZH', 'ZH-HANT': 'ZH' };
const LANG = /^[A-Z]{2}(-[A-Z]{2,4})?$/;

export function deeplHost(key) {
  return key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

// Confronto a tempo costante: la durata non rivela quanti caratteri iniziali coincidono.
export function samePassword(given, expected) {
  const enc = new TextEncoder();
  const a = enc.encode(given || '');
  const b = enc.encode(expected || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return b.length > 0 && diff === 0;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-password',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
  });
}

function deeplError(status) {
  if (status === 403) return json({ error: 'configurazione' }, 502);
  if (status === 456) return json({ error: 'quota' }, 429);
  if (status === 429) return json({ error: 'troppe_richieste' }, 429);
  if (status === 400) return json({ error: 'richiesta_non_valida' }, 400);
  return json({ error: 'servizio' }, 502);
}

export function validateTranslation(body) {
  if (!body || !Array.isArray(body.texts) || !body.texts.length) return 'texts';
  if (body.texts.length > LIMITS.maxTexts) return 'texts';
  if (!body.texts.every((t) => typeof t === 'string')) return 'texts';
  if (typeof body.target !== 'string' || !LANG.test(body.target)) return 'target';
  if (body.source != null && (typeof body.source !== 'string' || !LANG.test(body.source))) return 'source';
  return null;
}

async function translate(request, env, fetchImpl) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) return json({ error: 'troppo_grande' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'richiesta_non_valida' }, 400);
  }
  const invalid = validateTranslation(body);
  if (invalid) return json({ error: 'richiesta_non_valida', campo: invalid }, 400);
  const payload = {
    text: body.texts,
    target_lang: body.target,
    tag_handling: 'xml',
    preserve_formatting: true,
  };
  if (body.source) payload.source_lang = TARGET_ONLY[body.source] || body.source;
  const res = await fetchImpl(`${deeplHost(env.DEEPL_KEY)}/v2/translate`, {
    method: 'POST',
    headers: { authorization: `DeepL-Auth-Key ${env.DEEPL_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return deeplError(res.status);
  const data = await res.json();
  return json(
    { translations: data.translations.map((t) => ({ text: t.text, detected: t.detected_source_language })) },
    200,
  );
}

async function usage(env, fetchImpl) {
  const res = await fetchImpl(`${deeplHost(env.DEEPL_KEY)}/v2/usage`, {
    headers: { authorization: `DeepL-Auth-Key ${env.DEEPL_KEY}` },
  });
  if (!res.ok) return deeplError(res.status);
  const data = await res.json();
  return json({ used: data.character_count, limit: data.character_limit }, 200);
}

export async function handle(request, env, fetchImpl = fetch) {
  const cors = corsHeaders(request, env);
  const withCors = (response) => {
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DEEPL_KEY || !env.PASSWORD) return withCors(json({ error: 'configurazione' }, 500));
  const { pathname } = new URL(request.url);
  const route = `${request.method} ${pathname}`;
  if (route !== 'POST /api/traduci' && route !== 'GET /api/utilizzo') {
    return withCors(json({ error: 'non_trovato' }, 404));
  }
  // Il limite vale per ogni richiesta, così rallenta anche i tentativi di indovinare la parola d'ordine.
  if (env.LIMITATORE) {
    const ip = request.headers.get('cf-connecting-ip') || 'sconosciuto';
    const { success } = await env.LIMITATORE.limit({ key: ip });
    if (!success) return withCors(json({ error: 'troppe_richieste' }, 429));
  }
  if (!samePassword(request.headers.get('x-password'), env.PASSWORD)) {
    return withCors(json({ error: 'parola_d_ordine' }, 401));
  }
  try {
    const response =
      route === 'GET /api/utilizzo' ? await usage(env, fetchImpl) : await translate(request, env, fetchImpl);
    return withCors(response);
  } catch {
    return withCors(json({ error: 'servizio' }, 502));
  }
}

export default {
  fetch: (request, env) => handle(request, env),
};
