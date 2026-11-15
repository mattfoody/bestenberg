import { expect, test, type Page } from '@playwright/test';

/**
 * M8: client mode. People who edit content change wording, pictures and
 * links; structure only where the designer opened it; locked parts not at all.
 */

interface Wp {
  apiFetch<T>(options: Record<string, unknown>): Promise<T>;
}

interface CreatedPage {
  id: number;
  link: string;
}

const row = (id: string, locked: string | null, inner: string) =>
  `<!-- wp:bestenberg/stack ${JSON.stringify({ bbId: id, props: {}, ...(locked ? { locked } : {}) })} -->
${inner}
<!-- /wp:bestenberg/stack -->`;

const heading = (id: string, text: string) =>
  `<!-- wp:heading {"bestenberg":{"id":"${id}"}} -->
<h2 class="wp-block-heading">${text}</h2>
<!-- /wp:heading -->`;

const CONTENT = [
  row(
    'open-0001',
    'none',
    `${heading('item-0001', 'First item')}\n\n${heading('item-0002', 'Second item')}`,
  ),
  row('lock-0001', 'all', heading('legal-0001', 'Legal notice')),
  row('plain-0001', null, heading('title-0001', 'Plain title')),
].join('\n\n');

let created: CreatedPage | null = null;

async function createPage(page: Page): Promise<CreatedPage> {
  await page.goto('/wp-admin/admin.php?page=bestenberg');
  created = await page.evaluate(
    (content) =>
      (window as unknown as { wp: Wp }).wp.apiFetch<CreatedPage>({
        path: '/wp/v2/pages',
        method: 'POST',
        data: { title: 'Bestenberg client e2e', status: 'publish', content },
      }),
    CONTENT,
  );
  return created;
}

test.describe('M8 client mode', () => {
  test.afterEach(async ({ page }) => {
    if (!created) return;
    const id = created.id;
    created = null;
    await page.setExtraHTTPHeaders({});
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    await page.evaluate(
      (pageId) =>
        (window as unknown as { wp: Wp }).wp.apiFetch({
          path: `/wp/v2/pages/${pageId}?force=true`,
          method: 'DELETE',
        }),
      id,
    );
  });

  test('content can be edited, structure only where it is open, locked parts not at all', async ({
    page,
  }) => {
    const { id, link } = await createPage(page);
    await page.goto(`/wp-admin/admin.php?page=bestenberg&post=${id}`);
    const canvas = page.frameLocator('.bbe-canvas__frame');
    await expect(canvas.locator('h2[data-bb-id]')).toHaveCount(4);

    await page.getByRole('button', { name: 'Client view', exact: true }).click();
    await expect(page.locator('.bestenberg-app')).toHaveAttribute('data-mode', 'client');
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate', exact: true })).toHaveCount(0);

    // Plain content: text can be changed, nothing can be moved or styled.
    const plain = canvas.locator('h2', { hasText: 'Plain title' });
    await plain.click();
    await expect(page.locator('.bbe-toolbar button')).toHaveCount(0);
    await expect(page.locator('.bbe-inspector .bbe-group')).toHaveCount(0);
    await plain.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Changed by a client');
    await page.keyboard.press('Escape');
    await expect(canvas.locator('h2', { hasText: 'Changed by a client' })).toHaveCount(1);

    // Deleting with the keyboard does nothing there.
    await page.locator('.bbe-tree__name', { hasText: 'Changed by a client' }).click();
    await page.keyboard.press('Delete');
    await expect(canvas.locator('h2[data-bb-id]')).toHaveCount(4);

    // Open group: items can be duplicated, reordered and removed.
    await canvas.locator('h2', { hasText: 'First item' }).click();
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(canvas.locator('h2', { hasText: 'First item' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(canvas.locator('h2', { hasText: 'First item' })).toHaveCount(1);
    await canvas.locator('h2', { hasText: 'First item' }).click();
    await page.getByRole('button', { name: 'Move later', exact: true }).click();
    await expect(canvas.locator('.bb-stack').first().locator('h2').first()).toHaveText(
      'Second item',
    );

    // Locked: no text editing, no actions, and an explanation.
    const legal = canvas.locator('h2', { hasText: 'Legal notice' });
    await legal.dblclick();
    await expect(legal).not.toHaveAttribute('contenteditable', 'true');
    await expect(page.locator('.bbe-toolbar button')).toHaveCount(0);
    await expect(page.locator('.bbe-inspector')).toContainText('This part is locked');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.bbe-notice--info')).toHaveText('Saved');
    await page.goto(link);
    await expect(page.locator('.bb-stack h2')).toHaveText([
      'Second item',
      'First item',
      'Legal notice',
      'Changed by a client',
    ]);
  });

  test('a designer chooses what clients may change', async ({ page }) => {
    const { id } = await createPage(page);
    await page.goto(`/wp-admin/admin.php?page=bestenberg&post=${id}`);
    const canvas = page.frameLocator('.bbe-canvas__frame');

    await canvas.locator('h2', { hasText: 'Plain title' }).click();
    const access = page.locator('[data-control="locked"] select');
    await expect(access).toHaveValue('');
    await access.selectOption({ label: 'Change nothing here' });

    await page.getByRole('button', { name: 'Client view', exact: true }).click();
    await expect(page.locator('.bbe-inspector')).toContainText('This part is locked');
    await page.getByRole('button', { name: 'Client view', exact: true }).click();
    await expect(page.locator('[data-control="locked"] select')).not.toHaveValue('');
  });

  test('each mode is introduced once', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'X-Bestenberg-E2E': 'reset-onboarding' });
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    await page.setExtraHTTPHeaders({});

    const dialog = page.locator('.bbe-welcome-dialog');
    await expect(dialog).toContainText('Welcome to Bestenberg');
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('bestenberg/v1/onboarding')),
      dialog.getByRole('button', { name: 'Start designing' }).click(),
    ]);
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Client view', exact: true }).click();
    await expect(dialog).toContainText('Editing your site');
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('bestenberg/v1/onboarding')),
      dialog.getByRole('button', { name: 'Start editing' }).click(),
    ]);
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.bestenberg-app__title')).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });
});
