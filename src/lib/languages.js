import { t } from '../i18n/index.js';

// Lingue supportate: codice ISO 639-1, codici ISO 639-3 usati da franc e nome inglese,
// che viene passato al modello. Il nome mostrato all'utente è nel catalogo dei testi.
const DATA = [
  { code: 'it', iso3: ['ita'], en: 'Italian' },
  { code: 'en', iso3: ['eng', 'sco'], en: 'English' },
  { code: 'fr', iso3: ['fra'], en: 'French' },
  { code: 'de', iso3: ['deu'], en: 'German' },
  { code: 'es', iso3: ['spa'], en: 'Spanish' },
  { code: 'pt', iso3: ['por'], en: 'Portuguese' },
  { code: 'nl', iso3: ['nld'], en: 'Dutch' },
  { code: 'ca', iso3: ['cat'], en: 'Catalan' },
  { code: 'ro', iso3: ['ron'], en: 'Romanian' },
  { code: 'pl', iso3: ['pol'], en: 'Polish' },
  { code: 'cs', iso3: ['ces'], en: 'Czech' },
  { code: 'sk', iso3: ['slk'], en: 'Slovak' },
  { code: 'sl', iso3: ['slv'], en: 'Slovenian' },
  { code: 'hr', iso3: ['hrv', 'bos'], en: 'Croatian' },
  { code: 'sr', iso3: ['srp'], en: 'Serbian' },
  { code: 'bg', iso3: ['bul'], en: 'Bulgarian' },
  { code: 'ru', iso3: ['rus'], en: 'Russian' },
  { code: 'uk', iso3: ['ukr'], en: 'Ukrainian' },
  { code: 'el', iso3: ['ell'], en: 'Greek' },
  { code: 'tr', iso3: ['tur'], en: 'Turkish' },
  { code: 'sv', iso3: ['swe'], en: 'Swedish' },
  { code: 'da', iso3: ['dan'], en: 'Danish' },
  { code: 'no', iso3: ['nob', 'nno'], en: 'Norwegian' },
  { code: 'fi', iso3: ['fin'], en: 'Finnish' },
  { code: 'hu', iso3: ['hun'], en: 'Hungarian' },
  { code: 'lt', iso3: ['lit'], en: 'Lithuanian' },
  { code: 'ar', iso3: ['arb'], en: 'Arabic' },
  { code: 'he', iso3: ['heb'], en: 'Hebrew' },
  { code: 'fa', iso3: ['pes'], en: 'Persian' },
  { code: 'hi', iso3: ['hin'], en: 'Hindi' },
  { code: 'zh', iso3: ['cmn'], en: 'Chinese (Simplified)' },
  { code: 'ja', iso3: ['jpn'], en: 'Japanese' },
  { code: 'ko', iso3: ['kor'], en: 'Korean' },
  { code: 'vi', iso3: ['vie'], en: 'Vietnamese' },
  { code: 'th', iso3: ['tha'], en: 'Thai' },
  { code: 'id', iso3: ['ind', 'zlm'], en: 'Indonesian' },
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
