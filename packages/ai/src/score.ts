import { walk, type Node } from '@bestenberg/schema';

/**
 * Structural similarity between an expected page and a generated one, for
 * the eval harness (PLAN.md §6): do the same components, text and number of
 * sections come back? Complements the pixel comparison, which cannot tell
 * why two pages differ.
 */

export interface StructureScore {
  /** Weighted total, 0–1. */
  score: number;
  /** Overlap of component types (counts matter). */
  components: number;
  /** Overlap of words in text content. */
  text: number;
  /** Closeness of the number of top-level sections. */
  sections: number;
}

function counts(items: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(item, (out.get(item) ?? 0) + 1);
  return out;
}

/** Sørensen–Dice overlap of two multisets: 1 = identical, 0 = nothing shared. */
export function overlap(a: Iterable<string>, b: Iterable<string>): number {
  const left = counts(a);
  const right = counts(b);
  let shared = 0;
  let total = 0;
  for (const [key, count] of left) {
    shared += Math.min(count, right.get(key) ?? 0);
    total += count;
  }
  for (const count of right.values()) total += count;
  return total === 0 ? 1 : (2 * shared) / total;
}

function types(nodes: readonly Node[]): string[] {
  const out: string[] = [];
  walk(nodes as Node[], (node) => out.push(node.type));
  return out;
}

function words(nodes: readonly Node[]): string[] {
  const out: string[] = [];
  walk(nodes as Node[], (node) => {
    for (const key of ['text', 'citation', 'alt']) {
      const value = node.props?.[key];
      if (typeof value !== 'string') continue;
      const plain = value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ')
        .toLowerCase();
      out.push(...plain.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== ''));
    }
  });
  return out;
}

export function structureScore(expected: readonly Node[], actual: readonly Node[]): StructureScore {
  const components = overlap(types(expected), types(actual));
  const text = overlap(words(expected), words(actual));
  const most = Math.max(expected.length, actual.length);
  const sections = most === 0 ? 1 : 1 - Math.abs(expected.length - actual.length) / most;
  return {
    score: 0.4 * components + 0.4 * text + 0.2 * sections,
    components,
    text,
    sections,
  };
}
