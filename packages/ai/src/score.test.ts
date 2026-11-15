import { describe, expect, it } from 'vitest';
import { getPattern } from '@bestenberg/schema';
import { overlap, structureScore } from './score';

const build = (id: string) => getPattern(id)!.build();

describe('overlap', () => {
  it('compares multisets', () => {
    expect(overlap(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(overlap(['a', 'a'], ['a'])).toBe(2 / 3);
    expect(overlap(['a'], ['b'])).toBe(0);
    expect(overlap([], [])).toBe(1);
  });
});

describe('structureScore', () => {
  it('is 1 for the same page built twice (ids differ)', () => {
    expect(structureScore(build('features-grid'), build('features-grid')).score).toBe(1);
  });

  it('drops when a section is missing', () => {
    const expected = [...build('hero-centered'), ...build('pricing-three')];
    const result = structureScore(expected, build('hero-centered'));
    expect(result.sections).toBe(0.5);
    expect(result.score).toBeLessThan(0.7);
  });

  it('drops when the text is different', () => {
    const actual = build('hero-centered');
    actual[0]!.children![0]!.children![0]!.props = { text: 'Completely unrelated words', level: 1 };
    const result = structureScore(build('hero-centered'), actual);
    expect(result.components).toBe(1);
    expect(result.text).toBeLessThan(1);
    expect(result.score).toBeLessThan(1);
  });

  it('is low for unrelated pages', () => {
    expect(structureScore(build('pricing-three'), build('content-text')).score).toBeLessThan(0.6);
  });
});
