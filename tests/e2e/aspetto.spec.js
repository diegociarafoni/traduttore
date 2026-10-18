import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, prepare, useFixedFont } from './helpers.js';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa'];
const violations = async (page) =>
  (await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
  );

test.describe('RNF-02 accessibilità e aspetto in tema chiaro e scuro', () => {
  test('nessuna violazione WCAG AA nella pagina iniziale', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    expect(await violations(page)).toEqual([]);
  });

  test('nessuna violazione WCAG AA con un file caricato e una nota', async ({ page }) => {
    await prepare(page, 'relazione.pdf');
    await expect(page.locator('#format-note')).not.toBeEmpty();
    expect(await violations(page)).toEqual([]);
  });

  test("l'area del file è un pulsante con nome e si apre da tastiera", async ({ page }) => {
    await page.goto('/');
    const drop = page.getByRole('button', { name: /Trascinare qui un file/ });
    await expect(drop).toHaveAccessibleDescription(/Formati: md, docx/);
    await drop.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await chooser;
  });

  test("l'area del file ha un indicatore di focus visibile", async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Accedi' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#remember')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#drop')).toBeFocused();
    const outline = await page.locator('#drop').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });

  test("il campo della parola d'ordine segnala l'errore ai lettori di schermo", async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const field = page.getByLabel("Parola d'ordine", { exact: true });
    await field.fill('sbagliata');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/Parola d'ordine errata/);
    await field.fill('altra');
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('al termine della traduzione il focus passa al collegamento Scarica', async ({ page }) => {
    await prepare(page, 'guida.md');
    await page.getByRole('button', { name: 'Traduci' }).click();
    await expect(page.getByRole('link', { name: /^Scarica / })).toBeFocused();
  });

  test('schermata di riferimento della pagina iniziale', async ({ page }) => {
    await page.goto('/');
    await useFixedFont(page);
    await expect(page).toHaveScreenshot('iniziale.png', { fullPage: true });
  });

  test('schermata di riferimento con un file caricato', async ({ page }) => {
    await prepare(page, 'guida.md');
    await expect(page.locator('#file-info')).toBeVisible();
    await useFixedFont(page);
    await expect(page).toHaveScreenshot('file-caricato.png', { fullPage: true });
  });
});
