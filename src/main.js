import './style.css';
import { t, translateDom } from './i18n/index.js';
import { LANGUAGES, byCode } from './lib/languages.js';
import { detectLanguage } from './lib/detect.js';
import {
  MODELS,
  createAnthropicTranslator,
  describeApiError,
  estimateCost,
  translateSegments,
} from './lib/translate.js';
import { FORMATS, formatFromName, inspectFile, translateFile } from './lib/pipeline.js';

const $ = (id) => document.getElementById(id);
const KEY_STORAGE = 'traduttore.apiKey';
const PREFS_STORAGE = 'traduttore.prefs';

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* archiviazione non disponibile: si prosegue senza memorizzare */
    }
  },
};

const state = { file: null, buffer: null, format: null, segments: [], detected: null, controller: null, url: null };

function option(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function setup() {
  translateDom(document);
  for (const m of MODELS) $('model').append(option(m.id, t(m.labelKey)));
  $('source').append(option('', t('opt.auto')));
  for (const l of LANGUAGES) {
    $('source').append(option(l.code, l.name));
    $('target').append(option(l.code, l.name));
  }
  $('target').value = 'it';
  for (const [k, f] of Object.entries(FORMATS)) $('out-format').append(option(k, t(f.labelKey)));

  const prefs = JSON.parse(store.get(PREFS_STORAGE) || '{}');
  if (prefs.model && MODELS.some((m) => m.id === prefs.model)) $('model').value = prefs.model;
  if (prefs.target && byCode(prefs.target)) $('target').value = prefs.target;
  const savedKey = store.get(KEY_STORAGE);
  if (savedKey) {
    $('api-key').value = savedKey;
    $('remember').checked = true;
  }

  const savePrefs = () =>
    store.set(PREFS_STORAGE, JSON.stringify({ model: $('model').value, target: $('target').value }));
  $('model').addEventListener('change', () => {
    savePrefs();
    showInfo();
  });
  $('target').addEventListener('change', () => {
    savePrefs();
    showInfo();
  });
  $('source').addEventListener('change', showInfo);
  $('out-format').addEventListener('change', updateFormatNote);
  $('api-key').addEventListener('input', () => {
    if ($('remember').checked) store.set(KEY_STORAGE, $('api-key').value.trim() || null);
    updateButton();
  });
  $('remember').addEventListener('change', () =>
    store.set(KEY_STORAGE, $('remember').checked ? $('api-key').value.trim() || null : null),
  );

  const drop = $('drop');
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('file').click();
    }
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  $('file').addEventListener('change', () => $('file').files[0] && loadFile($('file').files[0]));
  $('translate').addEventListener('click', run);
  $('cancel').addEventListener('click', () => state.controller?.abort());
}

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

function updateButton() {
  $('translate').disabled = !(state.segments.length && $('api-key').value.trim() && !state.controller);
}

function updateFormatNote() {
  const out = $('out-format').value;
  const notes = [];
  if (state.format && out === state.format && (out === 'docx' || out === 'epub')) {
    notes.push(t('note.inPlace'));
  } else if (state.format && out !== state.format) {
    notes.push(t('note.convert'));
  }
  if (state.format === 'pdf') notes.push(t('note.fromPdf'));
  if (out === 'pdf' && ['zh', 'ja', 'ko', 'ar', 'he', 'fa', 'hi', 'th'].includes($('target').value)) {
    notes.push(t('note.pdfScript'));
  }
  $('format-note').textContent = notes.join(' ');
}

function showInfo() {
  const info = $('file-info');
  if (!state.file) {
    info.hidden = true;
    return;
  }
  const est = estimateCost(state.segments, $('model').value);
  const source = $('source').value ? byCode($('source').value) : state.detected;
  const usd = est.usd < 0.01 ? '< 0,01' : est.usd.toLocaleString('it-IT', { maximumFractionDigits: 2 });
  const rows = [
    [t('info.file'), `${state.file.name} (${Math.max(1, Math.round(state.file.size / 1024))} KB)`],
    [t('info.format'), t(FORMATS[state.format].labelKey)],
    [t('info.detected'), state.detected ? state.detected.name : t('info.undetected')],
    [
      t('info.text'),
      t('info.textValue', { chars: est.chars.toLocaleString('it-IT'), tokens: est.tokens.toLocaleString('it-IT') }),
    ],
    [t('info.cost'), t('info.costValue', { usd })],
  ];
  info.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
  info.hidden = false;
  if (source && source.code === $('target').value) {
    setStatus(t('info.sameLanguage', { lang: source.name }), 'warn');
  } else if ($('status').className === 'warn') setStatus('');
  updateFormatNote();
}

async function loadFile(file) {
  resetDownload();
  const format = formatFromName(file.name);
  if (!format) {
    setStatus(t('file.unsupported'), 'error');
    return;
  }
  state.file = file;
  state.format = format;
  state.segments = [];
  state.detected = null;
  $('drop-text').textContent = file.name;
  $('out-format').value = format;
  setStatus(t('file.analyzing'));
  updateButton();
  try {
    state.buffer = await file.arrayBuffer();
    const { segments } = await inspectFile(state.buffer, format, file.name);
    if (!segments.length) throw new Error(t('file.empty'));
    state.segments = segments;
    state.detected = detectLanguage(segments);
    setStatus('');
  } catch (err) {
    state.segments = [];
    setStatus(err.message || String(err), 'error');
  }
  showInfo();
  updateButton();
}

function resetDownload() {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = null;
  $('download').hidden = true;
}

async function run() {
  resetDownload();
  const apiKey = $('api-key').value.trim();
  const target = byCode($('target').value);
  const source = $('source').value ? byCode($('source').value) : state.detected;
  const outFormat = $('out-format').value;
  const controller = new AbortController();
  state.controller = controller;
  updateButton();
  $('cancel').hidden = false;
  $('progress-wrap').hidden = false;
  $('progress').value = 0;
  $('progress-text').textContent = '';
  setStatus(t('run.inProgress', { lang: target.name }));

  const translator = createAnthropicTranslator({
    apiKey,
    model: $('model').value,
    sourceLang: source,
    targetLang: target,
    signal: controller.signal,
  });
  const translateAll = (segments) =>
    translateSegments(segments, translator, {
      signal: controller.signal,
      onProgress: (done, total) => {
        $('progress').value = total ? done / total : 1;
        $('progress-text').textContent = t('run.progress', { done, total });
      },
    });

  try {
    const { blob, filename } = await translateFile({
      buffer: state.buffer,
      name: state.file.name,
      inFormat: state.format,
      outFormat,
      translateAll,
      targetCode: target.code,
    });
    state.url = URL.createObjectURL(blob);
    const a = $('download');
    a.href = state.url;
    a.download = filename;
    a.textContent = t('run.download', { file: filename });
    a.hidden = false;
    setStatus(t('run.done'), 'ok');
  } catch (err) {
    setStatus(describeApiError(err), 'error');
  } finally {
    state.controller = null;
    $('cancel').hidden = true;
    updateButton();
  }
}

setup();
