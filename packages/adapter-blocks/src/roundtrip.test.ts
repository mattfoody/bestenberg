import {
  BREAKPOINTS,
  defaultRegistry,
  sampleStyles,
  sanitizeRichText,
  validateDoc,
  type Doc,
  type Node,
  type Style,
} from '@bestenberg/schema';
import { describe, expect, it } from 'vitest';
import {
  blocksToNodes,
  docToBlocks,
  docToMarkup,
  markupToBlocks,
  markupToNodes,
  nodesToMarkup,
  rawNodeId,
} from './index';

/**
 * Property-style round-trip tests with a seeded generator (no extra
 * dependency): every generated document is valid, and
 * node → block → markup → block → node returns it unchanged.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Gen {
  private next: () => number;
  private ids = 0;
  private raws = 0;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }
  id(): string {
    return `n${(this.ids++).toString(36).padStart(5, '0')}`;
  }
  rawSerial(): number {
    return this.raws++;
  }
}

const STYLES = sampleStyles();
const RICH_PIECES = [
  'Hello',
  'world',
  'Tom &amp; Jerry',
  '"quoted"',
  '1 &lt; 2',
  '&nbsp;',
  '<strong>bold</strong>',
  '<em>it</em>',
  '<strong><em>both</em></strong>',
  '<a href="/page">link</a>',
  '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener">ext</a>',
  '<br>',
  '<span class="bb-highlight">mark</span>',
  'ünïcödé ✓',
];
const URLS = ['/start', 'https://example.com/a?b=1&c=2', '#top', 'mailto:hi@example.com'];
const IMAGES = ['/wp-content/uploads/a.jpg', 'https://cdn.example.com/b.png'];

function richText(g: Gen, nonEmpty = false, links = true): string {
  const pieces = links ? RICH_PIECES : RICH_PIECES.filter((piece) => !piece.includes('<a '));
  const count = g.int(nonEmpty ? 1 : 0, 4);
  const text = Array.from({ length: count }, () => g.pick(pieces)).join(' ');
  return nonEmpty && text === '' ? 'x' : text;
}

function style(g: Gen, allowed: readonly string[]): Node['style'] {
  const usable = STYLES.filter((s) => Object.keys(s).every((key) => allowed.includes(key)));
  if (usable.length === 0 || g.bool(0.4)) return undefined;
  const one = (): Style =>
    Object.assign({}, ...Array.from({ length: g.int(1, 3) }, () => g.pick(usable)));
  const out: NonNullable<Node['style']> = { base: g.bool(0.2) ? {} : one() };
  if (g.bool(0.3)) out.tablet = one();
  if (g.bool(0.3)) out.desktop = one();
  return out;
}

function props(g: Gen, type: string): Record<string, unknown> | undefined {
  switch (type) {
    case 'section':
      return g.pick([
        undefined,
        {},
        { tag: g.pick(['section', 'header', 'div']) },
        { anchor: `a${g.int(1, 99)}` },
      ]);
    case 'card':
      return g.pick([undefined, {}, { tag: g.pick(['div', 'article']) }]);
    case 'container':
    case 'stack':
    case 'row':
    case 'grid':
      return g.pick([undefined, {}]);
    case 'spacer':
      return undefined;
    case 'heading':
      return { text: richText(g), level: g.int(1, 6) };
    case 'text':
    case 'list-item':
      return { text: richText(g) };
    case 'list':
      return { ordered: g.bool() };
    case 'button':
      return {
        text: richText(g, true, false),
        ...(g.bool(0.7) ? { href: g.pick(URLS) } : {}),
        ...(g.bool(0.3) ? { target: g.pick(['_blank', '_self']) } : {}),
        ...(g.bool(0.5) ? { variant: g.pick(['primary', 'secondary', 'ghost']) } : {}),
      };
    case 'image':
      return {
        src: g.pick(IMAGES),
        alt: g.pick(['', 'Alt', 'A "quoted" <alt> & more']),
        ...(g.bool() ? { mediaId: g.int(1, 999) } : {}),
      };
    case 'quote':
      return g.bool() ? { citation: richText(g, true) } : {};
    default:
      return {};
  }
}

const LEAF_OR_CONTAINER = [
  'section',
  'container',
  'stack',
  'row',
  'grid',
  'card',
  'spacer',
  'heading',
  'text',
  'list',
  'button-group',
  'image',
  'divider',
  'quote',
];
const RAW_MARKUPS = [
  (n: number) =>
    `<!-- wp:cover {"n":${n}} -->\n<div class="wp-block-cover">Cover ${n}</div>\n<!-- /wp:cover -->`,
  (n: number) =>
    `<!-- wp:spacer {"height":"${n}px"} -->\n<div style="height:${n}px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->`,
  (n: number) => `<!-- wp:acme/widget {"n":${n}} /-->`,
];

function rawNode(g: Gen): Node {
  const markup = g.pick(RAW_MARKUPS)(g.rawSerial());
  const name = markupToBlocks(markup)[0]!.name;
  return { id: rawNodeId(markup), type: 'raw', props: { name, markup } };
}

function node(g: Gen, type: string, depth: number): Node {
  const def = defaultRegistry.get(type)!;
  const out: Node = { id: g.id(), type };
  const p = props(g, type);
  if (p !== undefined) out.props = p;
  const s = style(g, def.styles);
  if (s) out.style = s;
  if (g.bool(0.15))
    out.hidden = Object.fromEntries(BREAKPOINTS.filter(() => g.bool()).map((bp) => [bp, true]));
  if (g.bool(0.1)) out.locked = g.pick(['none', 'content', 'all']);
  if (def.block.startsWith('bestenberg/') && g.bool(0.1)) {
    out.bind = { source: 'query', postType: 'post', perPage: g.int(1, 12) };
  }

  const children: Node[] = [];
  if (def.allowedChildren === 'any' && depth < 3) {
    for (let i = g.int(0, 3); i > 0; i--) {
      children.push(g.bool(0.08) ? rawNode(g) : node(g, g.pick(LEAF_OR_CONTAINER), depth + 1));
    }
  } else if (Array.isArray(def.allowedChildren)) {
    const min = type === 'list-item' ? 0 : 1;
    const max = type === 'list-item' ? (depth < 4 ? 1 : 0) : 3;
    for (let i = g.int(min, max); i > 0; i--) {
      children.push(
        type === 'quote' && g.bool(0.1)
          ? rawNode(g)
          : node(g, g.pick(def.allowedChildren), depth + 1),
      );
    }
  }
  if (children.length > 0) out.children = children;
  return out;
}

function doc(seed: number): Doc {
  const g = new Gen(seed);
  const root: Node[] = [];
  for (let i = g.int(1, 4); i > 0; i--) root.push(node(g, g.pick(LEAF_OR_CONTAINER), 0));
  if (g.bool(0.2)) root.push(rawNode(g));
  return { schemaVersion: 1, kind: 'page', meta: { title: `Doc ${seed}` }, root };
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

describe('round trip (300 generated documents)', () => {
  it('generates valid, canonical documents', () => {
    for (const seed of SEEDS) {
      const d = doc(seed);
      const result = validateDoc(d, { registry: defaultRegistry });
      expect(result.ok, `seed ${seed}: ${JSON.stringify(result.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it('node → block → node is lossless', () => {
    for (const seed of SEEDS) {
      const d = doc(seed);
      expect(blocksToNodes(docToBlocks(d)), `seed ${seed}`).toEqual(d.root);
    }
  });

  it('node → markup → node is lossless', () => {
    for (const seed of SEEDS) {
      const d = doc(seed);
      expect(markupToNodes(docToMarkup(d)), `seed ${seed}`).toEqual(d.root);
    }
  });

  it('markup is stable: serialize(parse(markup)) === markup', () => {
    for (const seed of SEEDS) {
      const markup = docToMarkup(doc(seed));
      expect(nodesToMarkup(markupToNodes(markup)), `seed ${seed}`).toBe(markup);
      expect(markupToBlocks(markup).length > 0, `seed ${seed}`).toBe(true);
    }
  });

  it('rich text in generated documents is canonical', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const markup = docToMarkup(doc(seed));
      for (const [, text] of markup.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
        expect(sanitizeRichText(text!), `seed ${seed}`).toBe(text);
      }
    }
  });
});

describe('raw nodes', () => {
  it('preserve unknown blocks exactly, including their inner blocks', () => {
    const cover =
      '<!-- wp:cover {"url":"/x.jpg"} -->\n<div class="wp-block-cover"><!-- wp:paragraph -->\n<p>In cover</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:cover -->';
    const [node] = markupToNodes(cover);
    expect(node).toEqual({
      id: rawNodeId(cover),
      type: 'raw',
      props: { name: 'core/cover', markup: cover },
    });
    expect(nodesToMarkup([node!])).toBe(cover);
  });

  it('keep top-level freeform HTML', () => {
    const nodes = markupToNodes(
      '<p>Classic content</p>\n\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->',
    );
    expect(nodes.map((n) => n.type)).toEqual(['raw', 'divider']);
    expect(nodes[0]!.props).toEqual({ name: 'core/freeform', markup: '<p>Classic content</p>' });
  });

  it('get distinct, stable ids when the same markup repeats', () => {
    const markup = '<!-- wp:acme/x /-->\n\n<!-- wp:acme/x /-->';
    const ids = markupToNodes(markup).map((n) => n.id);
    expect(ids).toEqual([rawNodeId('<!-- wp:acme/x /-->'), rawNodeId('<!-- wp:acme/x /-->', 1)]);
    expect(markupToNodes(markup).map((n) => n.id)).toEqual(ids);
  });

  it('keep blocks with broken attribute JSON verbatim', () => {
    const broken = '<!-- wp:paragraph {"a": } -->\n<p>x</p>\n<!-- /wp:paragraph -->';
    expect(nodesToMarkup(markupToNodes(broken))).toBe(broken);
  });
});
