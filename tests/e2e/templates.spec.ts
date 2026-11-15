import { expect, test } from '@playwright/test';

/**
 * M7: templates and template parts are Bestenberg documents. A designer opens
 * the footer in the editor, changes it, and every page shows the change.
 */

interface Wp {
  apiFetch<T>(options: Record<string, unknown>): Promise<T>;
}

const FOOTER = 'bestenberg//footer';
const TEXT = 'Footer edited in the e2e test';

test.describe('M7 templates', () => {
  test.afterEach(async ({ page }) => {
    // Saving a theme part creates a customised copy; removing it restores the theme file.
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    await page.evaluate(
      (id) =>
        (window as unknown as { wp: Wp }).wp
          .apiFetch({ path: `/wp/v2/template-parts/${id}?force=true`, method: 'DELETE' })
          .catch(() => undefined),
      FOOTER,
    );
  });

  test('lists templates and edits the footer for the whole site', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`/wp-admin/admin.php?page=bestenberg&part=${encodeURIComponent(FOOTER)}`);
    const picker = page.getByRole('combobox', { name: 'Page', exact: true });
    await expect(picker.locator('optgroup[label="Templates"] option').first()).toBeAttached();
    await expect(picker).toHaveValue(`template-parts:${FOOTER}`);

    // The footer's components are on the canvas; WordPress blocks are previewed in place.
    const canvas = page.frameLocator('.bbe-canvas__frame');
    await expect(canvas.locator('#bb-canvas-root .bb-section[data-bb-id]')).toHaveCount(1);
    await expect(canvas.locator('.bb-raw .wp-block-site-title')).toBeVisible();

    // Add live site data: the search form.
    await canvas.locator('p[data-bb-id]').first().click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Site data', exact: true }).click();
    await page.locator('[data-dynamic="search"]').click();
    await expect(canvas.locator('.bb-raw .wp-block-search')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // Change the text and save.
    const text = canvas.locator('p[data-bb-id]').first();
    await text.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(TEXT);
    await page.keyboard.press('Escape');
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await save.click();
    await expect(page.locator('.bbe-notice--info')).toHaveText('Saved');

    // Every page now ends with the edited footer.
    await page.goto('/');
    await expect(page.locator('footer')).toContainText(TEXT);
    await expect(page.locator('footer .wp-block-search')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('opens a template chosen from the picker', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    const picker = page.getByRole('combobox', { name: 'Page', exact: true });
    await expect(picker.locator('option[value="templates:bestenberg//404"]')).toBeAttached();
    await picker.selectOption('templates:bestenberg//404');

    const canvas = page.frameLocator('.bbe-canvas__frame');
    await expect(canvas.locator('h1[data-bb-id]')).toHaveText('Page not found');
    await expect(page).toHaveURL(/template=bestenberg/);
    await expect(page.getByRole('link', { name: 'View page' })).toHaveCount(0);
  });
});
