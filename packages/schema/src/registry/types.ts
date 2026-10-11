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

/** How a component renders as an HTML element (components Bestenberg renders itself). */
export interface ElementDef {
  /** Default tag. */
  tag: string;
  /** Tags `props.tag` may choose from (defaults to just `tag`). */
  tags?: readonly string[];
  /** Classes always present, before utility classes. */
  classes: readonly string[];
  /** Fixed extra attributes, e.g. `aria-hidden`. */
  attributes?: Readonly<Record<string, string>>;
}

/**
 * Registry entry for one component (SCHEMA.md §4). WP-agnostic: conversion
 * to and from blocks lives in @bestenberg/adapter-blocks, keyed by `type`.
 */
export interface ComponentDef {
  type: string;
  label: string;
  icon: string;
  category: ComponentCategory;
  /** Block that stores it: `bestenberg/section`, `core/heading`, … (`*` for raw). */
  block: string;
  props: z.ZodObject;
  styles: readonly StyleKey[];
  allowedChildren: readonly string[] | 'any' | 'none';
  allowedParents?: readonly string[];
  controls: readonly ControlDef[];
  /** Present for components rendered by Bestenberg (not core/Woo blocks). */
  element?: ElementDef;
  /** Internal components (raw) are never offered to users or the AI. */
  internal?: boolean;
  ai?: { description: string; examples?: Node[] };
}
