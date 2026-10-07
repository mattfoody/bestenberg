import { expect, test } from '@playwright/test';

test.describe('M0 smoke', () => {
  test('editor admin page mounts the React app without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/wp-admin/admin.php?page=bestenberg');

    await expect(page.locator('#bestenberg-root .bestenberg-app__title')).toHaveText('Bestenberg');
    await expect(page.locator('#adminmenumain')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('frontend renders with the Bestenberg theme', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // WordPress adds `wp-theme-{slug}` to <body> for the active theme.
    await expect(page.locator('body')).toHaveClass(/\bwp-theme-bestenberg\b/);
  });
});
