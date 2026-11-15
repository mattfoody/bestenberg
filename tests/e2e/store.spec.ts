import { expect, test, type Page } from '@playwright/test';

/**
 * M7 (PLAN.md §7): the store runs on WooCommerce blocks inside Bestenberg
 * templates. A visitor can go from a product to a paid order.
 */

interface Wp {
  apiFetch<T>(options: Record<string, unknown>): Promise<T>;
}

interface Product {
  id: number;
  name: string;
  permalink: string;
}

const PRODUCT_NAME = 'Bestenberg e2e mug';

/** Creates a virtual product and enables cash on delivery; null when WooCommerce is not active. */
async function prepareStore(page: Page): Promise<Product | null> {
  await page.goto('/wp-admin/admin.php?page=bestenberg');
  await expect(page.locator('.bestenberg-app__title')).toHaveText('Bestenberg');
  return page.evaluate(async (name) => {
    const { apiFetch } = (window as unknown as { wp: Wp }).wp;
    try {
      await apiFetch({
        path: '/wc/v3/payment_gateways/cod',
        method: 'PUT',
        data: { enabled: true },
      });
    } catch {
      return null;
    }
    return apiFetch<Product>({
      path: '/wc/v3/products',
      method: 'POST',
      data: { name, type: 'simple', regular_price: '12.50', virtual: true, status: 'publish' },
    });
  }, PRODUCT_NAME);
}

test.describe('M7 store', () => {
  let product: Product | null = null;

  test.afterEach(async ({ page }) => {
    if (!product) return;
    const id = product.id;
    product = null;
    await page.goto('/wp-admin/admin.php?page=bestenberg');
    await page.evaluate(
      (productId) =>
        (window as unknown as { wp: Wp }).wp.apiFetch({
          path: `/wc/v3/products/${productId}?force=true`,
          method: 'DELETE',
        }),
      id,
    );
  });

  test('a visitor can buy a product: product → cart → checkout → order received', async ({
    page: adminPage,
    browser,
    baseURL,
  }) => {
    test.slow();
    product = await prepareStore(adminPage);
    test.skip(product === null, 'WooCommerce is not active');

    // Shop as a guest: no saved address, no admin bar.
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    // Product page: Bestenberg template around WooCommerce blocks.
    await page.goto(product!.permalink);
    await expect(page.locator('main.bb-section')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText(PRODUCT_NAME);
    await expect(page.locator('main .bb-grid')).toHaveClass(/bb:lg:grid-cols-2/);
    await page.locator('main button.single_add_to_cart_button').click();
    await expect(
      page.locator('.woocommerce-message, .wc-block-components-notice-banner'),
    ).toContainText(PRODUCT_NAME);

    // Cart.
    await page.goto('/cart/');
    await expect(page.locator('main.bb-section')).toHaveCount(1);
    await expect(page.locator('main .wc-block-cart, main .woocommerce-cart-form')).toContainText(
      PRODUCT_NAME,
    );

    // Checkout.
    await page.goto('/checkout/');
    await expect(page.locator('main.bb-section')).toHaveCount(1);
    await page.locator('#email').fill('buyer@example.com');
    await page.locator('#billing-country').selectOption('US');
    await page.locator('#billing-first_name').fill('Ada');
    await page.locator('#billing-last_name').fill('Buyer');
    await page.locator('#billing-address_1').fill('1 Test Street');
    await page.locator('#billing-city').fill('San Francisco');
    await page.locator('#billing-state').selectOption('CA');
    await page.locator('#billing-postcode').fill('94103');
    const cod = page.locator('#radio-control-wc-payment-method-options-cod');
    await expect(cod).toBeVisible();
    await cod.check();
    await page.getByRole('button', { name: 'Place Order' }).click();

    // Order received, in the Bestenberg order confirmation template.
    await page.waitForURL(/order-received/);
    await expect(page.locator('main.bb-section')).toHaveCount(1);
    await expect(page.locator('main .wc-block-order-confirmation-status')).toBeVisible();
    await expect(page.locator('main')).toContainText(PRODUCT_NAME);
    await context.close();
  });

  test('the product catalog uses the Bestenberg template', async ({ page }) => {
    product = await prepareStore(page);
    test.skip(product === null, 'WooCommerce is not active');

    await page.goto('/shop/');
    await expect(page.locator('main.bb-section')).toHaveCount(1);
    await expect(page.locator('main .wp-block-woocommerce-product-collection')).toContainText(
      PRODUCT_NAME,
    );
  });
});
