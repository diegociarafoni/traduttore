// Catalogo diviso per funzione: un file JSON per area in src/i18n/<lingua>/, fusi all'avvio.
const parts = import.meta.glob('./it/*.json', { eager: true, import: 'default' });
const it = Object.assign({}, ...Object.values(parts));

const catalogs = { it };
let current = 'it';

export function setLocale(locale) {
  if (catalogs[locale]) current = locale;
}

export function t(key, params = {}) {
  const text = catalogs[current][key] ?? catalogs.it[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
}

// Applica i testi agli elementi con data-i18n (contenuto) e data-i18n-<attributo>.
export function translateDom(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith('data-i18n-')) el.setAttribute(attr.slice('data-i18n-'.length), t(el.getAttribute(attr)));
    }
  }
  if (root.title !== undefined && root.documentElement) root.title = t('app.title');
}
