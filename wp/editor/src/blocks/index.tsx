/**
 * Registers Bestenberg blocks in the block editor and adds the `bestenberg`
 * attribute to the core blocks Bestenberg styles, so editing in any block
 * editor keeps Bestenberg data intact. Bestenberg's own editor UI is M3.
 */
import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { addFilter } from '@wordpress/hooks';
import { CORE_BLOCK_NAMES, CORE_META_ATTRIBUTE, OWN_BLOCKS } from './manifest';

function ContainerEdit() {
  return <div {...useInnerBlocksProps(useBlockProps())} />;
}

function LeafEdit() {
  return <div {...useBlockProps()} />;
}

const saveInnerBlocks = () => <InnerBlocks.Content />;
const saveNothing = () => null;

interface BlockSettings {
  attributes?: Record<string, unknown>;
}

addFilter<BlockSettings>(
  'blocks.registerBlockType',
  'bestenberg/core-meta-attribute',
  (settings, name: string) =>
    CORE_BLOCK_NAMES.includes(name)
      ? { ...settings, attributes: { ...settings.attributes, ...CORE_META_ATTRIBUTE } }
      : settings,
);

for (const { metadata, container } of OWN_BLOCKS) {
  registerBlockType(metadata, {
    edit: container ? ContainerEdit : LeafEdit,
    save: container ? saveInnerBlocks : saveNothing,
  });
}
