import { expect, test } from '@playwright/test';
import { mockApi, prepare, translateAndDownload, zipText } from './helpers.js';
import { FIXTURES } from './fixtures.js';

test.describe('RF-01 RF-02 RF-03 RF-04 caricamento e opzioni', () => {
  test('rileva la lingua, propone italiano e il formato di ingresso', async ({ page }) => {
    await prepare(page, 'guida.md');
    await expect(page.locator('#file-info')).toContainText('Inglese');
    await expect(page.locator('#target')).toHaveValue('it');
    await expect(page.locator('#out-format')).toHaveValue('md');
    await expect(page.locator('#source')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeEnabled();
  });

  test('RF-10 mostra caratteri, token e costo stimato', async ({ page }) => {
    await prepare(page, 'guida.md');
    await expect(page.locator('#file-info')).toContainText('caratteri, circa');
    await expect(page.locator('#file-info')).toContainText('USD');
  });

  test('rifiuta un formato non supportato', async ({ page }) => {
    await prepare(page, 'foglio.odt');
    await expect(page.getByRole('status')).toHaveText(
      'Formato non supportato. Usare un file .md, .docx, .txt, .epub o .pdf.',
    );
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });

  test('RF-09 senza chiave API il pulsante resta disattivo', async ({ page }) => {
    await page.goto('/');
    await page.locator('#file').setInputFiles(`${FIXTURES}/guida.md`);
    await expect(page.locator('#file-info')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });
});

test.describe('RF-05 RF-06 RF-08 traduzione e formati', () => {
  test('Markdown in Markdown con la lingua rilevata passata al modello', async ({ page }) => {
    const requests = await mockApi(page);
    await prepare(page, 'guida.md');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('guida.it.md');
    const text = data.toString('utf8');
    expect(text).toContain('# [it] User guide');
    expect(text).toContain('- [it] First item');
    expect(requests[0].system).toContain('from English into Italian');
    await expect(page.getByRole('status')).toHaveText('Traduzione completata.');
  });

  test('Word in Word mantiene il grassetto', async ({ page }) => {
    await mockApi(page);
    await prepare(page, 'guida.docx');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('guida.it.docx');
    const xml = await zipText(data, 'word/document.xml');
    expect(xml).toContain('[it] User guide');
    expect(xml).toMatch(/<w:b\/>(?:(?!<\/w:r>).)*Bold words/s);
  });

  test('EPUB in EPUB mantiene il corsivo e aggiorna la lingua', async ({ page }) => {
    await mockApi(page);
    await prepare(page, 'racconto.epub');
    const { data } = await translateAndDownload(page);
    const chapter = await zipText(data, 'OEBPS/c1.xhtml');
    expect(chapter).toContain('<em>Italic words</em>');
    expect(chapter).toContain('[it] Chapter one');
    expect(await zipText(data, 'OEBPS/content.opf')).toContain('<dc:language>it</dc:language>');
  });

  test('RF-07 PDF in Markdown con il titolo riconosciuto', async ({ page }) => {
    await mockApi(page);
    await prepare(page, 'relazione.pdf');
    await expect(page.locator('#format-note')).toContainText('Dal PDF si recupera solo il testo');
    await page.locator('#out-format').selectOption('md');
    const { name, data } = await translateAndDownload(page);
    expect(name).toBe('relazione.it.md');
    expect(data.toString('utf8')).toContain('# [it] Annual report');
  });

  test('testo semplice convertito in EPUB e in PDF', async ({ page }) => {
    await mockApi(page);
    await prepare(page, 'note.txt');
    await page.locator('#out-format').selectOption('epub');
    const epub = await translateAndDownload(page);
    expect(epub.name).toBe('note.it.epub');
    expect(await zipText(epub.data, 'OEBPS/chapter-001.xhtml')).toContain('[it] The second paragraph');
    await page.locator('#out-format').selectOption('pdf');
    const pdf = await translateAndDownload(page);
    expect(pdf.data.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('RF-02 la lingua di origine scelta a mano prevale sul rilevamento', async ({ page }) => {
    const requests = await mockApi(page);
    await prepare(page, 'guida.md');
    await page.locator('#source').selectOption('fr');
    await translateAndDownload(page);
    expect(requests[0].system).toContain('from French into Italian');
  });
});

test.describe('RF-07 RF-12 errori', () => {
  test('PDF senza testo', async ({ page }) => {
    await prepare(page, 'scansione.pdf');
    await expect(page.getByRole('status')).toContainText('Il PDF non contiene testo selezionabile');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeDisabled();
  });

  test('chiave API non valida', async ({ page }) => {
    await mockApi(page, { status: 401 });
    await prepare(page, 'guida.md');
    await page.getByRole('button', { name: 'Traduci' }).click();
    await expect(page.getByRole('status')).toHaveText('Chiave API non valida o revocata.');
    await expect(page.getByRole('button', { name: 'Traduci' })).toBeEnabled();
  });
});

test.describe('RF-09 chiave API nel browser', () => {
  test('la chiave si memorizza solo su richiesta', async ({ page }) => {
    const key = page.getByLabel('Chiave API Anthropic');
    const remember = page.getByLabel('Memorizza la chiave in questo browser');
    await prepare(page);
    await page.reload();
    await expect(key).toHaveValue('');
    await key.fill('sk-ant-prova');
    await remember.check();
    await page.reload();
    await expect(key).toHaveValue('sk-ant-prova');
    await remember.uncheck();
    await page.reload();
    await expect(key).toHaveValue('');
  });
});
