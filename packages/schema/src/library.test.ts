import { describe, expect, it } from 'vitest';
import { walk, type Doc } from './document';
import { PATTERNS, PATTERN_CATEGORIES, getPattern } from './library';
import { defaultRegistry } from './registry/components';
import { validateDoc } from './validate';

const docOf = (id: string): Doc => ({
  schemaVersion: 1,
  kind: 'page',
  meta: { title: 'Pattern' },
  root: getPattern(id)!.build(),
});

describe('section library', () => {
  it('has unique ids and known categories', () => {
    const ids = PATTERNS.map((pattern) => pattern.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pattern of PATTERNS) {
      expect(PATTERN_CATEGORIES).toContain(pattern.category);
      expect(pattern.label).not.toBe('');
      expect(pattern.description).not.toBe('');
    }
  });

  it.each(PATTERNS.map((pattern) => pattern.id))('%s is a valid document', (id) => {
    const result = validateDoc(docOf(id), { registry: defaultRegistry });
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('builds top-level sections', () => {
    for (const pattern of PATTERNS) {
      for (const node of pattern.build()) expect(node.type).toBe('section');
    }
  });

  it('creates new ids on every build', () => {
    const ids = (id: string) => {
      const out: string[] = [];
      walk(getPattern(id)!.build(), (node) => out.push(node.id));
      return out;
    };
    const first = ids('features-grid');
    const second = ids('features-grid');
    expect(new Set([...first, ...second]).size).toBe(first.length * 2);
  });
});
