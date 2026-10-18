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
  // Un valore danneggiato non deve impedire l'avvio della pagina.
  getJson(k) {
    try {
      return JSON.parse(store.get(k)) ?? {};
    } catch {
      return {};
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
  loading: null,
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

  const prefs = store.getJson(PREFS_STORAGE);
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
    $('password').removeAttribute('aria-invalid');
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
  // Durante la traduzione il documento non si cambia: il risultato riguarderebbe il file precedente.
  const pickFile = () => !state.controller && $('file').click();
  drop.addEventListener('click', pickFile);
  drop.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      pickFile();
    }
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!state.controller) drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (!state.controller && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  $('file').addEventListener('change', () => $('file').files[0] && loadFile($('file').files[0]));
  $('translate').addEventListener('click', run);
  $('cancel').addEventListener('click', () => state.controller?.abort());
  updateButton();
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
    $('password').removeAttribute('aria-invalid');
    store.set(PASSWORD_STORAGE, $('remember').checked ? password : null);
  } catch (err) {
    if ($('password').value !== password) return;
    state.client = null;
    state.usage = null;
    $('access').className = 'error';
    $('access').textContent = describeError(err);
    $('password').setAttribute('aria-invalid', 'true');
    // Si dimentica la parola d'ordine solo se è errata, non per un problema di rete o del servizio.
    if (err?.code === 'parola_d_ordine') store.set(PASSWORD_STORAGE, null);
  }
  showInfo();
  updateButton();
}

// `info` marca gli avvisi derivati dal documento, che showInfo rimuove quando non valgono più;
// gli esiti della traduzione restano finché l'utente non agisce.
function setStatus(text, kind = '', { info = false } = {}) {
  $('status').textContent = text;
  $('status').className = kind;
  $('status').toggleAttribute('data-info', info);
}

// Abilita Traduci solo con accesso e documento, e spiega cosa manca; durante la traduzione
// blocca documento e opzioni, che non avrebbero effetto sul lavoro in corso.
function updateButton() {
  const running = !!state.controller;
  let missing = '';
  if (!state.client && !state.segments.length) missing = t('run.needBoth');
  else if (!state.client) missing = t('run.needLogin');
  else if (!state.segments.length) missing = t('run.needFile');
  $('translate').disabled = running || !!missing;
  $('translate-hint').textContent = running ? '' : missing;
  $('file').disabled = running;
  $('drop').setAttribute('aria-disabled', String(running));
  for (const id of ['source', 'target', 'out-format']) $(id).disabled = running;
}

function updateFormatNote() {
  const out = $('out-format').value;
  const notes = [];
  if (state.format && out === state.format && FORMATS[out].inPlace) {
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
  updateFormatNote();
  // Gli avvisi sul documento non coprono gli esiti di analisi e traduzione ancora visibili.
  if ($('status').textContent && !$('status').hasAttribute('data-info')) return;
  const source = $('source').value ? byCode($('source').value) : state.detected;
  if (state.usage?.limit && chars > state.usage.limit - state.usage.used) {
    setStatus(t('info.overQuota'), 'warn', { info: true });
  } else if (source && source.code === $('target').value) {
    setStatus(t('info.sameLanguage', { lang: source.name }), 'warn', { info: true });
  } else setStatus('');
}

async function loadFile(file) {
  resetDownload();
  const format = formatFromName(file.name);
  if (!format) {
    setStatus(t('file.unsupported'), 'error');
    return;
  }
  // Se nel frattempo si carica un altro file, l'analisi di questo non deve sovrascriverlo.
  const token = Symbol(file.name);
  state.loading = token;
  state.file = file;
  state.format = format;
  state.segments = [];
  state.detected = null;
  $('drop-text').textContent = file.name;
  $('out-format').value = format;
  setStatus(t('file.analyzing'));
  updateButton();
  try {
    const buffer = await file.arrayBuffer();
    const { segments } = await inspectFile(buffer, format, file.name);
    if (state.loading !== token) return;
    if (!segments.length) throw new Error(t('file.empty'));
    state.buffer = buffer;
    state.segments = segments;
    state.detected = detectLanguage(segments);
    setStatus('');
  } catch (err) {
    if (state.loading !== token) return;
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
  let untranslated = 0;

  const translator = state.client.translator({ sourceLang: source, targetLang: target, signal: controller.signal });
  const translateAll = (segments) =>
    translateSegments(segments, translator, {
      signal: controller.signal,
      onProgress: (done, total) => {
        $('progress').value = total ? done / total : 1;
        $('progress-text').textContent = t('run.progress', { done, total });
      },
      onUntranslated: (n) => (untranslated += n),
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
    if (untranslated) setStatus(t('run.untranslated', { count: nf(untranslated) }), 'warn');
    else setStatus(t('run.done'), 'ok');
    a.focus();
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
