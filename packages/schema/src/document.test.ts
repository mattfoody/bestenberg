import { describe, expect, it } from 'vitest';
import {
  createId,
  defaultRegistry,
  docJsonSchema,
  formatPath,
  validateDoc,
  walk,
  type Doc,
  type Node,
} from './index';

function sampleDoc(): Doc {
  return {
    schemaVersion: 1,
    kind: 'page',
    meta: { title: 'Home', slug: 'home' },
    root: [
      {
        id: 'hero0001',
        type: 'section',
        props: { tag: 'section' },
        style: {
          base: { padding: { y: 'space.16', x: 'space.6' }, background: 'color.primary' },
          desktop: { padding: { y: 'space.24' } },
        },
        children: [
          {
            id: 'grid0001',
            type: 'grid',
            style: {
              base: { layout: { columns: 1, gap: 'space.6' } },
              desktop: { layout: { columns: 3 } },
            },
            children: [
              { id: 'head0001', type: 'heading', props: { text: 'Hello', level: 1 } },
              { id: 'text0001', type: 'text', props: { text: 'Welcome <strong>in</strong>.' } },
              {
                id: 'btn00001',
                type: 'button',
                props: { text: 'Start', href: '/start', variant: 'primary' },
                hidden: { base: true },
              },
            ],
          },
        ],
      },
    ],
  };
}

const issues = (doc: unknown, withRegistry = true) => {
  const result = validateDoc(doc, withRegistry ? { registry: defaultRegistry } : {});
  return result.ok ? [] : result.issues;
};

describe('validateDoc', () => {
  it('accepts a valid document', () => {
    const result = validateDoc(sampleDoc(), { registry: defaultRegistry });
    expect(result.ok).toBe(true);
  });

  it('rejects raw values and unknown style keys with exact paths', () => {
    const doc = sampleDoc() as unknown as { root: Array<Record<string, unknown>> };
    const style = doc.root[0]!.style as { base: Record<string, unknown> };
    style.base.padding = { y: '13px' };
    style.base.css = 'color:red';
    const found = issues(doc);
    expect(found.map((i) => i.path)).toEqual([
      'root[0].style.base.padding.y',
      'root[0].style.base',
    ]);
    expect(found[1]!.message).toMatch('css');
  });

  it('rejects wrong schema versions and kinds', () => {
    const doc = { ...sampleDoc(), schemaVersion: 2, kind: 'post' };
    expect(issues(doc).map((i) => i.path)).toEqual(['schemaVersion', 'kind']);
  });

  it('reports duplicate ids with the first location', () => {
    const doc = sampleDoc();
    doc.root[0]!.children![0]!.children![1]!.id = 'hero0001';
    expect(issues(doc)).toEqual([
      {
        path: 'root[0].children[0].children[1].id',
        message: 'duplicate id "hero0001" (first at root[0])',
      },
    ]);
  });

  it('checks component types, props, styles and nesting against the registry', () => {
    const doc = sampleDoc();
    const [heading, text] = doc.root[0]!.children![0]!.children!;
    heading!.props = { text: 'Hi', level: 9 };
    heading!.style = { base: { padding: { y: 'space.4' } } };
    text!.children = [{ id: 'nested01', type: 'text', props: { text: 'x' } }];
    doc.root.push({ id: 'mystery1', type: 'carousel' });

    expect(issues(doc).map((i) => `${i.path}: ${i.message}`)).toEqual([
      'root[0].children[0].children[0].props.level: Invalid option: expected one of 1|2|3|4|5|6',
      'root[0].children[0].children[0].style.base.padding: style "padding" is not allowed on heading',
      'root[0].children[0].children[1].children: text cannot have children',
      'root[1].type: unknown component "carousel"',
    ]);
  });

  it('skips registry checks when no registry is given', () => {
    const doc = sampleDoc();
    doc.root.push({ id: 'mystery1', type: 'carousel' });
    expect(issues(doc, false)).toEqual([]);
  });

  it('validates bindings by source', () => {
    const doc = sampleDoc();
    const node = doc.root[0]!.children![0]!;
    node.bind = { source: 'query', postType: 'post', perPage: 6 };
    expect(issues(doc)).toEqual([]);
    (node as unknown as { bind: unknown }).bind = { source: 'woo/product', field: 'colour' };
    expect(issues(doc)[0]!.path).toBe('root[0].children[0].bind.field');
  });
});

describe('ids and paths', () => {
  it('creates 10-char alphanumeric ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()));
    expect(ids.size).toBe(200);
    expect([...ids].every((id) => /^[A-Za-z0-9]{10}$/.test(id))).toBe(true);
  });

  it('formats zod paths', () => {
    expect(formatPath(['root', 0, 'children', 2, 'style'])).toBe('root[0].children[2].style');
  });

  it('walks depth-first with paths and parents', () => {
    const seen: string[] = [];
    walk(sampleDoc().root, (node: Node, path, parent) =>
      seen.push(`${path}:${node.type}<${parent?.type ?? '-'}`),
    );
    expect(seen).toEqual([
      'root[0]:section<-',
      'root[0].children[0]:grid<section',
      'root[0].children[0].children[0]:heading<grid',
      'root[0].children[0].children[1]:text<grid',
      'root[0].children[0].children[2]:button<grid',
    ]);
  });
});

describe('docJsonSchema', () => {
  const schema = docJsonSchema();
  const json = JSON.stringify(schema);

  it('is a closed JSON Schema object for documents', () => {
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['schemaVersion', 'kind', 'meta', 'root']);
  });

  it('enumerates token references and handles the recursive node type', () => {
    expect(json).toMatch('"space.4"');
    expect(json).toMatch('"color.on-primary"');
    expect(json).toMatch('"$ref"');
  });
});
