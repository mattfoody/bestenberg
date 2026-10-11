import { describe, expect, it } from 'vitest';
import type { Node } from '@bestenberg/schema';
import { markupToNodes, nodesToMarkup } from './index';

/**
 * Golden markup for each core block. This is what WordPress' own save()
 * produces for these attributes; tests/e2e/adapter.spec.ts checks the same
 * markup is valid in the real block editor.
 */
const cases: Array<[string, Node, string]> = [
  [
    'heading level 2 (default level omitted)',
    { id: 'h1', type: 'heading', props: { text: 'Hello <em>you</em>', level: 2 } },
    '<!-- wp:heading {"bestenberg":{"id":"h1"}} -->\n<h2 class="wp-block-heading">Hello <em>you</em></h2>\n<!-- /wp:heading -->',
  ],
  [
    'heading level 3',
    { id: 'h3', type: 'heading', props: { text: 'Three', level: 3 } },
    '<!-- wp:heading {"level":3,"bestenberg":{"id":"h3"}} -->\n<h3 class="wp-block-heading">Three</h3>\n<!-- /wp:heading -->',
  ],
  [
    'paragraph',
    { id: 'p1', type: 'text', props: { text: 'A &amp; B' } },
    '<!-- wp:paragraph {"bestenberg":{"id":"p1"}} -->\n<p>A &amp; B</p>\n<!-- /wp:paragraph -->',
  ],
  [
    'unordered list',
    {
      id: 'l1',
      type: 'list',
      props: { ordered: false },
      children: [{ id: 'i1', type: 'list-item', props: { text: 'One' } }],
    },
    '<!-- wp:list {"bestenberg":{"id":"l1"}} -->\n<ul class="wp-block-list"><!-- wp:list-item {"bestenberg":{"id":"i1"}} -->\n<li>One</li>\n<!-- /wp:list-item --></ul>\n<!-- /wp:list -->',
  ],
  [
    'button with link, new tab and variant',
    {
      id: 'g1',
      type: 'button-group',
      props: {},
      children: [
        {
          id: 'b1',
          type: 'button',
          props: { text: 'Go', href: '/a?x=1&y=2', target: '_blank', variant: 'ghost' },
        },
      ],
    },
    '<!-- wp:buttons {"bestenberg":{"id":"g1"}} -->\n<div class="wp-block-buttons"><!-- wp:button {"className":"is-style-ghost","bestenberg":{"id":"b1"}} -->\n<div class="wp-block-button is-style-ghost"><a class="wp-block-button__link wp-element-button" href="/a?x=1&amp;y=2" target="_blank" rel="noreferrer noopener">Go</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->',
  ],
  [
    'image with media id',
    { id: 'm1', type: 'image', props: { src: '/x.png', alt: 'An "x"', mediaId: 7 } },
    '<!-- wp:image {"id":7,"bestenberg":{"id":"m1"}} -->\n<figure class="wp-block-image"><img src="/x.png" alt="An &quot;x&quot;" class="wp-image-7"/></figure>\n<!-- /wp:image -->',
  ],
  [
    'image without media id',
    { id: 'm2', type: 'image', props: { src: 'https://e.test/y.jpg', alt: '' } },
    '<!-- wp:image {"bestenberg":{"id":"m2"}} -->\n<figure class="wp-block-image"><img src="https://e.test/y.jpg" alt=""/></figure>\n<!-- /wp:image -->',
  ],
  [
    'separator',
    { id: 's1', type: 'divider', props: {} },
    '<!-- wp:separator {"bestenberg":{"id":"s1"}} -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->',
  ],
  [
    'quote with citation',
    {
      id: 'q1',
      type: 'quote',
      props: { citation: 'Ada' },
      children: [{ id: 'qp', type: 'text', props: { text: 'Hi' } }],
    },
    '<!-- wp:quote {"bestenberg":{"id":"q1"}} -->\n<blockquote class="wp-block-quote"><!-- wp:paragraph {"bestenberg":{"id":"qp"}} -->\n<p>Hi</p>\n<!-- /wp:paragraph --><cite>Ada</cite></blockquote>\n<!-- /wp:quote -->',
  ],
  [
    'own block with style metadata',
    {
      id: 'sec1',
      type: 'section',
      props: { tag: 'header' },
      style: { base: { padding: { y: 'space.8' } } },
      hidden: { base: true },
      locked: 'content',
    },
    '<!-- wp:bestenberg/section {"bbId":"sec1","props":{"tag":"header"},"style":{"base":{"padding":{"y":"space.8"}}},"locked":"content","hidden":{"base":true}} /-->',
  ],
];

describe('core block markup', () => {
  it.each(cases)('%s', (_name, node, markup) => {
    expect(nodesToMarkup([node])).toBe(markup);
    expect(markupToNodes(markup)).toEqual([node]);
  });

  it('stores style, visibility and lock on core blocks under "bestenberg"', () => {
    const markup = nodesToMarkup([
      {
        id: 'h9',
        type: 'heading',
        props: { text: 'S', level: 2 },
        style: { base: { font: { size: 'fontSize.xl' } } },
        hidden: { desktop: true },
        locked: 'all',
      },
    ]);
    expect(markup).toContain(
      '{"bestenberg":{"id":"h9","style":{"base":{"font":{"size":"fontSize.xl"}}},"locked":"all","hidden":{"desktop":true}}}',
    );
  });
});

describe('reading WordPress-authored markup', () => {
  it('reads core blocks saved without Bestenberg metadata and assigns ids', () => {
    const [heading, paragraph] = markupToNodes(
      '<!-- wp:heading {"level":4} -->\n<h4 class="wp-block-heading">Hi</h4>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Text</p>\n<!-- /wp:paragraph -->',
    );
    expect(heading).toMatchObject({ type: 'heading', props: { text: 'Hi', level: 4 } });
    expect(paragraph).toMatchObject({ type: 'text', props: { text: 'Text' } });
    expect(heading!.id).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('keeps blocks with unexpected HTML verbatim instead of misreading them', () => {
    const markup = '<!-- wp:heading -->\n<div>not a heading</div>\n<!-- /wp:heading -->';
    const [node] = markupToNodes(markup);
    expect(node).toMatchObject({ type: 'raw', props: { name: 'core/heading', markup } });
    expect(nodesToMarkup([node!])).toBe(markup);
  });

  it('sanitizes rich text read from markup', () => {
    const [node] = markupToNodes(
      '<!-- wp:paragraph -->\n<p>Hi<img src=x onerror=alert(1)><script>x</script></p>\n<!-- /wp:paragraph -->',
    );
    expect(node!.props).toEqual({ text: 'Hi' });
  });

  it('drops unsafe link URLs read from markup', () => {
    const [group] = markupToNodes(
      '<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="javascript:alert(1)">x</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->',
    );
    expect(group!.children![0]!.props).toEqual({ text: 'x' });
  });
});
