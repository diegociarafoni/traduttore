import './style.css';
import { t, translateDom } from './i18n/index.js';
import { LANGUAGES, byCode } from './lib/languages.js';
import { detectLanguage } from './lib/detect.js';
import { countCharacters, createClient, describeError, translateSegments } from './lib/translate.js';
import { FORMATS, formatFromName, inspectFile, translateFile } from './lib/pipeline.js';

const $ = (id) => document.getElementById(id);
const API_URL = import.meta.env.VITE_API_URL;
const PASSWORD_STORAGE = 'traduttore.password';
const PREFS_STORAGE = 'traduttore.prefs';
const nf = (n) => n.toLocaleString('it-IT');

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

const state = {
  file: null,
  buffer: null,
  format: null,
  segments: [],
  detected: null,
  client: null,
  usage: null,
  controller: null,
  url: null,
};

function option(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function setup() {
  translateDom(document);
  $('source').append(option('', t('opt.auto')));
  for (const l of [...LANGUAGES].sort((a, b) => a.name.localeCompare(b.name, 'it'))) {
    $('source').append(option(l.code, l.name));
    $('target').append(option(l.code, l.name));
  }
  $('target').value = 'it';
  for (const [k, f] of Object.entries(FORMATS)) $('out-format').append(option(k, t(f.labelKey)));

  const prefs = JSON.parse(store.get(PREFS_STORAGE) || '{}');
  if (prefs.target && byCode(prefs.target)) $('target').value = prefs.target;
  $('target').addEventListener('change', () => {
    store.set(PREFS_STORAGE, JSON.stringify({ target: $('target').value }));
    showInfo();
  });
  $('source').addEventListener('change', showInfo);
  $('out-format').addEventListener('change', updateFormatNote);

  $('login').addEventListener('submit', (e) => {
    e.preventDefault();
    login();
  });
  $('password').addEventListener('input', () => {
    state.client = null;
    state.usage = null;
    $('access').textContent = '';
    updateButton();
  });
  $('remember').addEventListener('change', () => {
    store.set(PASSWORD_STORAGE, $('remember').checked && state.client ? $('password').value : null);
  });
  const saved = store.get(PASSWORD_STORAGE);
  if (saved) {
    $('password').value = saved;
    $('remember').checked = true;
    login();
  }

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

async function login() {
  const password = $('password').value;
  if (!password) return;
  const client = createClient({ apiUrl: API_URL, password });
  $('access').className = '';
  $('access').textContent = t('access.checking');
  try {
    const usage = await client.usage();
    // Se nel frattempo il campo è cambiato, l'esito riguarda una parola d'ordine non più valida.
    if ($('password').value !== password) return;
    state.usage = usage;
    state.client = client;
    $('access').className = 'ok';
    $('access').textContent = t('access.ok');
    store.set(PASSWORD_STORAGE, $('remember').checked ? password : null);
  } catch (err) {
    if ($('password').value !== password) return;
    state.client = null;
    state.usage = null;
    $('access').className = 'error';
    $('access').textContent = describeError(err);
    // Si dimentica la parola d'ordine solo se è errata, non per un problema di rete o del servizio.
    if (err?.code === 'parola_d_ordine') store.set(PASSWORD_STORAGE, null);
  }
  showInfo();
  updateButton();
}

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

function updateButton() {
  $('translate').disabled = !(state.segments.length && state.client && !state.controller);
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
  if (out === 'pdf' && ['zh', 'ja', 'ko', 'ar'].includes($('target').value)) notes.push(t('note.pdfScript'));
  $('format-note').textContent = notes.join(' ');
}

function showInfo() {
  const info = $('file-info');
  if (!state.file) {
    info.hidden = true;
    return;
  }
  const chars = countCharacters(state.segments);
  const rows = [
    [t('info.file'), `${state.file.name} (${Math.max(1, Math.round(state.file.size / 1024))} KB)`],
    [t('info.format'), t(FORMATS[state.format].labelKey)],
    [t('info.detected'), state.detected ? state.detected.name : t('info.undetected')],
    [t('info.text'), t('info.textValue', { chars: nf(chars) })],
  ];
  if (state.usage?.limit) {
    rows.push([t('info.quota'), t('info.quotaValue', { left: nf(Math.max(0, state.usage.limit - state.usage.used)) })]);
  }
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
  const source = $('source').value ? byCode($('source').value) : state.detected;
  if (state.usage?.limit && chars > state.usage.limit - state.usage.used) {
    setStatus(t('info.overQuota'), 'warn');
  } else if (source && source.code === $('target').value) {
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
  const target = byCode($('target').value);
  // Senza scelta esplicita la lingua di origine la rileva DeepL, più affidabile della stima locale.
  const source = $('source').value ? byCode($('source').value) : null;
  const outFormat = $('out-format').value;
  const controller = new AbortController();
  state.controller = controller;
  updateButton();
  $('cancel').hidden = false;
  $('progress-wrap').hidden = false;
  $('progress').value = 0;
  $('progress-text').textContent = '';
  setStatus(t('run.inProgress', { lang: target.name }));

  const translator = state.client.translator({ sourceLang: source, targetLang: target, signal: controller.signal });
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
    state.client
      .usage()
      .then((u) => {
        state.usage = u;
        showInfo();
      })
      .catch(() => {});
  } catch (err) {
    setStatus(describeError(err), 'error');
  } finally {
    state.controller = null;
    $('cancel').hidden = true;
    updateButton();
  }
}

setup();
