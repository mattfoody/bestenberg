import { readFileSync } from 'node:fs';
import type { Doc, Node } from '@bestenberg/schema';
import { describe, expect, it } from 'vitest';
import { backgroundImageStyle, decorateTag, renderNodes } from './index';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/adapter-page.json', import.meta.url), 'utf8'),
) as Doc;

describe('decorateTag', () => {
  it('adds classes to the first tag, merging with existing ones', () => {
    expect(
      decorateTag('<h2 class="wp-block-heading">x</h2>', null, ['bb:text-xl', 'wp-block-heading']),
    ).toBe('<h2 class="wp-block-heading bb:text-xl">x</h2>');
    expect(decorateTag('<p>x</p>', null, ['a'])).toBe('<p class="a">x</p>');
  });

  it('targets by class or tag name and keeps self-closing tags', () => {
    const html = '<div class="w"><a class="link" href="/x">t</a></div>';
    expect(decorateTag(html, '.link', ['z'])).toBe(
      '<div class="w"><a class="link z" href="/x">t</a></div>',
    );
    expect(
      decorateTag('<figure><img src="/a.png" alt=""/></figure>', 'img', ['r'], ' data-x="1"'),
    ).toBe('<figure><img src="/a.png" alt="" class="r" data-x="1"/></figure>');
  });

  it('leaves html alone when nothing matches or nothing is added', () => {
    expect(decorateTag('<p>x</p>', 'cite', ['a'])).toBe('<p>x</p>');
    expect(decorateTag('<p>x</p>', null, [])).toBe('<p>x</p>');
  });
});

describe('renderNodes', () => {
  it('renders Bestenberg blocks like the PHP renderer', () => {
    const node: Node = {
      id: 'sec00001',
      type: 'section',
      props: { tag: 'header', anchor: 'top' },
      style: { base: { padding: { y: 'space.8' } }, desktop: { padding: { y: 'space.16' } } },
      hidden: { base: true },
      children: [{ id: 'spc00001', type: 'spacer', style: { base: { height: 'space.4' } } }],
    };
    expect(renderNodes([node])).toBe(
      '<header class="bb-section bb:py-8 bb:lg:py-16 bb:max-md:hidden" id="top">' +
        '<div class="bb-spacer bb:h-4" aria-hidden="true"></div></header>',
    );
  });

  it('ignores tags and anchors that are not allowed', () => {
    const html = renderNodes([
      { id: 'sec00001', type: 'section', props: { tag: 'script', anchor: 'a" onclick="x' } },
    ]);
    expect(html).toBe('<section class="bb-section"></section>');
  });

  it('puts core block classes on the right element', () => {
    const html = renderNodes([
      {
        id: 'grp00001',
        type: 'button-group',
        props: {},
        children: [
          {
            id: 'btn00001',
            type: 'button',
            props: { text: 'Go', href: '/go' },
            style: { base: { background: 'color.accent' } },
          },
        ],
      },
      {
        id: 'img00001',
        type: 'image',
        props: { src: '/a.png', alt: 'A' },
        style: { base: { radius: 'radius.md' } },
      },
    ]);
    expect(html).toBe(
      '<div class="wp-block-buttons"><div class="wp-block-button">' +
        '<a class="wp-block-button__link wp-element-button bb:bg-accent" href="/go">Go</a></div></div>' +
        '<figure class="wp-block-image"><img src="/a.png" alt="A" class="bb:rounded-md"/></figure>',
    );
  });

  it('adds editor hooks: ids, editable text targets, empty and raw placeholders', () => {
    const html = renderNodes(
      [
        {
          id: 'sec00001',
          type: 'section',
          children: [
            { id: 'hed00001', type: 'heading', props: { text: 'Hi <em>you</em>', level: 2 } },
            {
              id: 'lst00001',
              type: 'list',
              props: { ordered: false },
              children: [{ id: 'itm00001', type: 'list-item', props: { text: 'One' } }],
            },
            {
              id: 'quo00001',
              type: 'quote',
              props: { citation: 'Ada' },
              children: [{ id: 'txt00001', type: 'text', props: { text: 'Q' } }],
            },
            { id: 'stk00001', type: 'stack' },
            {
              id: 'raw00001',
              type: 'raw',
              props: { name: 'core/cover', markup: '<!-- wp:cover /-->' },
            },
          ],
        },
      ],
      { editor: true },
    );
    expect(html).toBe(
      '<section class="bb-section" data-bb-id="sec00001">' +
        '<h2 class="wp-block-heading" data-bb-id="hed00001" data-bb-text="text">Hi <em>you</em></h2>' +
        '<ul class="wp-block-list" data-bb-id="lst00001"><li data-bb-id="itm00001"><span data-bb-text="text">One</span></li></ul>' +
        '<blockquote class="wp-block-quote" data-bb-id="quo00001"><p data-bb-id="txt00001" data-bb-text="text">Q</p>' +
        '<cite data-bb-text="citation">Ada</cite></blockquote>' +
        '<div class="bb-stack bb:flex bb:flex-col bb-empty" data-bb-id="stk00001"></div>' +
        '<div class="bb-raw" data-bb-id="raw00001" data-bb-raw="core/cover"></div>' +
        '</section>',
    );
  });

  it('outputs raw markup verbatim outside the editor', () => {
    expect(
      renderNodes([
        { id: 'raw00001', type: 'raw', props: { name: 'x/y', markup: '<!-- wp:x/y /-->' } },
      ]),
    ).toBe('<!-- wp:x/y /-->');
  });

  it('renders the whole adapter fixture with one hook per node in editor mode', () => {
    const html = renderNodes(fixture.root, { editor: true });
    const count = (nodes: Node[]): number =>
      nodes.reduce((sum, node) => sum + 1 + count(node.children ?? []), 0);
    expect(html.match(/ data-bb-id="/g)!.length).toBe(count(fixture.root));
    expect(html).toContain(
      '<section class="bb-section bb:px-6 bb:py-16 bb:bg-primary bb:text-on-primary bb:lg:py-24" id="adapter-hero"',
    );
    expect(renderNodes(fixture.root)).not.toContain('data-bb-');
  });
});

describe('backgroundImageStyle', () => {
  it('uses the first breakpoint with an image and encodes unsafe characters', () => {
    expect(
      backgroundImageStyle({
        style: { base: {}, tablet: { background: { image: { url: "/a b'(1).jpg" } } } },
      }),
    ).toBe("background-image:url('/a%20b%27%281%29.jpg')");
    expect(
      backgroundImageStyle({ style: { base: { background: 'color.primary' } } }),
    ).toBeUndefined();
  });

  it('refuses unsafe URLs', () => {
    expect(
      backgroundImageStyle({
        style: { base: { background: { image: { url: 'javascript:alert(1)' } } } },
      }),
    ).toBeUndefined();
  });

  it('is rendered as an inline style on Bestenberg blocks', () => {
    expect(
      renderNodes([
        {
          id: 'sec00001',
          type: 'section',
          style: {
            base: { background: { image: { url: '/hero.jpg' }, overlay: 'color.on-surface' } },
          },
        },
      ]),
    ).toBe(
      '<section class="bb-section bb:bg-cover bb:overlay-on-surface" style="background-image:url(\'/hero.jpg\')"></section>',
    );
  });
});
