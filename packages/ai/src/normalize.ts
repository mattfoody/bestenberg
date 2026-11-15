import {
  BREAKPOINTS,
  createId,
  defaultRegistry,
  isSafeUrl,
  sanitizeRichText,
  type Node,
  type Registry,
  type ResponsiveStyle,
  type Style,
} from '@bestenberg/schema';
import {
  ALIGN,
  ASPECTS,
  BORDER_WIDTHS,
  GRID_COLUMNS,
  JUSTIFY,
  TEXT_ALIGN,
} from '@bestenberg/tokens';
import { snapToken } from './snap';

/**
 * Turns whatever the model returned into schema nodes: fresh ids, snapped
 * tokens, sanitized text, and the small structural slips models make fixed
 * (loose buttons, flat styles, content outside a section). What cannot be
 * fixed safely is left for validation to report (SCHEMA.md §8).
 */

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const TYPE_ALIASES: Record<string, string> = {
  paragraph: 'text',
  p: 'text',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  title: 'heading',
  buttons: 'button-group',
  buttongroup: 'button-group',
  button_group: 'button-group',
  listitem: 'list-item',
  list_item: 'list-item',
  li: 'list-item',
  separator: 'divider',
  hr: 'divider',
  img: 'image',
  columns: 'grid',
  group: 'stack',
  column: 'stack',
  blockquote: 'quote',
  testimonial: 'quote',
};

const ENUM_ALIASES: Record<string, string> = {
  left: 'start',
  right: 'end',
  top: 'start',
  bottom: 'end',
  middle: 'center',
  'flex-start': 'start',
  'flex-end': 'end',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
  flex: 'row',
  horizontal: 'row',
  column: 'stack',
  vertical: 'stack',
  col: 'stack',
};

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.trim().toLowerCase();
  const candidate = (allowed as readonly string[]).includes(lower)
    ? lower
    : (ENUM_ALIASES[lower] ?? '');
  return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : undefined;
}

function nearestNumber<T extends number>(value: unknown, allowed: readonly T[]): T | undefined {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return undefined;
  return allowed.reduce((best, item) =>
    Math.abs(item - number) < Math.abs(best - number) ? item : best,
  );
}

/** Removes undefined values and empty objects; returns undefined if nothing is left. */
function compact<T extends Bag>(bag: T): T | undefined {
  const out: Bag = {};
  for (const [key, value] of Object.entries(bag)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
}

/** One breakpoint's style: known keys only, every value a valid token or enum. */
export function normalizeStyle(input: unknown, allowed: readonly string[]): Style | undefined {
  if (!isBag(input)) return undefined;
  const out: Bag = {};
  const space = (value: unknown) => snapToken('space', value);
  const color = (value: unknown) => snapToken('color', value);

  if (isBag(input.layout)) {
    const layout = input.layout;
    out.layout = compact({
      display: pick(layout.display, ['stack', 'row', 'grid'] as const),
      columns: nearestNumber(layout.columns, GRID_COLUMNS),
      gap: space(layout.gap),
      align: pick(layout.align, Object.keys(ALIGN)),
      justify: pick(layout.justify, Object.keys(JUSTIFY)),
      wrap: typeof layout.wrap === 'boolean' ? layout.wrap : undefined,
    });
  }

  if (isBag(input.padding)) {
    const padding = input.padding;
    out.padding = compact({
      x: space(padding.x ?? padding.left ?? padding.right ?? padding.horizontal),
      y: space(padding.y ?? padding.top ?? padding.bottom ?? padding.vertical),
    });
  } else if (input.padding !== undefined) {
    const all = space(input.padding);
    out.padding = compact({ x: all, y: all });
  }

  if (isBag(input.margin)) {
    out.margin = compact({ top: space(input.margin.top), bottom: space(input.margin.bottom) });
  }

  if (input.width !== undefined) {
    const width = String(input.width).trim().toLowerCase();
    if (width === 'auto' || width === 'full') out.width = width;
    else if (width === '100%') out.width = 'full';
    else out.width = snapToken('container', input.width);
  }
  out.height = space(input.height);

  if (isBag(input.background)) {
    const image = isBag(input.background.image) ? input.background.image : null;
    const url = image && typeof image.url === 'string' ? image.url.trim() : '';
    if (url !== '' && isSafeUrl(url)) {
      out.background = compact({ image: { url }, overlay: color(input.background.overlay) });
    } else {
      out.background = color(input.background.color);
    }
  } else {
    out.background = color(input.background);
  }
  out.color = color(input.color);

  if (isBag(input.font)) {
    const font = input.font;
    out.font = compact({
      family: snapToken('fontFamily', font.family),
      size: snapToken('fontSize', font.size),
      weight: snapToken('fontWeight', font.weight),
      lineHeight: snapToken('lineHeight', font.lineHeight ?? font['line-height']),
      align: pick(font.align, TEXT_ALIGN),
    });
  }

  out.radius = snapToken('radius', input.radius);
  out.shadow = snapToken('shadow', input.shadow);

  if (isBag(input.border)) {
    out.border = compact({
      width: nearestNumber(input.border.width, BORDER_WIDTHS),
      color: color(input.border.color),
    });
  }

  if (typeof input.aspect === 'string') {
    const aspect = input.aspect.replace(/\s+/g, '').replace(':', '/');
    out.aspect = pick(aspect === 'square' ? '1/1' : aspect, Object.keys(ASPECTS));
  }

  for (const key of Object.keys(out)) {
    if (!allowed.includes(key)) delete out[key];
  }
  return compact(out) as Style | undefined;
}

function normalizeResponsive(
  input: unknown,
  allowed: readonly string[],
): ResponsiveStyle | undefined {
  if (!isBag(input)) return undefined;
  const hasBreakpoints = BREAKPOINTS.some((bp) => isBag(input[bp]));
  // Accept a flat style ({ color: … }) as the base style; "mobile" as "base".
  const source: Bag = hasBreakpoints ? input : { base: input.mobile ?? input };
  const out: Bag = {};
  for (const bp of BREAKPOINTS) {
    const style = normalizeStyle(source[bp], allowed);
    if (style) out[bp] = style;
  }
  if (Object.keys(out).length === 0) return undefined;
  return { base: {}, ...out } as ResponsiveStyle;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? sanitizeRichText(value) : undefined;
}

function url(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed !== '' && isSafeUrl(trimmed) ? trimmed : undefined;
}

/** Component props with the usual near-misses mapped to the schema's names and types. */
function normalizeProps(type: string, input: Bag, rawType: string): Bag {
  const props: Bag = { ...input };
  const rename = (from: string, to: string) => {
    if (props[to] === undefined && props[from] !== undefined) props[to] = props[from];
    delete props[from];
  };

  switch (type) {
    case 'heading': {
      rename('content', 'text');
      const fromTag = /^h([1-6])$/.exec(rawType)?.[1];
      const level = nearestNumber(props.level ?? fromTag ?? 2, [1, 2, 3, 4, 5, 6] as const);
      props.level = level ?? 2;
      props.text = text(props.text) ?? '';
      break;
    }
    case 'text':
    case 'list-item':
      rename('content', 'text');
      props.text = text(props.text) ?? '';
      break;
    case 'button':
      rename('label', 'text');
      rename('content', 'text');
      rename('url', 'href');
      rename('link', 'href');
      props.text = text(props.text) ?? '';
      props.href = url(props.href);
      props.variant = pick(props.variant, ['primary', 'secondary', 'ghost'] as const);
      props.target = props.target === '_blank' ? '_blank' : undefined;
      break;
    case 'image':
      rename('url', 'src');
      props.src = url(props.src) ?? '';
      props.alt = typeof props.alt === 'string' ? props.alt : '';
      if (typeof props.mediaId !== 'number') delete props.mediaId;
      break;
    case 'list':
      props.ordered = props.ordered === true;
      break;
    case 'quote':
      rename('cite', 'citation');
      rename('author', 'citation');
      props.citation = text(props.citation);
      break;
    default:
      break;
  }
  for (const key of Object.keys(props)) {
    if (props[key] === undefined || props[key] === null) delete props[key];
  }
  return props;
}

function normalizeNode(input: unknown, registry: Registry): Node | null {
  if (typeof input === 'string') {
    return { id: createId(), type: 'text', props: { text: sanitizeRichText(input) } };
  }
  if (!isBag(input) || typeof input.type !== 'string') return null;
  const rawType = input.type.trim().toLowerCase();
  const type = registry.has(rawType) ? rawType : (TYPE_ALIASES[rawType] ?? rawType);
  const def = registry.get(type);
  const node: Node = { id: createId(), type };
  if (!def || def.internal) return node; // Unknown: validation names it for repair.

  const props = isBag(input.props) ? input.props : {};
  // Models sometimes put text straight on the node.
  for (const key of ['text', 'content', 'label', 'href', 'src', 'alt', 'level']) {
    if (props[key] === undefined && input[key] !== undefined) props[key] = input[key];
  }
  node.props = normalizeProps(type, props, rawType);

  const style = normalizeResponsive(input.style, def.styles);
  if (style) node.style = style;

  let children = Array.isArray(input.children) ? input.children : [];
  if (type === 'quote' && children.length === 0 && typeof props.text === 'string') {
    children = [{ type: 'text', props: { text: props.text } }];
    delete node.props.text;
  }
  if (type === 'list') {
    children = children.map((child) =>
      typeof child === 'string' ? { type: 'list-item', props: { text: child } } : child,
    );
    if (children.length === 0 && Array.isArray(props.items)) {
      children = props.items.map((item) => ({ type: 'list-item', props: { text: String(item) } }));
    }
    delete node.props.items;
  }
  if (def.allowedChildren !== 'none') {
    const normalized = normalizeList(children, registry);
    const fixed = type === 'button-group' ? normalized : wrapButtons(normalized);
    if (fixed.length > 0) node.children = fixed;
  }
  return node;
}

function normalizeList(input: unknown[], registry: Registry): Node[] {
  return input
    .map((item) => normalizeNode(item, registry))
    .filter((node): node is Node => node !== null);
}

/** Buttons must sit in a button group: consecutive loose buttons get one. */
function wrapButtons(nodes: Node[]): Node[] {
  const out: Node[] = [];
  let group: Node | null = null;
  for (const node of nodes) {
    if (node.type !== 'button') {
      group = null;
      out.push(node);
      continue;
    }
    if (!group) {
      group = { id: createId(), type: 'button-group', props: {}, children: [] };
      out.push(group);
    }
    group.children!.push(node);
  }
  return out;
}

/** Top-level content must be sections: anything else is wrapped in one. */
function wrapTopLevel(nodes: Node[]): Node[] {
  const out: Node[] = [];
  let loose: Node[] = [];
  const flush = () => {
    if (loose.length === 0) return;
    out.push({
      id: createId(),
      type: 'section',
      props: {},
      style: { base: { padding: { x: 'space.6', y: 'space.16' } } },
      children: [
        {
          id: createId(),
          type: 'container',
          style: { base: { width: 'container.lg' } },
          children: wrapButtons(loose),
        },
      ],
    });
    loose = [];
  };
  for (const node of nodes) {
    if (node.type === 'section') {
      flush();
      out.push(node);
    } else {
      loose.push(node);
    }
  }
  flush();
  return out;
}

/** The node list inside a model answer: `{sections: […]}`, `{root: […]}`, an array or one node. */
function nodeList(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isBag(input)) return [];
  for (const key of ['sections', 'root', 'nodes', 'children']) {
    if (Array.isArray(input[key])) return input[key];
  }
  return typeof input.type === 'string' ? [input] : [];
}

export function normalizeNodes(input: unknown, registry: Registry = defaultRegistry): Node[] {
  return wrapTopLevel(normalizeList(nodeList(input), registry));
}

/** A copy without ids, as shown to the model (it never writes ids). */
export function stripIds(nodes: readonly Node[]): unknown[] {
  return nodes.map((node) => {
    const copy: Record<string, unknown> = { ...node };
    delete copy.id;
    if (node.children) copy.children = stripIds(node.children);
    return copy;
  });
}
