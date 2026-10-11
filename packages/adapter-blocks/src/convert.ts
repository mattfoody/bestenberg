import {
  createId,
  defaultRegistry,
  isSafeUrl,
  RAW_TYPE,
  sanitizeRichText,
  type ComponentDef,
  type Doc,
  type Node,
  type Registry,
} from '@bestenberg/schema';
import { compact } from './grammar';
import type { BlockInstance } from './types';

/**
 * Schema ⇄ block conversion (SCHEMA.md §7).
 *
 * Bestenberg blocks store `{ bbId, props, style, bind, locked, hidden }` as
 * attributes. Core blocks store their native attributes plus
 * `bestenberg: { id, style, locked, hidden }`. Blocks nothing here understands
 * become `raw` nodes holding their exact markup.
 *
 * Round-trips are exact for canonical nodes: rich text already sanitized,
 * empty `children` omitted, and `props` always present on core-block
 * components (their props come from block attributes).
 */

export interface ConvertOptions {
  registry?: Registry;
}

interface Context {
  registry: Registry;
  rawCounts: Map<string, number>;
}

type Attributes = Record<string, unknown>;

interface ComponentAdapter {
  toBlock(node: Node, innerBlocks: BlockInstance[]): BlockInstance;
  fromBlock(block: BlockInstance, children: Node[]): Node;
}

const isObject = (value: unknown): value is Attributes =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const objectOrUndefined = <T>(value: unknown): T | undefined =>
  isObject(value) ? (value as T) : undefined;
const LOCKS = ['none', 'content', 'all'];

/** Stable id for a raw node: hash of its markup plus its occurrence index. */
export function rawNodeId(markup: string, occurrence = 0): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < markup.length; i++) {
    hash ^= markup.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `raw${hash.toString(36)}${occurrence > 0 ? `-${occurrence}` : ''}`;
}

/** Common node fields from shared metadata (`bestenberg` or own-block attributes). */
function baseNode(type: string, id: unknown, source: Attributes): Node {
  return compact({
    id: typeof id === 'string' && id !== '' ? id : createId(),
    type,
    style: objectOrUndefined<Node['style']>(source.style),
    locked:
      typeof source.locked === 'string' && LOCKS.includes(source.locked)
        ? (source.locked as Node['locked'])
        : undefined,
    hidden: objectOrUndefined<Node['hidden']>(source.hidden),
  }) as Node;
}

const withChildren = (node: Node, children: Node[]): Node =>
  children.length > 0 ? { ...node, children } : node;

// ── Bestenberg blocks ───────────────────────────────────────────────────────

function ownAdapter(def: ComponentDef): ComponentAdapter {
  return {
    toBlock: (node, innerBlocks) => ({
      name: def.block,
      attributes: compact({
        bbId: node.id,
        props: node.props,
        style: node.style,
        bind: node.bind,
        locked: node.locked,
        hidden: node.hidden,
      }),
      innerBlocks,
    }),
    fromBlock(block, children) {
      const a = block.attributes;
      const node = compact({
        ...baseNode(def.type, a.bbId, a),
        props: objectOrUndefined<Attributes>(a.props),
        bind: objectOrUndefined<Node['bind']>(a.bind),
      }) as Node;
      return withChildren(node, children);
    },
  };
}

// ── Core blocks ─────────────────────────────────────────────────────────────

function coreAdapter(
  def: ComponentDef,
  toAttributes: (props: Attributes) => Attributes,
  toProps: (attributes: Attributes) => Attributes,
): ComponentAdapter {
  return {
    toBlock: (node, innerBlocks) => ({
      name: def.block,
      attributes: compact({
        ...toAttributes(node.props ?? {}),
        bestenberg: compact({
          id: node.id,
          style: node.style,
          locked: node.locked,
          hidden: node.hidden,
        }),
      }),
      innerBlocks,
    }),
    fromBlock(block, children) {
      const metaAttributes = objectOrUndefined<Attributes>(block.attributes.bestenberg) ?? {};
      const node: Node = {
        ...baseNode(def.type, metaAttributes.id, metaAttributes),
        props: compact(toProps(block.attributes)),
      };
      return withChildren(node, children);
    },
  };
}

const text = (value: unknown): string => sanitizeRichText(typeof value === 'string' ? value : '');
const safeUrl = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' && isSafeUrl(value) ? value : undefined;
const VARIANT = /^is-style-(primary|secondary|ghost)$/;

const CORE_ADAPTERS: Record<
  string,
  [toAttributes: (props: Attributes) => Attributes, toProps: (attributes: Attributes) => Attributes]
> = {
  heading: [
    (p) => ({ level: p.level, content: text(p.text) }),
    (a) => ({ text: text(a.content), level: typeof a.level === 'number' ? a.level : 2 }),
  ],
  text: [(p) => ({ content: text(p.text) }), (a) => ({ text: text(a.content) })],
  list: [(p) => ({ ordered: p.ordered === true }), (a) => ({ ordered: a.ordered === true })],
  'list-item': [(p) => ({ content: text(p.text) }), (a) => ({ text: text(a.content) })],
  'button-group': [() => ({}), () => ({})],
  button: [
    (p) => ({
      text: text(p.text),
      url: safeUrl(p.href),
      linkTarget: p.target,
      rel: p.target === '_blank' ? 'noreferrer noopener' : undefined,
      className: typeof p.variant === 'string' ? `is-style-${p.variant}` : undefined,
    }),
    (a) => ({
      text: text(a.text),
      href: safeUrl(a.url),
      target: a.linkTarget === '_blank' || a.linkTarget === '_self' ? a.linkTarget : undefined,
      variant: (typeof a.className === 'string' ? a.className : '')
        .split(/\s+/)
        .map((name) => VARIANT.exec(name)?.[1])
        .find((variant) => variant !== undefined),
    }),
  ],
  image: [
    (p) => ({
      url: safeUrl(p.src) ?? '',
      alt: typeof p.alt === 'string' ? p.alt : '',
      id: p.mediaId,
    }),
    (a) => ({
      src: safeUrl(a.url) ?? '',
      alt: typeof a.alt === 'string' ? a.alt : '',
      mediaId: typeof a.id === 'number' ? a.id : undefined,
    }),
  ],
  divider: [() => ({}), () => ({})],
  quote: [
    (p) => ({ citation: typeof p.citation === 'string' ? text(p.citation) : undefined }),
    (a) => ({
      citation: typeof a.citation === 'string' && a.citation !== '' ? text(a.citation) : undefined,
    }),
  ],
};

// ── Lookup ──────────────────────────────────────────────────────────────────

const adapterCache = new WeakMap<Registry, Map<string, ComponentAdapter>>();

function adapterFor(registry: Registry, def: ComponentDef): ComponentAdapter {
  let cache = adapterCache.get(registry);
  if (!cache) adapterCache.set(registry, (cache = new Map()));
  let adapter = cache.get(def.type);
  if (!adapter) {
    if (def.block.startsWith('bestenberg/')) {
      adapter = ownAdapter(def);
    } else {
      const pair = CORE_ADAPTERS[def.type];
      if (!pair) throw new Error(`No block adapter for component "${def.type}"`);
      adapter = coreAdapter(def, ...pair);
    }
    cache.set(def.type, adapter);
  }
  return adapter;
}

/** Names of blocks Bestenberg renders itself (dynamic, attribute-only). */
export function ownBlockNames(registry: Registry = defaultRegistry): Set<string> {
  return new Set(
    registry
      .list()
      .map((def) => def.block)
      .filter((name) => name.startsWith('bestenberg/')),
  );
}

// ── Nodes → blocks ──────────────────────────────────────────────────────────

function nodeToBlock(node: Node, registry: Registry): BlockInstance {
  if (node.type === RAW_TYPE) {
    const props = node.props ?? {};
    return {
      name: typeof props.name === 'string' ? props.name : 'core/freeform',
      attributes: {},
      innerBlocks: [],
      originalContent: typeof props.markup === 'string' ? props.markup : '',
    };
  }
  const def = registry.get(node.type);
  if (!def) throw new Error(`Unknown component "${node.type}"`);
  const inner = (node.children ?? []).map((child) => nodeToBlock(child, registry));
  return adapterFor(registry, def).toBlock(node, inner);
}

export function nodesToBlocks(nodes: Node[], options: ConvertOptions = {}): BlockInstance[] {
  const registry = options.registry ?? defaultRegistry;
  return nodes.map((node) => nodeToBlock(node, registry));
}

export function docToBlocks(doc: Doc, options: ConvertOptions = {}): BlockInstance[] {
  return nodesToBlocks(doc.root, options);
}

// ── Blocks → nodes ──────────────────────────────────────────────────────────

function rawNode(block: BlockInstance, context: Context, markup: string): Node {
  const occurrence = context.rawCounts.get(markup) ?? 0;
  context.rawCounts.set(markup, occurrence + 1);
  return {
    id: rawNodeId(markup, occurrence),
    type: RAW_TYPE,
    props: { name: block.name, markup },
  };
}

function blockToNode(block: BlockInstance, context: Context): Node {
  if (block.originalContent !== undefined) {
    return rawNode(block, context, block.originalContent);
  }
  const def = context.registry.forBlock(block.name);
  if (!def || def.internal) {
    throw new Error(`Block "${block.name}" has no component; parse() keeps such blocks verbatim`);
  }
  const children = block.innerBlocks.map((child) => blockToNode(child, context));
  return adapterFor(context.registry, def).fromBlock(block, children);
}

export function blocksToNodes(blocks: BlockInstance[], options: ConvertOptions = {}): Node[] {
  const context: Context = {
    registry: options.registry ?? defaultRegistry,
    rawCounts: new Map(),
  };
  return blocks.map((block) => blockToNode(block, context));
}
