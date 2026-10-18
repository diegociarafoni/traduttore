// Risposte finte del proxy di traduzione (worker/src/index.js), condivise da unit test ed e2e.

export const PASSWORD = 'parola-di-prova';
export const USAGE = { used: 1000, limit: 500000 };

// Traduzione finta: "[it] " davanti a ogni testo, tag invariati.
export function fakeTranslations(body, prefix = '[it] ', detected = 'EN') {
  return { translations: body.texts.map((text) => ({ text: `${prefix}${text}`, detected })) };
}
