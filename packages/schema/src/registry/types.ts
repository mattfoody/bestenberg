import type { TokenCategory } from '@bestenberg/tokens';
import type { z } from 'zod/v4';
import type { Node } from '../document';
import type { StyleKey } from '../style';

/** Fixed inspector group order (SCHEMA.md §5). */
export const CONTROL_GROUPS = [
  'content',
  'layout',
  'spacing',
  'typography',
  'color',
  'effects',
  'visibility',
  'data',
] as const;
export type ControlGroup = (typeof CONTROL_GROUPS)[number];

export type ControlKind =
  | 'token'
  | 'segmented'
  | 'toggle'
  | 'text'
  | 'richtext'
  | 'media'
  | 'link'
  | 'select'
  | 'columns'
  | 'binding'
  | 'query';

export interface ControlOption {
  value: unknown;
  label: string;
  icon?: string;
}

/** One inspector control. `path` is relative to the node: `style.padding.y`, `props.level`. */
export interface ControlDef {
  id: string;
  group: ControlGroup;
  label: string;
  kind: ControlKind;
  path: string;
  token?: TokenCategory;
  options?: readonly ControlOption[];
  /** Writes to `style[breakpoint]` instead of `style.base`. */
  responsive?: boolean;
  showIf?: (node: Node) => boolean;
  /** Also shown in the floating toolbar. */
  quick?: boolean;
}

export type ComponentCategory = 'layout' | 'content' | 'media' | 'commerce' | 'navigation' | 'data';

/** WP-agnostic block shape (matches @wordpress/blocks BlockInstance structurally). */
export interface BlockInstance {
  name: string;
  attributes: Record<string, unknown>;
  innerBlocks: BlockInstance[];
}

/** Registry entry for one component (SCHEMA.md §4). */
export interface ComponentDef {
  type: string;
  label: string;
  icon: string;
  category: ComponentCategory;
  /** Block that stores and renders it: `bestenberg/section`, `core/heading`, … */
  block: string;
  props: z.ZodObject;
  styles: readonly StyleKey[];
  allowedChildren: readonly string[] | 'any' | 'none';
  allowedParents?: readonly string[];
  controls: readonly ControlDef[];
  ai?: { description: string; examples?: Node[] };
  /** Schema → block (implemented in M2). */
  toBlock?: (node: Node) => BlockInstance;
  /** Block → schema (implemented in M2). */
  fromBlock?: (block: BlockInstance) => Node;
}
