import { expect, test, type Page } from '@playwright/test';

/**
 * M3: the Bestenberg editor opens a page, edits it on the canvas and through
 * the inspector, saves native block markup, and the frontend shows the result.
 */

interface Wp {
  apiFetch<T>(options: Record<string, unknown>): Promise<T>;
}

interface CreatedPage {
  id: number;
  link: string;
}

const pages: CreatedPage[] = [];

async function createPage(page: Page): Promise<CreatedPage> {
  await page.goto('/wp-admin/admin.php?page=bestenberg');
  await expect(page.locator('.bestenberg-app__title')).toHaveText('Bestenberg');
  return page.evaluate(() =>
    (window as unknown as { wp: Wp }).wp.apiFetch<CreatedPage>({
      path: '/wp/v2/pages',
      method: 'POST',
      data: { title: 'Bestenberg editor e2e', status: 'publish', content: '' },
    }),
  );
}

test.describe('M3 editor', () => {
  test.afterAll(async ({ browser }) => {
    if (pages.length === 0) return;
    const page = await browser.newPage();
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    await page.evaluate(
      (ids) =>
        Promise.all(
          ids.map((id) =>
            (window as unknown as { wp: Wp }).wp.apiFetch({
              path: `/wp/v2/pages/${id}?force=true`,
              method: 'DELETE',
            }),
          ),
        ),
      pages.map((created) => created.id),
    );
    await page.close();
  });

  test('builds, styles, saves and reloads a page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const created = await createPage(page);
    await page.goto(`/wp-admin/admin.php?page=bestenberg&post=${created.id}`);

    const canvas = page.frameLocator('.bbe-canvas__frame');
    await expect(canvas.locator('#bb-canvas-root')).toBeAttached();
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeDisabled();

    // Insert a section, then a heading inside it.
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Components', exact: true }).click();
    await page.locator('[data-insert="section"]').click();
    await expect(canvas.locator('section[data-bb-id]')).toHaveCount(1);
    await page.locator('[data-insert="heading"]').click();
    const heading = canvas.locator('section[data-bb-id] h2[data-bb-id]');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveAttribute('data-bb-selected', '');

    // Edit the heading text on the canvas.
    await heading.dblclick();
    await expect(heading).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Hello from Bestenberg');
    await page.keyboard.press('Enter');
    await expect(heading).not.toHaveAttribute('contenteditable', 'true');
    await expect(heading).toHaveText('Hello from Bestenberg');
    await expect(page.locator('.bbe-tree__summary')).toHaveText('Hello from Bestenberg');

    // Style for all sizes: colour.
    const inspector = page.getByRole('complementary', { name: 'Settings' });
    await inspector
      .locator('[data-control="color"]')
      .getByRole('button', { name: 'Primary', exact: true })
      .click();
    await expect(heading).toHaveClass(/(^|\s)bb:text-primary(\s|$)/);

    // Style for tablet and up only: text size.
    await page.getByRole('button', { name: 'Tablet', exact: true }).click();
    await page.getByLabel('Style changes apply to').selectOption('up');
    await inspector.getByLabel('Size', { exact: true }).selectOption('fontSize.5xl');
    await expect(heading).toHaveClass(/(^|\s)bb:md:text-5xl(\s|$)/);
    await expect(heading).not.toHaveClass(/(^|\s)bb:text-5xl(\s|$)/);

    // Undo and redo.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(heading).not.toHaveClass(/bb:md:text-5xl/);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(heading).toHaveClass(/bb:md:text-5xl/);

    // Save.
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    await expect(save).toBeDisabled();

    // Stored as native blocks.
    const raw = await page.evaluate(
      (id) =>
        (window as unknown as { wp: Wp }).wp
          .apiFetch<{ content: { raw: string } }>({ path: `/wp/v2/pages/${id}?context=edit` })
          .then((post) => post.content.raw),
      created.id,
    );
    expect(raw).toContain('<!-- wp:bestenberg/section');
    expect(raw).toContain('<!-- wp:heading');
    expect(raw).toContain('Hello from Bestenberg');

    // The frontend renders it with the same classes.
    const front = await page.context().newPage();
    await front.goto(created.link);
    const published = front.locator('section h2', { hasText: 'Hello from Bestenberg' });
    await expect(published).toHaveClass(/bb:text-primary/);
    await expect(published).toHaveClass(/bb:md:text-5xl/);
    await expect(front.locator('[data-bb-id]')).toHaveCount(0);
    await front.close();

    // Reopening the editor reads the saved markup back.
    await page.reload();
    await expect(canvas.locator('section[data-bb-id] h2[data-bb-id]')).toHaveText(
      'Hello from Bestenberg',
    );
    await expect(save).toBeDisabled();

    expect(errors).toEqual([]);
  });

  test('inserts a library section, links text and shows where a value comes from', async ({
    page,
  }) => {
    const created = await createPage(page);
    await page.goto(`/wp-admin/admin.php?page=bestenberg&post=${created.id}`);
    const canvas = page.frameLocator('.bbe-canvas__frame');
    await expect(canvas.locator('#bb-canvas-root')).toBeAttached();

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.locator('[data-pattern="hero-centered"]').click();
    const title = canvas.locator('section[data-bb-id] h1[data-bb-id]');
    await expect(title).toHaveCount(1);
    await expect(canvas.locator('section[data-bb-id] .wp-block-button__link')).toHaveCount(2);

    // A second section goes below the first.
    await page.locator('[data-pattern="cta-banner"]').click();
    await expect(canvas.locator('section[data-bb-id]')).toHaveCount(2);
    await expect(canvas.locator('section[data-bb-id]').nth(1)).toHaveClass(/bb:bg-primary/);

    // Link the supporting line.
    const line = canvas.locator('section[data-bb-id]').first().locator('p[data-bb-id]');
    await line.dblclick();
    await expect(line).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await page.getByLabel('Link address').fill('/contact');
    await page.keyboard.press('Enter');
    await expect(line.locator('a[href="/contact"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(line).not.toHaveAttribute('contenteditable', 'true');
    await expect(line.locator('a[href="/contact"]')).toHaveCount(1);

    // The heading's size is set for desktop; the inspector says so.
    await title.click();
    const size = page.locator('[data-control="font.size"]');
    await expect(size).toContainText('from desktop');
    await expect(size.getByLabel('Size', { exact: true })).toHaveValue('fontSize.5xl');
    await page.getByRole('button', { name: 'Mobile', exact: true }).click();
    await expect(size.getByLabel('Size', { exact: true })).toHaveValue('fontSize.4xl');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');

    const front = await page.context().newPage();
    await front.goto(created.link);
    await expect(front.locator('section p a[href="/contact"]')).toHaveCount(1);
    await expect(front.locator('section')).toHaveCount(2);
    await front.close();
  });

  test('the canvas is not available without a valid nonce', async ({ page }) => {
    const created = await createPage(page);
    await page.goto(`/?bestenberg-canvas=${created.id}&_wpnonce=invalid`);
    await expect(page.locator('#bb-canvas-root')).toHaveCount(0);
  });
});
