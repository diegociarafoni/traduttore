import Anthropic from '@anthropic-ai/sdk';
import { collectIds, parseTagged, sameIds } from './tagged.js';
import { t } from '../i18n/index.js';

export const MODELS = [
  { id: 'claude-opus-5-5', labelKey: 'model.opus', input: 4, output: 20 },
  { id: 'claude-sonnet-5-5', labelKey: 'model.sonnet', input: 2, output: 10 },
  { id: 'claude-haiku-5-5', labelKey: 'model.haiku', input: 0.1, output: 0.5 },
];

const MAX_BATCH_CHARS = 6000;
const MAX_BATCH_SEGMENTS = 80;

// Segmenti composti solo da numeri, punteggiatura, simboli o tag non vengono inviati.
export function needsTranslation(segment) {
  const text = segment.replace(/<\/?\d+\/?>/g, '').replace(/&(amp|lt|gt);/g, '');
  return /\p{L}/u.test(text);
}

export function buildSystemPrompt({ sourceLang, targetLang }) {
  const source = sourceLang ? sourceLang.en : 'the language of the text (detect it automatically)';
  return [
    `You are a professional translator. Translate from ${source} into ${targetLang.en}.`,
    'The user sends numbered segments wrapped in <s i="N">...</s>. They are consecutive pieces of the same document: use the surrounding segments as context so terminology and style stay consistent.',
    'Rules:',
    '- Reply only with the translated segments, in the same order, each wrapped in <s i="N">...</s> with the same N. Do not merge, split, skip or add segments.',
    '- Numbered tags such as <1>, </1> and <2/> mark formatting. Keep every tag exactly once, unchanged, around the corresponding translated words; you may reorder them when the target grammar requires it.',
    '- Keep the entities &amp; &lt; &gt; as they are.',
    '- Keep Markdown inline syntax (**bold**, *italic*, `code`, [text](url), ![alt](url)) and translate only the visible text; never translate URLs or code.',
    '- Preserve leading and trailing spaces, numbers, proper names and the register of the original.',
    '- If a segment is already in the target language or must not be translated (code, identifiers), return it unchanged.',
  ].join('\n');
}

export function formatBatch(segments) {
  return segments.map((s, i) => `<s i="${i + 1}">${s}</s>`).join('\n');
}

export function parseBatch(text, expected) {
  const out = new Array(expected).fill(null);
  const re = /<s i="(\d+)">([\s\S]*?)<\/s>/g;
  let m;
  while ((m = re.exec(text))) {
    const i = Number(m[1]) - 1;
    if (i >= 0 && i < expected && out[i] === null) out[i] = m[2];
  }
  return out;
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

export function estimateCost(segments, modelId) {
  const model = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const chars = segments.filter(needsTranslation).reduce((n, s) => n + s.length, 0);
  const tokens = Math.ceil(chars / 3.5);
  const usd = (tokens * model.input + tokens * 1.3 * model.output) / 1e6;
  return { chars, tokens, usd };
}

// Traduce un elenco di segmenti con una funzione `translateBatch(segments) => string[]`.
// Gestisce deduplicazione, lotti, parallelismo, controllo dei tag e ritentativi.
export async function translateSegments(segments, translateBatch, { concurrency = 3, onProgress, signal } = {}) {
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
    const texts = batch.map((b) => b.text);
    const translated = await translateBatch(texts);
    const missing = [];
    batch.forEach((item, i) => {
      const t = translated[i];
      const lastTry = depth >= 3;
      if (t == null || (!lastTry && /<\/?\d+\/?>/.test(item.text) && !tagsPreserved(item.text, t))) {
        missing.push(item);
      } else {
        item.translation = t;
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

export function createAnthropicTranslator({ apiKey, model, sourceLang, targetLang, signal, fetch }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 4, ...(fetch ? { fetch } : {}) });
  const system = buildSystemPrompt({ sourceLang, targetLang });
  const supportsFallback = model !== 'claude-haiku-5-5';
  let useFallback = supportsFallback;

  const request = async (texts) => {
    const params = {
      model,
      max_tokens: 32000,
      system,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: formatBatch(texts) }],
    };
    if (useFallback) {
      try {
        return await client.beta.messages
          .stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
          .finalMessage();
      } catch (err) {
        if (!(err instanceof Anthropic.BadRequestError) || !/fallback/i.test(err.message)) throw err;
        useFallback = false;
      }
    }
    return client.messages.stream(params, { signal }).finalMessage();
  };

  return async (texts) => {
    const message = await request(texts);
    if (message.stop_reason === 'refusal') {
      throw new Error(t('error.refusal'));
    }
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return parseBatch(text, texts.length);
  };
}

export function describeApiError(err) {
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return t('error.aborted');
  if (err instanceof Anthropic.AuthenticationError) return t('error.auth');
  if (err instanceof Anthropic.PermissionDeniedError) return t('error.permission');
  if (err instanceof Anthropic.RateLimitError) return t('error.rateLimit');
  if (err instanceof Anthropic.APIConnectionError) return t('error.connection');
  if (err instanceof Anthropic.APIError) return t('error.api', { status: err.status ?? 'n/d', message: err.message });
  return err?.message || String(err);
}
