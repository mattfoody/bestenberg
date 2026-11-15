import { chromium, type FullConfig } from '@playwright/test';

/**
 * Logs in once as the wp-env admin and saves the session for all tests. The
 * editor's one-time introductions are marked as seen so they do not cover it.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL, storageState } = config.projects[0]!.use;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto('/wp-login.php');
  await page.fill('#user_login', process.env.WP_USERNAME ?? 'admin');
  await page.fill('#user_pass', process.env.WP_PASSWORD ?? 'password');
  await Promise.all([page.waitForURL('**/wp-admin/**'), page.click('#wp-submit')]);

  await page.goto('/wp-admin/admin.php?page=bestenberg');
  await page.evaluate(async () => {
    const { apiFetch } = (
      window as unknown as { wp: { apiFetch(options: object): Promise<unknown> } }
    ).wp;
    for (const mode of ['design', 'client']) {
      await apiFetch({ path: '/bestenberg/v1/onboarding', method: 'POST', data: { mode } });
    }
  });

  await page.context().storageState({ path: storageState as string });
  await browser.close();
}
