import { expect, test } from '@playwright/test';

test.describe('M0 smoke', () => {
  test('editor admin page mounts the React app without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const failed: string[] = [];
    page.on('requestfailed', (req) => failed.push(`${req.url()} ${req.failure()?.errorText}`));
    page.on('response', (res) => {
      if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/wp-admin/admin.php?page=bestenberg');

    const title = page.locator('#bestenberg-root .bestenberg-app__title');
    try {
      await expect(title).toHaveText('Bestenberg');
    } catch (error) {
      const diagnostics = await page.evaluate(() => ({
        url: location.href,
        root: document.getElementById('bestenberg-root')?.outerHTML.slice(0, 500) ?? 'missing',
        scripts: Array.from(document.scripts)
          .map((s) => s.src)
          .filter((src) => src.includes('bestenberg') || src.includes('react')),
        body: document.body.innerText.slice(0, 500),
      }));
      throw new Error(
        `${(error as Error).message}\n\nDiagnostics: ${JSON.stringify(
          { ...diagnostics, errors, failed },
          null,
          2,
        )}`,
      );
    }
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
