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

  test('il campo file si apre da tastiera', async ({ page }) => {
    await page.goto('/');
    await page.locator('#drop').focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await chooser;
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
