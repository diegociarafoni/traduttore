import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { fakeReply, sseBody } from '../support/fake-api.js';
import { FIXTURES } from './fixtures.js';

// Intercetta l'API e risponde con una traduzione finta; restituisce le richieste ricevute.
export async function mockApi(page, { status = 200, error } = {}) {
  const requests = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    if (status !== 200) {
      await route.fulfill({
        status,
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          error: { type: error || 'authentication_error', message: 'errore di prova' },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...headers, 'content-type': 'text/event-stream' },
      body: sseBody(fakeReply(body)),
    });
  });
  return requests;
}

export async function prepare(page, file) {
  await page.goto('/');
  await page.getByLabel('Chiave API Anthropic').fill('sk-ant-prova');
  if (file) await page.locator('#file').setInputFiles(`${FIXTURES}/${file}`);
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
