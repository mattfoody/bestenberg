import type { Doc, Node, Style } from '@bestenberg/schema';
import {
  POST_LIST_MARKUP as POST_LIST,
  PRODUCT_GRID_MARKUP as PRODUCT_GRID,
  rawNode,
} from './dynamic';

/**
 * The base theme's templates and template parts, defined as schema documents
 * and generated into wp/theme (`pnpm generate`). Layout is made of Bestenberg
 * components, so every template can be edited in the Bestenberg editor;
 * site, post and store data come from WordPress/WooCommerce blocks.
 */

export interface ThemeFile {
  /** `templates/page.html`, `parts/header.html`. */
  path: string;
  doc: Doc;
}

/** Builds one file's nodes with stable ids (`page-0001`, …) so output is reproducible. */
function file(
  kind: 'template' | 'part',
  slug: string,
  title: string,
  build: (b: Builder) => Node[],
): ThemeFile {
  let count = 0;
  const nextId = () => `${slug}-${String(++count).padStart(4, '0')}`;
  const builder: Builder = {
    n: (type, props, style, children) => {
      const node: Node = { id: nextId(), type, props: props ?? {} };
      if (style && Object.keys(style).length > 0) {
        node.style = 'base' in style ? (style as Node['style']) : { base: style as Style };
      }
      if (children) node.children = children;
      return node;
    },
    raw: (markup) => rawNode(markup, nextId()),
  };
  return {
    path: `${kind === 'template' ? 'templates' : 'parts'}/${slug}.html`,
    doc: { schemaVersion: 1, kind, meta: { title, slug }, root: build(builder) },
  };
}

interface Builder {
  n: (
    type: string,
    props?: Record<string, unknown> | null,
    style?: Style | NonNullable<Node['style']> | null,
    children?: Node[],
  ) => Node;
  raw: (markup: string) => Node;
}

const HEADER = '<!-- wp:template-part {"slug":"header","tagName":"header"} /-->';
const FOOTER = '<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->';
const CHECKOUT_HEADER =
  '<!-- wp:template-part {"slug":"checkout-header","theme":"woocommerce/woocommerce","tagName":"header"} /-->';

const PRODUCT_META = `<!-- wp:woocommerce/product-meta -->
<div class="wp-block-woocommerce-product-meta"><!-- wp:group {"className":"bb:flex bb:flex-wrap bb:gap-4 bb:text-sm bb:text-muted","layout":{"type":"default"}} -->
<div class="wp-block-group bb:flex bb:flex-wrap bb:gap-4 bb:text-sm bb:text-muted"><!-- wp:woocommerce/product-sku /-->

<!-- wp:post-terms {"term":"product_cat","prefix":"Category: "} /-->

<!-- wp:post-terms {"term":"product_tag","prefix":"Tags: "} /--></div>
<!-- /wp:group --></div>
<!-- /wp:woocommerce/product-meta -->`;

const ORDER_ADDRESSES = `<!-- wp:columns {"className":"wc-block-order-confirmation-address-wrapper"} -->
<div class="wp-block-columns wc-block-order-confirmation-address-wrapper"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:woocommerce/order-confirmation-shipping-wrapper -->
<!-- wp:pattern {"slug":"woocommerce/order-confirmation-shipping-heading"} /-->

<!-- wp:woocommerce/order-confirmation-shipping-address {"lock":{"remove":true}} /-->
<!-- /wp:woocommerce/order-confirmation-shipping-wrapper --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:woocommerce/order-confirmation-billing-wrapper -->
<!-- wp:pattern {"slug":"woocommerce/order-confirmation-billing-heading"} /-->

<!-- wp:woocommerce/order-confirmation-billing-address {"lock":{"remove":true}} /-->
<!-- /wp:woocommerce/order-confirmation-billing-wrapper --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->`;

const wrapper = (name: string, heading: string, inner: string) =>
  `<!-- wp:woocommerce/${name}-wrapper -->
<!-- wp:pattern {"slug":"woocommerce/${heading}"} /-->

${inner}
<!-- /wp:woocommerce/${name}-wrapper -->`;

const MAIN: Style = { padding: { x: 'space.6', y: 'space.12' } };

/** `<main>` section with one container: the frame of most templates. */
const main = (b: Builder, width: string, children: Node[], style: Style = MAIN) =>
  b.n('section', { tag: 'main' }, style, [b.n('container', {}, { width } as Style, children)]);

export const THEME_FILES: readonly ThemeFile[] = [
  file('part', 'header', 'Header', (b) => [
    b.n(
      'row',
      {},
      {
        layout: { display: 'row', align: 'center', justify: 'between', gap: 'space.6', wrap: true },
        padding: { x: 'space.6', y: 'space.4' },
        background: 'color.surface-alt',
      },
      [
        b.raw('<!-- wp:site-title {"level":0,"className":"bb:font-semibold bb:text-lg"} /-->'),
        b.raw('<!-- wp:navigation {"overlayMenu":"mobile"} /-->'),
      ],
    ),
  ]),

  file('part', 'footer', 'Footer', (b) => [
    b.n(
      'section',
      { tag: 'div' },
      {
        padding: { x: 'space.6', y: 'space.8' },
        background: 'color.surface-alt',
        color: 'color.muted',
      },
      [
        b.n('container', {}, { width: 'container.lg' }, [
          b.raw(
            '<!-- wp:site-title {"level":0,"isLink":false,"className":"bb:text-sm bb:font-medium"} /-->',
          ),
          b.n(
            'text',
            { text: 'Built with Bestenberg.' },
            { font: { size: 'fontSize.sm' }, margin: { top: 'space.2' } },
          ),
        ]),
      ],
    ),
  ]),

  file('template', 'page', 'Page', (b) => [
    b.raw(HEADER),
    b.n('section', { tag: 'main' }, null, [
      b.raw('<!-- wp:post-content {"layout":{"type":"default"}} /-->'),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', 'single', 'Single post', (b) => [
    b.raw(HEADER),
    main(b, 'container.md', [
      b.raw(
        '<!-- wp:post-title {"level":1,"className":"bb:text-4xl bb:font-bold bb:leading-tight"} /-->',
      ),
      b.raw('<!-- wp:post-date {"className":"bb:text-sm bb:text-muted bb:mt-2"} /-->'),
      b.raw('<!-- wp:post-content {"className":"bb:mt-8","layout":{"type":"default"}} /-->'),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', 'index', 'Index', (b) => [
    b.raw(HEADER),
    main(b, 'container.lg', [b.raw(POST_LIST)]),
    b.raw(FOOTER),
  ]),

  file('template', 'archive', 'Archive', (b) => [
    b.raw(HEADER),
    main(b, 'container.lg', [
      b.raw(
        '<!-- wp:query-title {"type":"archive","className":"bb:text-3xl bb:font-bold bb:mb-8"} /-->',
      ),
      b.raw(POST_LIST),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', '404', 'Page not found', (b) => [
    b.raw(HEADER),
    main(
      b,
      'container.sm',
      [
        b.n(
          'heading',
          { text: 'Page not found', level: 1 },
          { font: { size: 'fontSize.4xl', weight: 'fontWeight.bold', align: 'center' } },
        ),
        b.n(
          'text',
          { text: 'The page you are looking for does not exist or has moved.' },
          { color: 'color.muted', font: { align: 'center' }, margin: { top: 'space.4' } },
        ),
        b.raw(
          '<!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search","className":"bb:mt-8"} /-->',
        ),
      ],
      { padding: { x: 'space.6', y: 'space.24' } },
    ),
    b.raw(FOOTER),
  ]),

  // ── WooCommerce (PLAN.md §7): arrange and style Woo blocks, never replace their logic. ──

  file('template', 'single-product', 'Single product', (b) => [
    b.raw(HEADER),
    main(b, 'container.lg', [
      b.raw('<!-- wp:woocommerce/breadcrumbs /-->'),
      b.raw('<!-- wp:woocommerce/store-notices /-->'),
      b.n(
        'grid',
        {},
        {
          base: {
            layout: { display: 'grid', columns: 1, gap: 'space.8' },
            margin: { top: 'space.6' },
          },
          desktop: { layout: { columns: 2, gap: 'space.12' } },
        },
        [
          b.raw('<!-- wp:woocommerce/product-image-gallery /-->'),
          b.n('stack', {}, { layout: { display: 'stack', gap: 'space.4' } }, [
            b.raw(
              '<!-- wp:post-title {"level":1,"className":"bb:text-3xl bb:font-bold bb:leading-tight","__woocommerceNamespace":"woocommerce/product-query/product-title"} /-->',
            ),
            b.raw('<!-- wp:woocommerce/product-rating /-->'),
            b.raw(
              '<!-- wp:woocommerce/product-price {"className":"bb:text-2xl bb:font-semibold"} /-->',
            ),
            b.raw(
              '<!-- wp:post-excerpt {"excerptLength":100,"className":"bb:text-muted","__woocommerceNamespace":"woocommerce/product-query/product-summary"} /-->',
            ),
            b.raw('<!-- wp:woocommerce/add-to-cart-form /-->'),
            b.raw(PRODUCT_META),
          ]),
        ],
      ),
      b.raw('<!-- wp:woocommerce/product-details {"className":"is-style-minimal bb:mt-12"} /-->'),
      b.raw('<!-- wp:pattern {"slug":"woocommerce-blocks/related-products"} /-->'),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', 'archive-product', 'Product catalog', (b) => [
    b.raw(HEADER),
    main(b, 'container.lg', [
      b.raw('<!-- wp:woocommerce/breadcrumbs /-->'),
      b.raw(
        '<!-- wp:query-title {"type":"archive","showPrefix":false,"className":"bb:text-3xl bb:font-bold bb:mt-4"} /-->',
      ),
      b.raw('<!-- wp:term-description {"className":"bb:text-muted bb:mt-2"} /-->'),
      b.raw('<!-- wp:woocommerce/store-notices /-->'),
      b.n(
        'row',
        {},
        {
          layout: {
            display: 'row',
            align: 'center',
            justify: 'between',
            gap: 'space.4',
            wrap: true,
          },
          margin: { top: 'space.6', bottom: 'space.6' },
        },
        [
          b.raw('<!-- wp:woocommerce/product-results-count /-->'),
          b.raw('<!-- wp:woocommerce/catalog-sorting /-->'),
        ],
      ),
      b.raw(PRODUCT_GRID),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', 'page-cart', 'Cart', (b) => [
    b.raw(HEADER),
    main(b, 'container.lg', [
      b.raw('<!-- wp:woocommerce/store-notices /-->'),
      b.raw('<!-- wp:post-title {"level":1,"className":"bb:text-3xl bb:font-bold bb:mb-8"} /-->'),
      b.raw('<!-- wp:post-content {"layout":{"type":"default"}} /-->'),
    ]),
    b.raw(FOOTER),
  ]),

  file('template', 'page-checkout', 'Checkout', (b) => [
    b.raw(CHECKOUT_HEADER),
    main(b, 'container.lg', [
      b.raw('<!-- wp:woocommerce/store-notices /-->'),
      b.raw('<!-- wp:post-content {"layout":{"type":"default"}} /-->'),
    ]),
  ]),

  file('template', 'order-confirmation', 'Order confirmation', (b) => [
    b.raw(HEADER),
    main(b, 'container.md', [
      b.raw(
        '<!-- wp:woocommerce/order-confirmation-status {"className":"bb:text-2xl bb:font-semibold"} /-->',
      ),
      b.raw('<!-- wp:woocommerce/order-confirmation-summary /-->'),
      b.raw(
        wrapper(
          'order-confirmation-totals',
          'order-confirmation-totals-heading',
          '<!-- wp:woocommerce/order-confirmation-totals {"lock":{"remove":true}} /-->',
        ),
      ),
      b.raw(
        wrapper(
          'order-confirmation-downloads',
          'order-confirmation-downloads-heading',
          '<!-- wp:woocommerce/order-confirmation-downloads {"lock":{"remove":true}} /-->',
        ),
      ),
      b.raw(ORDER_ADDRESSES),
      b.raw(
        wrapper(
          'order-confirmation-additional-fields',
          'order-confirmation-additional-fields-heading',
          '<!-- wp:woocommerce/order-confirmation-additional-fields /-->',
        ),
      ),
      b.raw('<!-- wp:woocommerce/order-confirmation-additional-information /-->'),
    ]),
    b.raw(FOOTER),
  ]),
];
