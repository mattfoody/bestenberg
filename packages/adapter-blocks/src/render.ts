import {
  BREAKPOINTS,
  componentClasses,
  defaultRegistry,
  escapeAttribute,
  isSafeUrl,
  nodeClasses,
  RAW_TYPE,
  type Node,
  type Registry,
} from '@bestenberg/schema';
import { nodesToBlocks } from './convert';
import { CORE_BLOCKS } from './core-blocks';

/**
 * Renders nodes to HTML in TypeScript: the same markup the PHP plugin
 * produces on the frontend (Bestenberg blocks) or WordPress saves (core
 * blocks), with utility classes applied. The editor canvas uses it for
 * instant feedback; `editor: true` adds `data-bb-*` hooks for selection and
 * inline text editing.
 */
export interface RenderOptions {
  registry?: Registry;
  /** Add data-bb-id / data-bb-text hooks and placeholders for the editor canvas. */
  editor?: boolean;
}

const TAG =
  /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const INNER = '\u0000bb-inner\u0000';

/** Which element of a core block holds an editable rich-text prop (editor mode). */
const TEXT_TARGETS: Record<string, { prop: string; target: string | null }> = {
  heading: { prop: 'text', target: null },
  text: { prop: 'text', target: null },
  button: { prop: 'text', target: 'a' },
  quote: { prop: 'citation', target: 'cite' },
};

function attrs(pairs: Array<[string, string | undefined]>): string {
  return pairs
    .filter((pair): pair is [string, string] => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
}

/**
 * Adds classes and attributes to the first start tag matching `target`
 * (`null` = first tag, `.name` = has that class, otherwise a tag name).
 */
export function decorateTag(
  html: string,
  target: string | null,
  classes: readonly string[],
  extra = '',
): string {
  if (classes.length === 0 && extra === '') return html;
  let done = false;
  TAG.lastIndex = 0;
  return html.replace(TAG, (whole, name: string, source: string, close: string) => {
    if (done) return whole;
    const classMatch = /\sclass\s*=\s*"([^"]*)"/.exec(source);
    const existing = classMatch ? classMatch[1]!.split(/\s+/).filter(Boolean) : [];
    if (target !== null) {
      const matches = target.startsWith('.')
        ? existing.includes(target.slice(1))
        : name.toLowerCase() === target;
      if (!matches) return whole;
    }
    done = true;
    let rest = source;
    if (classes.length > 0) {
      const merged = [...new Set([...existing, ...classes])].join(' ');
      rest = classMatch
        ? source.replace(classMatch[0], ` class="${escapeAttribute(merged)}"`)
        : `${source} class="${escapeAttribute(merged)}"`;
    }
    return `<${name}${rest}${extra}${close ? '/' : ''}>`;
  });
}

const percentEncode = (char: string) =>
  `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;

/** Inline background image for the first breakpoint that sets one. */
export function backgroundImageStyle(node: Pick<Node, 'style'>): string | undefined {
  for (const breakpoint of BREAKPOINTS) {
    const background = node.style?.[breakpoint]?.background;
    if (typeof background === 'object' && isSafeUrl(background.image.url)) {
      return `background-image:url('${background.image.url.replace(/['\\()\s]/g, percentEncode)}')`;
    }
  }
  return undefined;
}

function renderNode(node: Node, registry: Registry, editor: boolean): string {
  const id: [string, string | undefined] = ['data-bb-id', editor ? node.id : undefined];

  if (node.type === RAW_TYPE) {
    if (!editor) return typeof node.props?.markup === 'string' ? node.props.markup : '';
    const name = typeof node.props?.name === 'string' ? node.props.name : '';
    return `<div class="bb-raw"${attrs([id, ['data-bb-raw', name]])}></div>`;
  }

  const def = registry.get(node.type);
  if (!def) return '';
  const inner = (node.children ?? []).map((child) => renderNode(child, registry, editor)).join('');

  if (def.element) {
    const props = node.props ?? {};
    const tag =
      typeof props.tag === 'string' && (def.element.tags ?? [def.element.tag]).includes(props.tag)
        ? props.tag
        : def.element.tag;
    const classes = componentClasses(def, node);
    if (editor && def.allowedChildren !== 'none' && inner === '') classes.push('bb-empty');
    const anchor =
      typeof props.anchor === 'string' && /^[A-Za-z][\w-]*$/.test(props.anchor)
        ? props.anchor
        : undefined;
    const attributes = attrs([
      ['class', classes.join(' ')],
      ['id', anchor],
      ['style', backgroundImageStyle(node)],
      ...Object.entries(def.element.attributes ?? {}),
      id,
    ]);
    return `<${tag}${attributes}>${def.allowedChildren === 'none' ? '' : inner}</${tag}>`;
  }

  const spec = CORE_BLOCKS[def.block];
  if (!spec) return '';
  const own: Node = { ...node };
  delete own.children;
  const [block] = nodesToBlocks([own], { registry });
  const blockAttributes = { ...block!.attributes };

  // In the editor, a list item's text sits in its own element so it can be edited apart from nested lists.
  if (editor && node.type === 'list-item') {
    const text = typeof blockAttributes.content === 'string' ? blockAttributes.content : '';
    return `<li${attrs([id])}><span data-bb-text="text">${text}</span>${inner}</li>`;
  }

  let html = spec.save(blockAttributes, INNER).html;
  html = decorateTag(html, spec.styleTarget ?? null, nodeClasses(node));
  if (editor) {
    html = decorateTag(html, null, [], attrs([id]));
    const text = TEXT_TARGETS[node.type];
    if (text) html = decorateTag(html, text.target, [], ` data-bb-text="${text.prop}"`);
  }
  return html.replace(INNER, () => inner);
}

/** HTML for a list of nodes. */
export function renderNodes(nodes: Node[], options: RenderOptions = {}): string {
  const registry = options.registry ?? defaultRegistry;
  return nodes.map((node) => renderNode(node, registry, options.editor === true)).join('');
}
