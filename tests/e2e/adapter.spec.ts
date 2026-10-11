import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * M2 (TASKS.md 2.7): markup produced by the TypeScript adapter
 * (wp/plugin/tests/fixtures/adapter-page.html, generated from
 * packages/adapter-blocks/fixtures/adapter-page.json) must be valid in the real
 * block editor and render correctly on the frontend.
 */

const MARKUP = readFileSync(
  resolve(__dirname, '../../wp/plugin/tests/fixtures/adapter-page.html'),
  'utf8',
);
const SLUG = 'bestenberg-adapter-e2e';

interface EditorBlock {
  name: string;
  isValid: boolean;
  validationIssues?: Array<{ args?: unknown[] } | string>;
  attributes: Record<string, unknown>;
  innerBlocks: EditorBlock[];
}

interface Wp {
  blocks?: {
    parse(markup: string): EditorBlock[];
    getBlockType(name: string): unknown;
  };
  apiFetch?: <T>(options: Record<string, unknown>) => Promise<T>;
}

let link = '';

async function openEditor(page: Page) {
  await page.goto('/wp-admin/post-new.php?post_type=page');
  await page.waitForFunction(
    () => {
      const wp = (window as unknown as { wp?: Wp }).wp;
      return Boolean(
        wp?.apiFetch &&
        wp.blocks?.getBlockType('bestenberg/section') &&
        wp.blocks.getBlockType('core/heading'),
      );
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe.serial('M2: adapter markup in WordPress', () => {
  test('every block is valid in the block editor', async ({ page }) => {
    await openEditor(page);

    const result = await page.evaluate((markup) => {
      const wp = (window as unknown as { wp: Required<Wp> }).wp;
      const problems: Array<{ name: string; issues: string[] }> = [];
      const names = new Set<string>();
      let headingMeta: unknown = null;

      const walk = (blocks: EditorBlock[]) => {
        for (const block of blocks) {
          names.add(block.name);
          if (!block.isValid || block.name === 'core/missing') {
            problems.push({
              name: block.name,
              issues: (block.validationIssues ?? []).map((issue) =>
                typeof issue === 'string' ? issue : JSON.stringify(issue.args ?? issue),
              ),
            });
          }
          if (block.name === 'core/heading' && headingMeta === null) {
            headingMeta = block.attributes.bestenberg ?? 'missing';
          }
          walk(block.innerBlocks);
        }
      };
      walk(wp.blocks.parse(markup));

      return { problems, names: [...names].sort(), headingMeta };
    }, MARKUP);

    expect(result.problems).toEqual([]);
    expect(result.names).toEqual(
      expect.arrayContaining([
        'bestenberg/section',
        'bestenberg/grid',
        'bestenberg/card',
        'bestenberg/spacer',
        'core/heading',
        'core/list-item',
        'core/button',
        'core/image',
        'core/quote',
        'core/group',
      ]),
    );
    // The editor keeps Bestenberg metadata on core blocks (attribute registered by our script).
    expect(result.headingMeta).toMatchObject({ id: 'adHead001' });
  });

  test('page is created through the REST API', async ({ page }) => {
    await openEditor(page);

    link = await page.evaluate(
      async ({ markup, slug }) => {
        const wp = (window as unknown as { wp: Required<Wp> }).wp;
        const existing = await wp.apiFetch<Array<{ id: number }>>({
          path: `/wp/v2/pages?slug=${slug}&status=publish,draft&context=edit`,
        });
        for (const page of existing) {
          await wp.apiFetch({ path: `/wp/v2/pages/${page.id}?force=true`, method: 'DELETE' });
        }
        const created = await wp.apiFetch<{ link: string }>({
          path: '/wp/v2/pages',
          method: 'POST',
          data: { title: 'Adapter e2e', slug, content: markup, status: 'publish' },
        });
        return created.link;
      },
      { markup: MARKUP, slug: SLUG },
    );

    expect(link).toContain(SLUG);
  });

  test('frontend renders Bestenberg and core blocks with token styles', async ({ page }) => {
    test.skip(link === '', 'page was not created');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(link);

    const hero = page.locator('section#adapter-hero');
    await expect(hero).toHaveClass(/\bbb-section\b/);
    await expect(hero).toHaveCSS('padding-top', '96px'); // lg: space.24
    await expect(hero).toHaveCSS('background-color', 'rgb(29, 78, 216)'); // color.primary

    const h1 = page.locator('h1.wp-block-heading');
    await expect(h1).toHaveText('Adapter round trip');
    await expect(h1).toHaveCSS('font-weight', '700');
    await expect(h1).toHaveCSS('text-align', 'center');

    const grid = page.locator('#adapter-features .bb-grid');
    await expect(grid).toHaveCSS('display', 'grid');
    expect(
      await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    ).toBe(3);
    await expect(page.locator('article.bb-card')).toHaveCount(3);

    const button = page.locator('a.wp-block-button__link');
    await expect(button).toHaveAttribute('href', '/start');
    await expect(button).toHaveCSS('background-color', 'rgb(245, 158, 11)'); // color.accent

    await expect(page.locator('ol.wp-block-list > li')).toHaveCount(3);
    await expect(page.locator('ol.wp-block-list ul.wp-block-list > li')).toHaveText('Nested item');
    await expect(page.locator('blockquote.wp-block-quote cite')).toHaveText('Ada Lovelace');
    await expect(page.locator('hr.wp-block-separator')).toHaveCount(1);
    await expect(page.locator('figure.wp-block-image img')).toHaveAttribute(
      'src',
      /w-logo-blue\.png$/,
    );
    await expect(page.locator('.bb-spacer')).toHaveCSS('height', '32px'); // space.8
    await expect(page.getByText('Inside a group Bestenberg does not edit.')).toBeVisible();

    const mobileOnly = page.getByText('Hidden on desktop');
    await expect(mobileOnly).toBeHidden();
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(mobileOnly).toBeVisible();

    const css = await page.evaluate(
      () => document.querySelector('style#bestenberg-utilities-inline-css')?.textContent ?? '',
    );
    for (const used of [
      '.bb\\:lg\\:grid-cols-3{',
      '.bb\\:bg-accent{',
      '.bb\\:h-8{',
      '.bb\\:lg\\:hidden{',
    ]) {
      expect(css, used).toContain(used);
    }
    expect(errors).toEqual([]);
  });
});
