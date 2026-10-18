import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { API_URL } from '../../playwright.config.js';
import { PASSWORD, USAGE, fakeTranslations } from '../support/fake-api.js';
import { FIXTURES } from './fixtures.js';

// Intercetta il proxy di traduzione; restituisce i corpi delle richieste di traduzione ricevute.
export async function mockApi(page, { translateStatus = 200, translateError, usage = USAGE } = {}) {
  const requests = [];
  await page.route(`${API_URL}/**`, async (route) => {
    const req = route.request();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-password',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    const reply = (status, body) =>
      route.fulfill({
        status,
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.headers()['x-password'] !== PASSWORD) return reply(401, { error: 'parola_d_ordine' });
    if (req.url().endsWith('/api/utilizzo')) return reply(200, usage);
    const body = req.postDataJSON();
    requests.push(body);
    if (translateStatus !== 200) return reply(translateStatus, { error: translateError });
    return reply(200, fakeTranslations(body));
  });
  return requests;
}

export async function login(page, password = PASSWORD) {
  await page.getByLabel("Parola d'ordine", { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}

// Apre la pagina con il proxy finto, accede e carica il file; restituisce le richieste di traduzione.
export async function prepare(page, file, mock = {}) {
  const requests = await mockApi(page, mock);
  await page.goto('/');
  await login(page);
  await page.getByText('Accesso consentito.').waitFor();
  if (file) await page.locator('#file').setInputFiles(`${FIXTURES}/${file}`);
  return requests;
}

export async function translateAndDownload(page) {
  await page.getByRole('button', { name: 'Traduci' }).click();
  const link = page.getByRole('link', { name: /^Scarica / });
  await link.waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  return { name: download.suggestedFilename(), data: readFileSync(await download.path()) };
}

export async function zipText(data, path) {
  return (await JSZip.loadAsync(data)).file(path).async('string');
}

// Carattere fisso per le schermate di riferimento: non dipendono dai font installati.
export async function useFixedFont(page) {
  const font = readFileSync('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf').toString('base64');
  const bold = readFileSync('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf').toString('base64');
  await page.addStyleTag({
    content: `@font-face{font-family:Fisso;src:url(data:font/ttf;base64,${font})}
@font-face{font-family:Fisso;font-weight:600 900;src:url(data:font/ttf;base64,${bold})}
*{font-family:Fisso!important}`,
  });
  await page.evaluate(() => document.fonts.ready);
}
