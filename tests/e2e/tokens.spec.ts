import { expect, test } from '@playwright/test';

const DEMO = '/bestenberg-demo/';

test.describe('M1: token styles on the demo page', () => {
  test('applies token utilities mobile-first', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(DEMO);

    const hero = page.locator('.demo-hero');
    const features = page.locator('.demo-features');

    await expect(hero).toHaveCSS('background-color', 'rgb(29, 78, 216)'); // color.primary
    await expect(hero).toHaveCSS('color', 'rgb(255, 255, 255)'); // color.on-primary
    await expect(hero).toHaveCSS('padding-top', '64px'); // space.16
    await expect(features).toHaveCSS('display', 'grid');
    expect(await columnCount(features)).toBe(1);

    await page.setViewportSize({ width: 800, height: 800 });
    expect(await columnCount(features)).toBe(2);
    await expect(hero).toHaveCSS('padding-top', '80px'); // md: space.20

    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await columnCount(features)).toBe(3);
    await expect(hero).toHaveCSS('padding-top', '96px'); // lg: space.24
    await expect(features).toHaveCSS('gap', '24px'); // space.6
  });

  test('ships token variables and only the utility rules the page uses', async ({ page }) => {
    await page.goto(DEMO);

    await expect(page.locator('link#bestenberg-tokens-css')).toHaveCount(1);

    const inHead = await page.evaluate(() => {
      const style = document.querySelector('head style#bestenberg-utilities-inline-css');
      return style?.textContent ?? null;
    });
    expect(inHead, 'utilities are printed in <head>').not.toBeNull();
    const css = inHead!;

    for (const used of ['.bb\\:bg-primary{', '.bb\\:lg\\:grid-cols-3{', '.bb\\:shadow-md{']) {
      expect(css, used).toContain(used);
    }
    for (const unused of ['.bb\\:py-24{', '.bb\\:shadow-xl{', '.bb\\:bg-danger{', '.bb\\:lg\\:grid-cols-12{']) {
      expect(css, unused).not.toContain(unused);
    }
    // 552 utilities exist; a page should carry a small fraction of them.
    expect(css.split('{').length).toBeLessThan(80);
  });
});

async function columnCount(locator: import('@playwright/test').Locator): Promise<number> {
  return locator.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  );
}
