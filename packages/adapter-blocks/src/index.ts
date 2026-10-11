/**
 * @bestenberg/adapter-blocks — Bestenberg schema ⇄ WordPress blocks
 * (PLAN.md §3, SCHEMA.md §7). Works without WordPress loaded: markup is
 * produced and read by a small implementation of the block grammar and of
 * the core blocks Bestenberg uses.
 */
import type { Doc, Node } from '@bestenberg/schema';
import {
  blocksToNodes,
  docToBlocks,
  nodesToBlocks,
  ownBlockNames,
  type ConvertOptions,
} from './convert';
import { parse, serialize } from './markup';
import type { BlockInstance } from './types';

export * from './types';
export * from './grammar';
export * from './core-blocks';
export * from './markup';
export * from './convert';
export * from './metadata';

/** Block namespace for Bestenberg's own blocks. */
export const BLOCK_NAMESPACE = 'bestenberg' as const;

/** Builds a fully qualified Bestenberg block name, e.g. `bestenberg/section`. */
export function blockName(name: string): `${typeof BLOCK_NAMESPACE}/${string}` {
  return `${BLOCK_NAMESPACE}/${name}`;
}

/** Block markup for a list of nodes. */
export function nodesToMarkup(nodes: Node[], options: ConvertOptions = {}): string {
  return serialize(nodesToBlocks(nodes, options));
}

/** Block markup for a document (what WordPress stores as post content). */
export function docToMarkup(doc: Doc, options: ConvertOptions = {}): string {
  return serialize(docToBlocks(doc, options));
}

/** Block instances from markup; unsupported blocks are kept verbatim. */
export function markupToBlocks(markup: string, options: ConvertOptions = {}): BlockInstance[] {
  return parse(markup, { dynamicBlocks: ownBlockNames(options.registry) });
}

/** Nodes from markup; unsupported blocks become `raw` nodes. */
export function markupToNodes(markup: string, options: ConvertOptions = {}): Node[] {
  return blocksToNodes(markupToBlocks(markup, options), options);
}
