import { describe, expect, it } from 'vitest';
import {
  canContain,
  canMove,
  cloneWithNewIds,
  createHistory,
  createNode,
  defaultRegistry as registry,
  duplicateNode,
  findNode,
  getControlValue,
  insertableTypes,
  insertPlacement,
  insertNode,
  moveNode,
  pushHistory,
  redo,
  removeNode,
  replaceHistory,
  resolveControlValue,
  setControlValue,
  undo,
  updateNode,
  validateDoc,
  walk,
  type Doc,
  type Node,
} from './index';

function doc(): Doc {
  return {
    schemaVersion: 1,
    kind: 'page',
    meta: { title: 'T' },
    root: [
      {
        id: 'sec1',
        type: 'section',
        children: [
          { id: 'head1', type: 'heading', props: { text: 'A', level: 1 } },
          { id: 'para1', type: 'text', props: { text: 'B' } },
          {
            id: 'bgrp1',
            type: 'button-group',
            props: {},
            children: [{ id: 'btn1', type: 'button', props: { text: 'Go' } }],
          },
        ],
      },
      {
        id: 'sec2',
        type: 'section',
        children: [{ id: 'para2', type: 'text', props: { text: 'C' } }],
      },
    ],
  };
}

const order = (d: Doc) => {
  const out: string[] = [];
  walk(d.root, (node, _path, parent) => out.push(`${parent?.id ?? '-'}>${node.id}`));
  return out;
};
const valid = (d: Doc) => validateDoc(d, { registry }).ok;

describe('findNode / updateNode / removeNode', () => {
  it('locates nodes with parent, index and ancestors', () => {
    const found = findNode(doc().root, 'btn1')!;
    expect(found.parent!.id).toBe('bgrp1');
    expect(found.index).toBe(0);
    expect(found.ancestors).toEqual(['sec1', 'bgrp1']);
    expect(findNode(doc().root, 'nope')).toBeNull();
  });

  it('updates immutably and shares untouched branches', () => {
    const before = doc();
    const after = updateNode(before, 'para1', (node) => ({ ...node, props: { text: 'Z' } }));
    expect(findNode(after.root, 'para1')!.node.props).toEqual({ text: 'Z' });
    expect(findNode(before.root, 'para1')!.node.props).toEqual({ text: 'B' });
    expect(after.root[1]).toBe(before.root[1]);
    expect(updateNode(before, 'nope', (n) => n)).toBe(before);
  });

  it('removes subtrees and drops empty children arrays', () => {
    const after = removeNode(removeNode(doc(), 'bgrp1'), 'para2');
    expect(order(after)).toEqual(['->sec1', 'sec1>head1', 'sec1>para1', '->sec2']);
    expect('children' in after.root[1]!).toBe(false);
  });
});

describe('nesting rules', () => {
  it('follows allowedChildren and allowedParents', () => {
    expect(canContain(registry, 'section', 'heading')).toBe(true);
    expect(canContain(registry, 'heading', 'text')).toBe(false);
    expect(canContain(registry, 'section', 'button')).toBe(false);
    expect(canContain(registry, 'button-group', 'button')).toBe(true);
    expect(canContain(registry, 'button-group', 'text')).toBe(false);
    expect(canContain(registry, null, 'section')).toBe(true);
    expect(canContain(registry, null, 'list-item')).toBe(false);
    expect(canContain(registry, 'quote', 'raw')).toBe(true);
  });

  it('lists insertable types without internal components', () => {
    expect(insertableTypes(registry, 'list')).toEqual(['list-item']);
    expect(insertableTypes(registry, 'section')).not.toContain('raw');
    expect(insertableTypes(registry, 'section')).not.toContain('button');
    expect(insertableTypes(registry, null)).toContain('section');
  });
});

describe('createNode / insertNode', () => {
  it('creates valid nodes with defaults for every component', () => {
    for (const def of registry.list().filter((d) => !d.internal)) {
      const node = createNode(registry, def.type);
      const parentType = def.allowedParents?.[0] ?? 'section';
      const parent: Node = { ...createNode(registry, parentType), children: [node] };
      const wrapper: Node =
        parentType === 'section' ? parent : { id: 'wrap0001', type: 'section', children: [parent] };
      const result = validateDoc(
        { schemaVersion: 1, kind: 'page', meta: { title: 'T' }, root: [wrapper] },
        { registry },
      );
      expect(result.ok, `${def.type}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it('creates required children', () => {
    expect(createNode(registry, 'list').children!.map((c) => c.type)).toEqual(['list-item']);
    expect(createNode(registry, 'button-group').children![0]!.props).toEqual({
      text: 'Button',
      variant: 'primary',
    });
    expect(() => createNode(registry, 'raw')).toThrow('Cannot create');
  });

  it('inserts at an index and enforces nesting', () => {
    const node = createNode(registry, 'text');
    const after = insertNode(doc(), registry, 'sec1', 1, node);
    expect(order(after).slice(0, 4)).toEqual([
      '->sec1',
      'sec1>head1',
      `sec1>${node.id}`,
      'sec1>para1',
    ]);
    expect(
      insertNode(doc(), registry, null, 99, createNode(registry, 'section')).root,
    ).toHaveLength(3);
    expect(() => insertNode(doc(), registry, 'head1', 0, node)).toThrow('cannot be placed');
    expect(() => insertNode(doc(), registry, 'sec1', 0, createNode(registry, 'button'))).toThrow();
    expect(() => insertNode(doc(), registry, 'nope', 0, node)).toThrow('Unknown parent');
  });
});

describe('insertPlacement', () => {
  it('goes inside a selected container', () => {
    expect(insertPlacement(doc(), registry, 'sec1', 'text')).toEqual({
      parentId: 'sec1',
      index: 3,
    });
    expect(insertPlacement(doc(), registry, 'bgrp1', 'button')).toEqual({
      parentId: 'bgrp1',
      index: 1,
    });
  });

  it('goes after the selection when the selection cannot contain it', () => {
    expect(insertPlacement(doc(), registry, 'head1', 'text')).toEqual({
      parentId: 'sec1',
      index: 1,
    });
    expect(insertPlacement(doc(), registry, 'btn1', 'button')).toEqual({
      parentId: 'bgrp1',
      index: 1,
    });
    // A heading cannot sit in a button group: it lands after the group.
    expect(insertPlacement(doc(), registry, 'btn1', 'heading')).toEqual({
      parentId: 'sec1',
      index: 3,
    });
  });

  it('falls back to the end of the page, or nowhere', () => {
    expect(insertPlacement(doc(), registry, null, 'section')).toEqual({ parentId: null, index: 2 });
    expect(insertPlacement(doc(), registry, null, 'button')).toBeNull();
    expect(insertPlacement(doc(), registry, 'head1', 'list-item')).toBeNull();
  });
});

describe('moveNode', () => {
  it('reorders within a parent (index counted before the move)', () => {
    expect(order(moveNode(doc(), registry, 'head1', 'sec1', 3)).slice(1, 4)).toEqual([
      'sec1>para1',
      'sec1>bgrp1',
      'bgrp1>btn1',
    ]);
    expect(order(moveNode(doc(), registry, 'bgrp1', 'sec1', 0))[1]).toBe('sec1>bgrp1');
  });

  it('moves between parents and to the top level', () => {
    const moved = moveNode(doc(), registry, 'para1', 'sec2', 0);
    expect(order(moved)).toEqual([
      '->sec1',
      'sec1>head1',
      'sec1>bgrp1',
      'bgrp1>btn1',
      '->sec2',
      'sec2>para1',
      'sec2>para2',
    ]);
    expect(order(moveNode(doc(), registry, 'sec2', null, 0))[0]).toBe('->sec2');
    expect(valid(moved)).toBe(true);
  });

  it('refuses invalid moves and no-ops', () => {
    const d = doc();
    expect(moveNode(d, registry, 'sec1', 'bgrp1', 0)).toBe(d);
    expect(moveNode(d, registry, 'sec1', 'sec1', 0)).toBe(d);
    expect(moveNode(d, registry, 'btn1', 'sec2', 0)).toBe(d);
    expect(moveNode(d, registry, 'head1', 'sec1', 0)).toBe(d);
    expect(moveNode(d, registry, 'head1', 'sec1', 1)).toBe(d);
    expect(canMove(d, registry, 'sec1', 'para1')).toBe(false);
    expect(canMove(d, registry, 'para1', 'sec2')).toBe(true);
  });
});

describe('duplicateNode', () => {
  it('copies a subtree with new ids right after the original', () => {
    const { doc: after, id } = duplicateNode(doc(), 'bgrp1');
    const copy = findNode(after.root, id!)!;
    expect(copy.index).toBe(3);
    expect(copy.node.children![0]!.id).not.toBe('btn1');
    expect(copy.node.children![0]!.props).toEqual({ text: 'Go' });
    expect(valid(after)).toBe(true);
    expect(duplicateNode(doc(), 'nope').id).toBeNull();
  });

  it('gives raw copies a distinct valid id', () => {
    const raw: Node = {
      id: 'rawabc',
      type: 'raw',
      props: { name: 'x/y', markup: '<!-- wp:x/y /-->' },
    };
    expect(cloneWithNewIds(raw).id).toMatch(/^rawabc-[A-Za-z0-9]{4}$/);
  });
});

describe('control values', () => {
  const padding = { path: 'style.padding.y', responsive: true };
  const color = { path: 'style.color' };
  const level = { path: 'props.level' };

  it('writes responsive styles to the given breakpoint', () => {
    let node: Node = { id: 'n', type: 'section' };
    node = setControlValue(node, padding, 'space.8', 'base');
    node = setControlValue(node, padding, 'space.16', 'desktop');
    expect(node.style).toEqual({
      base: { padding: { y: 'space.8' } },
      desktop: { padding: { y: 'space.16' } },
    });
    expect(getControlValue(node, padding, 'tablet')).toBeUndefined();
    expect(resolveControlValue(node, padding, 'tablet')).toEqual({
      value: 'space.8',
      from: 'base',
    });
    expect(resolveControlValue(node, padding, 'desktop')).toEqual({
      value: 'space.16',
      from: 'desktop',
    });
  });

  it('writes non-responsive styles to base whatever the breakpoint', () => {
    const node = setControlValue({ id: 'n', type: 'text' }, color, 'color.muted', 'desktop');
    expect(node.style).toEqual({ base: { color: 'color.muted' } });
    expect(resolveControlValue(node, color, 'desktop')).toEqual({
      value: 'color.muted',
      from: 'base',
    });
  });

  it('keeps an empty base when only an override exists, and prunes when cleared', () => {
    let node = setControlValue({ id: 'n', type: 'section' } as Node, padding, 'space.4', 'tablet');
    expect(node.style).toEqual({ base: {}, tablet: { padding: { y: 'space.4' } } });
    node = setControlValue(node, padding, undefined, 'tablet');
    expect('style' in node).toBe(false);
  });

  it('prunes only what became empty', () => {
    let node: Node = {
      id: 'n',
      type: 'section',
      style: { base: { padding: { x: 'space.2', y: 'space.4' }, color: 'color.muted' } },
    };
    node = setControlValue(node, padding, undefined, 'base');
    expect(node.style).toEqual({ base: { padding: { x: 'space.2' }, color: 'color.muted' } });
  });

  it('writes props and keeps props present when emptied', () => {
    let node: Node = { id: 'n', type: 'heading', props: { text: 'A', level: 2 } };
    node = setControlValue(node, level, 3);
    expect(node.props).toEqual({ text: 'A', level: 3 });
    node = setControlValue(
      setControlValue(node, level, undefined),
      { path: 'props.text' },
      undefined,
    );
    expect(node.props).toEqual({});
  });

  it('writes visibility and removes it when empty', () => {
    let node = setControlValue({ id: 'n', type: 'text' } as Node, { path: 'hidden.desktop' }, true);
    expect(node.hidden).toEqual({ desktop: true });
    node = setControlValue(node, { path: 'hidden.desktop' }, undefined);
    expect('hidden' in node).toBe(false);
  });

  it('does not mutate the input', () => {
    const node: Node = { id: 'n', type: 'section', style: { base: { padding: { y: 'space.4' } } } };
    setControlValue(node, padding, 'space.8', 'base');
    expect(node.style!.base.padding!.y).toBe('space.4');
  });
});

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory('a');
    h = pushHistory(pushHistory(h, 'b'), 'c');
    expect(pushHistory(h, 'c')).toBe(h);
    h = undo(h);
    expect(h.present).toBe('b');
    h = redo(h);
    expect(h.present).toBe('c');
    expect(redo(h)).toBe(h);
    h = undo(undo(h));
    expect(undo(h)).toBe(h);
    h = pushHistory(h, 'x');
    expect(h.future).toEqual([]);
  });

  it('replaces the present without a new undo step', () => {
    const h = replaceHistory(pushHistory(createHistory('a'), 'b'), 'b2');
    expect(h.past).toEqual(['a']);
    expect(undo(h).present).toBe('a');
  });
});
