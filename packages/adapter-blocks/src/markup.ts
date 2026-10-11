import { CORE_BLOCKS } from './core-blocks';
import { blockComment, parseGrammar } from './grammar';
import type { BlockInstance, ParsedBlock } from './types';

export interface ParseOptions {
  /**
   * Names of dynamic blocks whose attributes and inner blocks are taken as-is
   * (Bestenberg's own blocks). Any other unknown block is kept verbatim.
   */
  dynamicBlocks: ReadonlySet<string>;
}

/** Serializes one block. Verbatim blocks are written exactly as they were read. */
export function serializeBlock(block: BlockInstance): string {
  if (block.originalContent !== undefined) return block.originalContent;

  const inner = block.innerBlocks.map(serializeBlock).join('\n\n');
  const core = CORE_BLOCKS[block.name];
  if (core) {
    const { comment, html } = core.save(block.attributes, inner);
    return blockComment(block.name, comment, html);
  }
  // Dynamic block: attributes in the comment, inner blocks as content.
  return blockComment(block.name, block.attributes, inner);
}

/** Block markup for a list of blocks (same separators as WordPress). */
export function serialize(blocks: BlockInstance[]): string {
  return blocks.map(serializeBlock).join('\n\n');
}

function verbatim(parsed: ParsedBlock, source: string): BlockInstance {
  return {
    name: parsed.blockName ?? 'core/freeform',
    attributes: parsed.attrs ?? {},
    innerBlocks: [],
    originalContent: source.slice(parsed.start, parsed.end),
  };
}

function toInstance(
  parsed: ParsedBlock,
  source: string,
  options: ParseOptions,
): BlockInstance | null {
  if (parsed.blockName === null) {
    const html = parsed.innerHTML.trim();
    return html
      ? { name: 'core/freeform', attributes: {}, innerBlocks: [], originalContent: html }
      : null;
  }
  if (parsed.attrs === null) return verbatim(parsed, source);

  const core = CORE_BLOCKS[parsed.blockName];
  const dynamic = options.dynamicBlocks.has(parsed.blockName);
  if (!core && !dynamic) return verbatim(parsed, source);

  const attributes = core ? core.extract(parsed) : parsed.attrs;
  if (attributes === null) return verbatim(parsed, source);

  return {
    name: parsed.blockName,
    attributes,
    innerBlocks: parsed.innerBlocks
      .map((child) => toInstance(child, source, options))
      .filter((child): child is BlockInstance => child !== null),
  };
}

/** Parses block markup into block instances. */
export function parse(markup: string, options: ParseOptions): BlockInstance[] {
  return parseGrammar(markup)
    .map((parsed) => toInstance(parsed, markup, options))
    .filter((block): block is BlockInstance => block !== null);
}
