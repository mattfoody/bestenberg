import { describe, expect, it } from 'vitest';
import { defaultRegistry, validateDoc, walk, type Node } from '@bestenberg/schema';
import { DYNAMIC_BLOCKS, markupBlockName, rawNode } from './dynamic';
import { docToMarkup, markupToNodes, nodesToMarkup } from './index';
import { THEME_FILES } from './theme';

/** Types and raw markup in document order (ids of raw nodes are not stored, so they differ). */
function shape(nodes: Node[]): string[] {
  const out: string[] = [];
  walk(nodes, (node) =>
    out.push(node.type === 'raw' ? `raw:${String(node.props?.markup)}` : `${node.type}:${node.id}`),
  );
  return out;
}

describe('theme files', () => {
  it('have unique paths', () => {
    const paths = THEME_FILES.map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('templates/index.html');
    expect(paths).toContain('parts/header.html');
  });

  it.each(THEME_FILES.map((file) => [file.path, file] as const))('%s is valid', (_path, file) => {
    const result = validateDoc(file.doc, { registry: defaultRegistry });
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it.each(THEME_FILES.map((file) => [file.path, file] as const))(
    '%s survives markup → nodes → markup unchanged',
    (_path, file) => {
      const markup = docToMarkup(file.doc);
      const nodes = markupToNodes(markup);
      expect(shape(nodes)).toEqual(shape(file.doc.root));
      expect(nodesToMarkup(nodes)).toBe(markup);
    },
  );

  it('uses Bestenberg layout blocks in every template', () => {
    for (const file of THEME_FILES) {
      expect(docToMarkup(file.doc)).toContain('<!-- wp:bestenberg/');
    }
  });
});

describe('dynamic blocks', () => {
  it('have unique ids and parse back to a single raw node with the same markup', () => {
    const ids = DYNAMIC_BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const block of DYNAMIC_BLOCKS) {
      const nodes = markupToNodes(block.markup);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.type).toBe('raw');
      expect(nodes[0]!.props!.markup).toBe(block.markup);
      expect(nodes[0]!.props!.name).toBe(markupBlockName(block.markup));
    }
  });

  it('names blocks with and without a namespace', () => {
    expect(markupBlockName('<!-- wp:site-title /-->')).toBe('core/site-title');
    expect(markupBlockName('<!-- wp:woocommerce/mini-cart {"a":1} /-->')).toBe(
      'woocommerce/mini-cart',
    );
    expect(markupBlockName('plain text')).toBe('core/freeform');
  });

  it('creates raw nodes that serialize to their markup', () => {
    const node = rawNode('<!-- wp:site-title /-->');
    expect(node).toMatchObject({ type: 'raw', props: { name: 'core/site-title' } });
    expect(nodesToMarkup([node])).toBe('<!-- wp:site-title /-->');
  });
});
