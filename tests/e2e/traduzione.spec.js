import { expect, test } from '@playwright/test';
import { login, mockApi, prepare, translateAndDownload, zipText } from './helpers.js';
import { FIXTURES } from './fixtures.js';
import { API_URL } from '../../playwright.config.js';
import { USAGE } from '../support/fake-api.js';

test.describe('RF-01 RF-02 RF-03 RF-04 caricamento e opzioni', () => {
  test('rileva la lingua, propone italiano e il formato di ingresso', async ({ page }) => {
    await prepare(page, 'guida.md');
    await expect(page.locator('#file-info')).toContainText('Inglese');
    await expect(page.locator('#target')).toHaveValue('it');
    await expect(page.locator('#out-format')).toHaveValue('md');
    await expect(page.locator('#source')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeEnabled();
  });

  test('RF-10 mostra i caratteri da tradurre e la quota DeepL residua', async ({ page }) => {
    await prepare(page, 'guida.md');
    await expect(page.locator('#file-info')).toContainText(/\d+ caratteri/);
    await expect(page.locator('#file-info')).toContainText('499.000 caratteri questo mese');
  });

  test('RF-10 avvisa se il documento supera la quota residua', async ({ page }) => {
    await prepare(page, 'guida.md', { usage: { used: 499_990, limit: 500_000 } });
    await expect(page.locator('#status')).toHaveText(
      'Il documento supera la quota DeepL residua: la traduzione potrebbe interrompersi.',
    );
  });

  test('rifiuta un formato non supportato', async ({ page }) => {
    await prepare(page, 'foglio.odt');
    await expect(page.locator('#status')).toHaveText(
      'Formato non supportato. Usare un file .md, .docx, .txt, .epub o .pdf.',
    );
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });
});

test.describe('RF-05 RF-06 RF-08 traduzione e formati', () => {
  test('Markdown in Markdown con la lingua di origine lasciata a DeepL', async ({ page }) => {
    const requests = await prepare(page, 'guida.md');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('guida.it.md');
    const text = data.toString('utf8');
    expect(text).toContain('# [it] User guide');
    expect(text).toContain('- [it] First item');
    expect(requests[0].target).toBe('IT');
    expect(requests[0].source).toBeUndefined();
    await expect(page.locator('#status')).toHaveText('Traduzione completata.');
  });

  test('Word in Word mantiene il grassetto', async ({ page }) => {
    const requests = await prepare(page, 'guida.docx');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('guida.it.docx');
    expect(requests[0].texts.some((t) => /<t\d+>Bold words<\/t\d+>/.test(t))).toBe(true);
    const xml = await zipText(data, 'word/document.xml');
    expect(xml).toContain('[it] User guide');
    expect(xml).toMatch(/<w:b\/>(?:(?!<\/w:r>).)*Bold words/s);
  });

  test('EPUB in EPUB mantiene il corsivo e aggiorna la lingua', async ({ page }) => {
    await prepare(page, 'racconto.epub');
    const { data } = await translateAndDownload(page);
    const chapter = await zipText(data, 'OEBPS/c1.xhtml');
    expect(chapter).toContain('<em>Italic words</em>');
    expect(chapter).toContain('[it] Chapter one');
    expect(await zipText(data, 'OEBPS/content.opf')).toContain('<dc:language>it</dc:language>');
  });

  test('RF-07 PDF in Markdown con il titolo riconosciuto', async ({ page }) => {
    await prepare(page, 'relazione.pdf');
    await expect(page.locator('#format-note')).toContainText('Dal PDF si recupera solo il testo');
    await page.locator('#out-format').selectOption('md');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('relazione.it.md');
    expect(data.toString('utf8')).toContain('# [it] Annual report');
  });

  test('testo semplice convertito in EPUB e in PDF', async ({ page }) => {
    await prepare(page, 'note.txt');
    await page.locator('#out-format').selectOption('epub');
    const epub = await translateAndDownload(page);
    expect(epub.name).toBe('note.it.epub');
    expect(await zipText(epub.data, 'OEBPS/chapter-001.xhtml')).toContain('[it] The second paragraph');
    await page.locator('#out-format').selectOption('pdf');
    const pdf = await translateAndDownload(page);
    expect(pdf.data.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('RF-02 RF-03 lingue scelte a mano passate a DeepL', async ({ page }) => {
    const requests = await prepare(page, 'guida.md');
    await page.locator('#source').selectOption('fr');
    await page.locator('#target').selectOption('en');
    const { name } = await translateAndDownload(page);
    expect(name).toBe('guida.en.md');
    expect(requests[0]).toMatchObject({ source: 'FR', target: 'EN-GB' });
  });
});

test.describe('RF-07 RF-12 errori', () => {
  test('PDF senza testo', async ({ page }) => {
    await prepare(page, 'scansione.pdf');
    await expect(page.locator('#status')).toContainText('Il PDF non contiene testo selezionabile');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });

  test('quota DeepL esaurita durante la traduzione', async ({ page }) => {
    await prepare(page, 'guida.md', { translateStatus: 429, translateError: 'quota' });
    await page.getByRole('button', { name: 'Traduci' }).click();
    await expect(page.locator('#status')).toHaveText('Quota mensile DeepL esaurita.');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeEnabled();
  });
});

test.describe("RF-09 parola d'ordine", () => {
  test('senza accesso il pulsante Traduci resta disattivo', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('#file').setInputFiles(`${FIXTURES}/guida.md`);
    await expect(page.locator('#file-info')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });

  test("una parola d'ordine errata viene respinta", async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('#file').setInputFiles(`${FIXTURES}/guida.md`);
    await login(page, 'sbagliata');
    await expect(page.locator('#access')).toHaveText("Parola d'ordine errata.");
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });

  test("la parola d'ordine si memorizza solo su richiesta", async ({ page }) => {
    const field = page.getByLabel("Parola d'ordine", { exact: true });
    const remember = page.getByLabel("Memorizza la parola d'ordine in questo browser");
    await prepare(page);
    await page.reload();
    await expect(field).toHaveValue('');
    await remember.check();
    await login(page);
    await expect(page.locator('#access')).toHaveText('Accesso consentito.');
    await page.reload();
    await expect(field).not.toHaveValue('');
    await expect(page.locator('#access')).toHaveText('Accesso consentito.');
    await remember.uncheck();
    await page.reload();
    await expect(field).toHaveValue('');
  });
});

test.describe('RF-21 il pulsante Traduci spiega cosa manca', () => {
  test('indica i passi mancanti finché non sono completati', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Traduci' });
    await expect(button).toHaveAccessibleDescription('Per tradurre: accedere al servizio e caricare un documento.');
    await login(page);
    await expect(button).toHaveAccessibleDescription('Per tradurre: caricare un documento con testo.');
    await page.locator('#file').setInputFiles(`${FIXTURES}/guida.md`);
    await expect(button).toBeEnabled();
    await expect(page.locator('#translate-hint')).toBeHidden();
    await expect(page.getByRole('button', { name: /Trascinare qui un file/ })).toBeVisible();
  });

  test("senza accesso chiede solo l'accesso", async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('#file').setInputFiles(`${FIXTURES}/guida.md`);
    await expect(page.locator('#translate-hint')).toHaveText('Per tradurre: accedere al servizio.');
  });
});

test.describe('RF-11 durante la traduzione', () => {
  test('documento e opzioni non si possono cambiare finché la traduzione è in corso', async ({ page }) => {
    await prepare(page, 'guida.md');
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(`${API_URL}/api/traduci`, async (route) => {
      await held;
      await route.fallback();
    });
    await page.getByRole('button', { name: 'Traduci' }).click();
    await expect(page.locator('#drop')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#file')).toBeDisabled();
    for (const id of ['#engine', '#source', '#target', '#out-format']) await expect(page.locator(id)).toBeDisabled();
    release();
    await expect(page.getByRole('link', { name: /^Scarica / })).toBeVisible();
    await expect(page.locator('#drop')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#target')).toBeEnabled();
  });
});

test.describe('RF-20 segmenti non tradotti', () => {
  test('al termine avvisa quanti segmenti sono rimasti nella lingua originale', async ({ page }) => {
    await prepare(page, 'guida.md');
    await page.route(`${API_URL}/api/traduci`, (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ translations: [] }),
      }),
    );
    await page.getByRole('button', { name: 'Traduci' }).click();
    await expect(page.locator('#status')).toHaveText(
      /^Segmenti rimasti nella lingua originale: \d+\. Riprovare più tardi o verificarli nel file\.$/,
    );
    await expect(page.locator('#status')).toHaveClass('warn');
    await expect(page.getByRole('link', { name: /^Scarica / })).toBeVisible();
  });
});

test.describe('RF-09 preferenze memorizzate', () => {
  test('preferenze danneggiate nel browser non bloccano la pagina', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('traduttore.prefs', '{non valido'));
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('#target')).toHaveValue('it');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeVisible();
  });
});

test.describe('RF-22 motore di traduzione', () => {
  test('con un solo motore la scelta non compare', async ({ page }) => {
    const requests = await prepare(page, 'guida.md');
    await expect(page.getByLabel('Motore di traduzione')).toBeHidden();
    await translateAndDownload(page);
    expect(requests[0].engine).toBe('deepl');
  });

  test('con DeepL e Claude si sceglie il motore; la quota vale solo per DeepL', async ({ page }) => {
    const requests = await prepare(page, 'guida.md', { usage: { ...USAGE, engines: ['deepl', 'claude'] } });
    const engine = page.getByLabel('Motore di traduzione');
    await expect(engine).toHaveValue('deepl');
    await expect(page.locator('#file-info')).toContainText('caratteri questo mese');
    await engine.selectOption({ label: 'Claude (Anthropic)' });
    await expect(page.locator('#file-info')).not.toContainText('caratteri questo mese');
    await translateAndDownload(page);
    expect(requests[0].engine).toBe('claude');
  });

  test('con la sola chiave Claude si traduce con Claude senza quota', async ({ page }) => {
    const requests = await prepare(page, 'guida.md', { usage: { engines: ['claude'] } });
    await expect(page.getByLabel('Motore di traduzione')).toBeHidden();
    await expect(page.locator('#file-info')).not.toContainText('caratteri questo mese');
    await translateAndDownload(page);
    expect(requests[0].engine).toBe('claude');
  });
});
