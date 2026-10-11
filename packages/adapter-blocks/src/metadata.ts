import { defaultRegistry, type ComponentDef, type Registry } from '@bestenberg/schema';
import { CORE_BLOCKS } from './core-blocks';

/**
 * WordPress-side metadata derived from the registry: block.json for
 * Bestenberg blocks and the runtime config the PHP plugin reads.
 */

/** Script handle that registers Bestenberg blocks in the block editor. */
export const EDITOR_SCRIPT_HANDLE = 'bestenberg-blocks';

/** Attributes every Bestenberg block stores (SCHEMA.md §7). */
export const OWN_BLOCK_ATTRIBUTES = {
  bbId: { type: 'string' },
  props: { type: 'object' },
  style: { type: 'object' },
  bind: { type: 'object' },
  locked: { type: 'string', enum: ['none', 'content', 'all'] },
  hidden: { type: 'object' },
} as const;

/** Attribute added to core blocks for Bestenberg metadata. */
export const CORE_META_ATTRIBUTE = { bestenberg: { type: 'object' } } as const;

const isOwn = (def: ComponentDef) => def.block.startsWith('bestenberg/');

export function ownComponents(registry: Registry = defaultRegistry): ComponentDef[] {
  return registry.list().filter(isOwn);
}

export function coreComponents(registry: Registry = defaultRegistry): ComponentDef[] {
  return registry.list().filter((def) => !def.internal && !isOwn(def));
}

/** block.json for a Bestenberg block. */
export function blockJson(def: ComponentDef): Record<string, unknown> {
  if (!isOwn(def) || !def.element) throw new Error(`"${def.type}" is not a Bestenberg block`);
  return {
    $schema: 'https://schemas.wp.org/trunk/block.json',
    apiVersion: 3,
    name: def.block,
    title: def.label,
    category: 'design',
    ...(def.ai ? { description: def.ai.description } : {}),
    textdomain: 'bestenberg',
    attributes: OWN_BLOCK_ATTRIBUTES,
    supports: {
      html: false,
      className: false,
      customClassName: false,
    },
    editorScript: EDITOR_SCRIPT_HANDLE,
  };
}

export interface OwnBlockRuntime {
  type: string;
  tag: string;
  tags: readonly string[];
  classes: readonly string[];
  attributes: Readonly<Record<string, string>>;
  container: boolean;
}

export interface CoreBlockRuntime {
  type: string;
  /** `.class` or tag name of the element that receives utility classes; null = first tag. */
  target: string | null;
}

/** Runtime config for the PHP plugin (generated/components.php). */
export function runtimeConfig(registry: Registry = defaultRegistry): {
  blocks: Record<string, OwnBlockRuntime>;
  core: Record<string, CoreBlockRuntime>;
} {
  const blocks: Record<string, OwnBlockRuntime> = {};
  for (const def of ownComponents(registry)) {
    const element = def.element!;
    blocks[def.block] = {
      type: def.type,
      tag: element.tag,
      tags: element.tags ?? [element.tag],
      classes: element.classes,
      attributes: element.attributes ?? {},
      container: def.allowedChildren !== 'none',
    };
  }

  const core: Record<string, CoreBlockRuntime> = {};
  for (const def of coreComponents(registry)) {
    const spec = CORE_BLOCKS[def.block];
    if (!spec) throw new Error(`No core block spec for "${def.block}"`);
    core[def.block] = { type: def.type, target: spec.styleTarget ?? null };
  }

  return { blocks, core };
}
