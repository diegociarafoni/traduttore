import { t } from '../i18n/index.js';

// Lingue supportate da DeepL: codice ISO 639-1, codici ISO 639-3 usati da franc per il
// rilevamento e codici DeepL di origine e destinazione. Il nome mostrato è nel catalogo dei testi.
const DATA = [
  { code: 'it', iso3: ['ita'], deepl: { source: 'IT', target: 'IT' } },
  { code: 'en', iso3: ['eng', 'sco'], deepl: { source: 'EN', target: 'EN-GB' } },
  { code: 'fr', iso3: ['fra'], deepl: { source: 'FR', target: 'FR' } },
  { code: 'de', iso3: ['deu'], deepl: { source: 'DE', target: 'DE' } },
  { code: 'es', iso3: ['spa'], deepl: { source: 'ES', target: 'ES' } },
  { code: 'pt', iso3: ['por'], deepl: { source: 'PT', target: 'PT-PT' } },
  { code: 'nl', iso3: ['nld'], deepl: { source: 'NL', target: 'NL' } },
  { code: 'ro', iso3: ['ron'], deepl: { source: 'RO', target: 'RO' } },
  { code: 'pl', iso3: ['pol'], deepl: { source: 'PL', target: 'PL' } },
  { code: 'cs', iso3: ['ces'], deepl: { source: 'CS', target: 'CS' } },
  { code: 'sk', iso3: ['slk'], deepl: { source: 'SK', target: 'SK' } },
  { code: 'sl', iso3: ['slv'], deepl: { source: 'SL', target: 'SL' } },
  { code: 'bg', iso3: ['bul'], deepl: { source: 'BG', target: 'BG' } },
  { code: 'ru', iso3: ['rus'], deepl: { source: 'RU', target: 'RU' } },
  { code: 'uk', iso3: ['ukr'], deepl: { source: 'UK', target: 'UK' } },
  { code: 'el', iso3: ['ell'], deepl: { source: 'EL', target: 'EL' } },
  { code: 'tr', iso3: ['tur'], deepl: { source: 'TR', target: 'TR' } },
  { code: 'sv', iso3: ['swe'], deepl: { source: 'SV', target: 'SV' } },
  { code: 'da', iso3: ['dan'], deepl: { source: 'DA', target: 'DA' } },
  { code: 'nb', iso3: ['nob', 'nno'], deepl: { source: 'NB', target: 'NB' } },
  { code: 'fi', iso3: ['fin'], deepl: { source: 'FI', target: 'FI' } },
  { code: 'hu', iso3: ['hun'], deepl: { source: 'HU', target: 'HU' } },
  { code: 'et', iso3: ['est', 'ekk'], deepl: { source: 'ET', target: 'ET' } },
  { code: 'lv', iso3: ['lvs', 'lav'], deepl: { source: 'LV', target: 'LV' } },
  { code: 'lt', iso3: ['lit'], deepl: { source: 'LT', target: 'LT' } },
  { code: 'ar', iso3: ['arb'], deepl: { source: 'AR', target: 'AR' } },
  { code: 'zh', iso3: ['cmn'], deepl: { source: 'ZH', target: 'ZH-HANS' } },
  { code: 'ja', iso3: ['jpn'], deepl: { source: 'JA', target: 'JA' } },
  { code: 'ko', iso3: ['kor'], deepl: { source: 'KO', target: 'KO' } },
  { code: 'id', iso3: ['ind', 'zlm'], deepl: { source: 'ID', target: 'ID' } },
];

export const LANGUAGES = DATA.map((l) => ({
  ...l,
  get name() {
    return t(`lang.${l.code}`);
  },
}));

export function byCode(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}

export function byIso3(iso3) {
  return LANGUAGES.find((l) => l.iso3.includes(iso3)) || null;
}
