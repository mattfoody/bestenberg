/**
 * Block shapes. `BlockInstance` matches @wordpress/blocks' BlockInstance
 * structurally (name, attributes, innerBlocks, originalContent), so the
 * editor can hand these to `createBlock` unchanged.
 */
export interface BlockInstance {
  name: string;
  attributes: Record<string, unknown>;
  innerBlocks: BlockInstance[];
  /** Exact markup of a block kept verbatim (unsupported or unparseable blocks). */
  originalContent?: string;
}

/** Output of the grammar parser (same shape as WordPress' default parser). */
export interface ParsedBlock {
  /** `null` for freeform HTML between blocks. */
  blockName: string | null;
  /** `null` when the comment JSON could not be parsed. */
  attrs: Record<string, unknown> | null;
  innerBlocks: ParsedBlock[];
  /** HTML of this block without its inner blocks. */
  innerHTML: string;
  /** HTML chunks, with `null` where each inner block sits. */
  innerContent: Array<string | null>;
  /** Offsets of the whole block, delimiters included, in the source. */
  start: number;
  end: number;
}
