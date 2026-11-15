import { describe, expect, it } from 'vitest';
import type { Doc, Node } from './document';
import { clientPermissions, effectiveLock, isClientControl, nodePath } from './lock';
import { defaultRegistry } from './registry/components';

const node = (id: string, locked?: Node['locked'], children?: Node[]): Node => ({
  id,
  type: 'stack',
  props: {},
  ...(locked ? { locked } : {}),
  ...(children ? { children } : {}),
});

const doc = (root: Node[]): Doc => ({ schemaVersion: 1, kind: 'page', meta: { title: 'T' }, root });

describe('client mode locks', () => {
  const sample = doc([
    node('free', 'none', [node('card1', undefined, [node('title1')]), node('card2', 'all')]),
    node('legal', 'all', [node('inner', undefined, [node('deep')]), node('reopened', 'content')]),
    node('plain', undefined, [node('child')]),
  ]);

  it('finds the path to a node', () => {
    expect(nodePath(sample.root, 'title1').map((n) => n.id)).toEqual(['free', 'card1', 'title1']);
    expect(nodePath(sample.root, 'missing')).toEqual([]);
  });

  it('defaults to content-only editing', () => {
    expect(effectiveLock(sample, 'plain')).toBe('content');
    expect(clientPermissions(sample, 'plain')).toEqual({ content: true, arrange: false });
    expect(clientPermissions(sample, 'child')).toEqual({ content: true, arrange: false });
  });

  it('lets direct children of an open node be arranged, but not deeper ones', () => {
    expect(clientPermissions(sample, 'card1')).toEqual({ content: true, arrange: true });
    expect(clientPermissions(sample, 'title1')).toEqual({ content: true, arrange: false });
    expect(clientPermissions(sample, 'free')).toEqual({ content: true, arrange: false });
  });

  it('locks a node and everything inside it completely', () => {
    expect(clientPermissions(sample, 'legal')).toEqual({ content: false, arrange: false });
    expect(clientPermissions(sample, 'deep')).toEqual({ content: false, arrange: false });
    expect(clientPermissions(sample, 'card2')).toEqual({ content: false, arrange: false });
  });

  it('lets a nearer setting reopen content', () => {
    expect(effectiveLock(sample, 'reopened')).toBe('content');
    expect(clientPermissions(sample, 'reopened').content).toBe(true);
  });

  it('allows nothing for unknown nodes', () => {
    expect(clientPermissions(sample, 'missing')).toEqual({ content: false, arrange: false });
  });

  it('offers clients wording, pictures and links only', () => {
    const offered = (type: string) =>
      defaultRegistry
        .get(type)!
        .controls.filter(isClientControl)
        .map((control) => control.id);
    expect(offered('image')).toEqual(['src', 'alt']);
    expect(offered('button')).toEqual(['text', 'href', 'target']);
    expect(offered('heading')).toEqual(['text']);
    expect(offered('section')).toEqual([]);
    expect(offered('list')).toEqual([]);
  });
});
