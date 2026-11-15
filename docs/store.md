# Store (WooCommerce)

With WooCommerce active, the Bestenberg theme provides templates for the whole purchase:

| Template | Shows |
|---|---|
| Single product | Gallery, title, rating, price, add to cart, details |
| Product catalog | Product grid for the shop, categories and tags |
| Cart | Cart block |
| Checkout | Checkout block with WooCommerce's minimal header |
| Order confirmation | Status, summary, totals, addresses |

The layout around them — sections, grids, spacing, colours — is Bestenberg and can be edited
under **Templates** in the page list. Cart, checkout, prices and stock stay WooCommerce
blocks: Bestenberg arranges and styles, it never replaces store logic. Their own settings
are changed in the WordPress editor.

**Add → Site data → Store** offers product grid, mini cart and account link for use in any
page, header or footer.

The end-to-end test `tests/e2e/store.spec.ts` buys a product as a guest on every CI run.
