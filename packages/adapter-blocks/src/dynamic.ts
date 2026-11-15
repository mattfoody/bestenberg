import { createId, RAW_TYPE, type Node } from '@bestenberg/schema';

/**
 * WordPress and WooCommerce blocks that show site data (title, menu, the
 * current post, products, cart). Bestenberg does not re-implement them: it
 * places them as `raw` nodes, WordPress renders them (PLAN.md §7).
 */

export const DYNAMIC_GROUPS = ['site', 'post', 'store'] as const;
export type DynamicGroup = (typeof DYNAMIC_GROUPS)[number];

export const DYNAMIC_GROUP_LABELS: Record<DynamicGroup, string> = {
  site: 'Site',
  post: 'Current page or post',
  store: 'Store',
};

export interface DynamicBlock {
  id: string;
  label: string;
  group: DynamicGroup;
  description: string;
  /** Block markup inserted as-is. */
  markup: string;
  /** Only offered when this plugin is active. */
  requires?: 'woocommerce';
}

export const POST_LIST_MARKUP = `<!-- wp:query {"queryId":0,"query":{"inherit":true}} -->
<div class="wp-block-query"><!-- wp:post-template {"className":"bb:grid bb:grid-cols-1 bb:md:grid-cols-2 bb:lg:grid-cols-3 bb:gap-6"} -->
<!-- wp:group {"className":"bb:px-6 bb:py-6 bb:rounded-lg bb:border-1 bb:border-border"} -->
<div class="wp-block-group bb:px-6 bb:py-6 bb:rounded-lg bb:border-1 bb:border-border"><!-- wp:post-title {"isLink":true,"className":"bb:text-xl bb:font-semibold"} /-->

<!-- wp:post-excerpt {"className":"bb:text-muted bb:mt-2"} /--></div>
<!-- /wp:group -->
<!-- /wp:post-template -->

<!-- wp:query-pagination {"className":"bb:mt-8"} -->
<!-- wp:query-pagination-previous /-->

<!-- wp:query-pagination-numbers /-->

<!-- wp:query-pagination-next /-->
<!-- /wp:query-pagination --></div>
<!-- /wp:query -->`;

export const PRODUCT_GRID_MARKUP = `<!-- wp:woocommerce/product-collection {"queryId":0,"query":{"woocommerceAttributes":[],"woocommerceStockStatus":["instock","outofstock","onbackorder"],"taxQuery":{},"isProductCollectionBlock":true,"perPage":12,"pages":0,"offset":0,"postType":"product","order":"asc","orderBy":"title","author":"","search":"","exclude":[],"sticky":"","inherit":true},"tagName":"div","dimensions":{"widthType":"fill","fixedWidth":""},"displayLayout":{"type":"flex","columns":3,"shrinkColumns":true},"convertedFromProducts":false,"queryContextIncludes":["collection"]} -->
<div class="wp-block-woocommerce-product-collection"><!-- wp:woocommerce/product-template -->
<!-- wp:woocommerce/product-image {"showSaleBadge":false,"imageSizing":"thumbnail"} -->
<!-- wp:woocommerce/product-sale-badge {"align":"right"} /-->
<!-- /wp:woocommerce/product-image -->

<!-- wp:post-title {"level":2,"isLink":true,"className":"bb:text-lg bb:font-semibold bb:mt-4","__woocommerceNamespace":"woocommerce/product-collection/product-title"} /-->

<!-- wp:woocommerce/product-price {"className":"bb:text-muted bb:mt-1"} /-->

<!-- wp:woocommerce/product-button {"className":"bb:mt-3"} /-->
<!-- /wp:woocommerce/product-template -->

<!-- wp:query-pagination {"className":"bb:mt-8"} -->
<!-- wp:query-pagination-previous /-->

<!-- wp:query-pagination-numbers /-->

<!-- wp:query-pagination-next /-->
<!-- /wp:query-pagination -->

<!-- wp:woocommerce/product-collection-no-results -->
<!-- wp:paragraph {"className":"bb:text-muted"} -->
<p class="bb:text-muted">No products were found.</p>
<!-- /wp:paragraph -->
<!-- /wp:woocommerce/product-collection-no-results --></div>
<!-- /wp:woocommerce/product-collection -->`;

export const DYNAMIC_BLOCKS: readonly DynamicBlock[] = [
  {
    id: 'site-title',
    label: 'Site title',
    group: 'site',
    description: 'The name of the site, linked to the home page.',
    markup: '<!-- wp:site-title {"level":0,"className":"bb:font-semibold bb:text-lg"} /-->',
  },
  {
    id: 'site-logo',
    label: 'Site logo',
    group: 'site',
    description: 'The logo set in the site settings.',
    markup: '<!-- wp:site-logo {"width":120} /-->',
  },
  {
    id: 'navigation',
    label: 'Menu',
    group: 'site',
    description: 'The site menu; collapses to a button on phones.',
    markup: '<!-- wp:navigation {"overlayMenu":"mobile"} /-->',
  },
  {
    id: 'search',
    label: 'Search',
    group: 'site',
    description: 'A search field for the site.',
    markup: '<!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search"} /-->',
  },
  {
    id: 'post-title',
    label: 'Title',
    group: 'post',
    description: 'The title of the page or post being shown.',
    markup:
      '<!-- wp:post-title {"level":1,"className":"bb:text-4xl bb:font-bold bb:leading-tight"} /-->',
  },
  {
    id: 'post-content',
    label: 'Content',
    group: 'post',
    description: 'The content of the page or post being shown.',
    markup: '<!-- wp:post-content {"layout":{"type":"default"}} /-->',
  },
  {
    id: 'post-featured-image',
    label: 'Featured image',
    group: 'post',
    description: 'The image set for the page or post.',
    markup: '<!-- wp:post-featured-image {"className":"bb:rounded-lg"} /-->',
  },
  {
    id: 'post-date',
    label: 'Date',
    group: 'post',
    description: 'When the post was published.',
    markup: '<!-- wp:post-date {"className":"bb:text-sm bb:text-muted"} /-->',
  },
  {
    id: 'archive-title',
    label: 'Archive title',
    group: 'post',
    description: 'The name of the category, tag or date being listed.',
    markup: '<!-- wp:query-title {"type":"archive","className":"bb:text-3xl bb:font-bold"} /-->',
  },
  {
    id: 'post-list',
    label: 'Post list',
    group: 'post',
    description: 'A grid of the posts for the page being shown, with paging.',
    markup: POST_LIST_MARKUP,
  },
  {
    id: 'mini-cart',
    label: 'Mini cart',
    group: 'store',
    description: 'Cart button with item count; opens the cart drawer.',
    markup: '<!-- wp:woocommerce/mini-cart /-->',
    requires: 'woocommerce',
  },
  {
    id: 'customer-account',
    label: 'Account link',
    group: 'store',
    description: 'Link to the customer account or login.',
    markup: '<!-- wp:woocommerce/customer-account {"displayStyle":"icon_only"} /-->',
    requires: 'woocommerce',
  },
  {
    id: 'product-grid',
    label: 'Product grid',
    group: 'store',
    description: 'Products with image, name, price and add-to-cart button.',
    markup: PRODUCT_GRID_MARKUP,
    requires: 'woocommerce',
  },
  {
    id: 'store-notices',
    label: 'Store notices',
    group: 'store',
    description: 'Messages such as "added to cart" and checkout errors.',
    markup: '<!-- wp:woocommerce/store-notices /-->',
    requires: 'woocommerce',
  },
  {
    id: 'breadcrumbs',
    label: 'Breadcrumbs',
    group: 'store',
    description: 'The path from the shop to the current product or category.',
    markup: '<!-- wp:woocommerce/breadcrumbs /-->',
    requires: 'woocommerce',
  },
];

export function getDynamicBlock(id: string): DynamicBlock | undefined {
  return DYNAMIC_BLOCKS.find((block) => block.id === id);
}

/** Name of the first block in a piece of markup: `core/site-title`, `woocommerce/mini-cart`. */
export function markupBlockName(markup: string): string {
  const name = /<!--\s+wp:([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?)[\s/]/.exec(markup)?.[1];
  if (!name) return 'core/freeform';
  return name.includes('/') ? name : `core/${name}`;
}

/** A raw node holding block markup verbatim. `id` is for generated files that need stable ids. */
export function rawNode(markup: string, id: string = createId()): Node {
  return { id, type: RAW_TYPE, props: { name: markupBlockName(markup), markup } };
}
