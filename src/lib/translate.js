import { collectIds, parseTagged, sameIds } from './tagged.js';
import { t } from '../i18n/index.js';

// Limiti del proxy (worker/src/index.js): 50 testi e 120 kB per richiesta.
const MAX_BATCH_CHARS = 30000;
const MAX_BATCH_SEGMENTS = 50;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export class ServiceError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

// Segmenti composti solo da numeri, punteggiatura, simboli o tag non vengono inviati.
export function needsTranslation(segment) {
  const text = segment.replace(/<\/?\d+\/?>/g, '').replace(/&(amp|lt|gt);/g, '');
  return /\p{L}/u.test(text);
}

// DeepL accetta solo XML ben formato: i tag numerati <1> diventano <t1>.
export function toDeeplXml(segment) {
  return segment.replace(/<(\/?)(\d+)(\/?)>/g, '<$1t$2$3>');
}

export function fromDeeplXml(text) {
  return text.replace(/<(\/?)t(\d+)\s*(\/?)>/g, '<$1$2$3>');
}

export function makeBatches(items, maxChars = MAX_BATCH_CHARS, maxSegments = MAX_BATCH_SEGMENTS) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const item of items) {
    if (current.length && (size + item.text.length > maxChars || current.length >= maxSegments)) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

function tagsPreserved(source, translated) {
  const src = parseTagged(source);
  const dst = parseTagged(translated);
  if (!src || !dst) return false;
  return sameIds(collectIds(src), collectIds(dst));
}

// Caratteri fatturati da DeepL: il testo visibile, senza tag.
export function countCharacters(segments) {
  return segments
    .filter(needsTranslation)
    .reduce((n, s) => n + s.replace(/<\/?\d+\/?>/g, '').replace(/&(amp|lt|gt);/g, '&').length, 0);
}

// Traduce un elenco di segmenti con una funzione `translateBatch(segments) => string[]`.
// Gestisce deduplicazione, lotti, parallelismo, controllo dei tag e ritentativi.
export async function translateSegments(segments, translateBatch, { concurrency = 2, onProgress, signal } = {}) {
  const result = segments.slice();
  const unique = new Map();
  segments.forEach((s, i) => {
    if (!needsTranslation(s)) return;
    if (!unique.has(s)) unique.set(s, []);
    unique.get(s).push(i);
  });
  const items = [...unique.keys()].map((text) => ({ text }));
  const total = items.length;
  let done = 0;
  onProgress?.(0, total);

  const runBatch = async (batch, depth = 0) => {
    if (signal?.aborted) throw new DOMException(t('error.aborted'), 'AbortError');
    const translated = await translateBatch(batch.map((b) => b.text));
    const missing = [];
    batch.forEach((item, i) => {
      const out = translated[i];
      const lastTry = depth >= 3;
      if (out == null || (!lastTry && /<\/?\d+\/?>/.test(item.text) && !tagsPreserved(item.text, out))) {
        missing.push(item);
      } else {
        item.translation = out;
      }
    });
    if (missing.length) {
      if (depth < 2 && missing.length > 1) {
        const half = Math.ceil(missing.length / 2);
        await runBatch(missing.slice(0, half), depth + 1);
        await runBatch(missing.slice(half), depth + 1);
        return;
      }
      if (depth < 3) {
        await runBatch(missing, depth + 1);
        return;
      }
    }
    done += batch.length - missing.length;
    onProgress?.(Math.min(done, total), total);
  };

  const queue = makeBatches(items);
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await runBatch(queue.shift());
  });
  await Promise.all(workers);
  onProgress?.(total, total);

  for (const item of items) {
    if (item.translation == null) continue;
    for (const i of unique.get(item.text)) result[i] = item.translation;
  }
  return result;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({ apiUrl, password, fetch = globalThis.fetch, sleep = wait, retries = 3 }) {
  const base = String(apiUrl).replace(/\/+$/, '');
  const call = async (path, init = {}, signal) => {
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(`${base}${path}`, {
          ...init,
          signal,
          headers: { ...init.headers, 'x-password': password },
        });
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new ServiceError('connessione');
      }
      if (res.ok) return res.json();
      const body = await res.json().catch(() => ({}));
      // La quota esaurita non si libera ritentando: si interrompe subito.
      if (RETRY_STATUS.has(res.status) && body.error !== 'quota' && attempt < retries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new ServiceError(body.error || 'servizio', res.status);
    }
  };

  return {
    usage: (signal) => call('/api/utilizzo', {}, signal),
    translator({ sourceLang, targetLang, signal }) {
      return async (texts) => {
        const body = { texts: texts.map(toDeeplXml), target: targetLang.deepl.target };
        if (sourceLang) body.source = sourceLang.deepl.source;
        const data = await call(
          '/api/traduci',
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
          signal,
        );
        return texts.map((_, i) => (data.translations?.[i] ? fromDeeplXml(data.translations[i].text) : null));
      };
    },
  };
}

const ERRORS = {
  parola_d_ordine: () => t('error.password'),
  quota: () => t('error.quota'),
  troppe_richieste: () => t('error.rateLimit'),
  connessione: () => t('error.connection'),
  configurazione: () => t('error.config'),
  troppo_grande: () => t('error.tooLarge'),
};

export function describeError(err) {
  if (err?.name === 'AbortError') return t('error.aborted');
  if (err instanceof ServiceError) {
    return (
      (Object.hasOwn(ERRORS, err.code) && ERRORS[err.code]()) || t('error.service', { status: err.status ?? 'n/d' })
    );
  }
  return err?.message || String(err);
}
