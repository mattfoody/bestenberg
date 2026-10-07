import { describe, expect, it } from 'vitest';
import tokensJson from './tokens.json';
import { loadTokens, TOKEN_CATEGORIES, TokenError } from './load';

function clone(): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(tokensJson));
}

function issuesFor(raw: unknown): string[] {
  try {
    loadTokens(raw);
  } catch (error) {
    if (error instanceof TokenError) return error.issues;
    throw error;
  }
  return [];
}

describe('loadTokens', () => {
  it('loads the default token set', () => {
    const tokens = loadTokens(tokensJson);
    for (const category of TOKEN_CATEGORIES) {
      expect(Object.keys(tokens[category]).length).toBeGreaterThan(0);
    }
    expect(tokens.color.primary).toBe('#1d4ed8');
    expect(tokens.fontSize.base).toEqual({ min: '1rem', max: '1.0625rem' });
    expect(tokens.breakpoint).toEqual({ md: '768px', lg: '1024px' });
  });

  it('keeps the space scale in numeric order', () => {
    expect(Object.keys(loadTokens(tokensJson).space)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '8',
      '10',
      '12',
      '16',
      '20',
      '24',
    ]);
  });

  it('ignores $-prefixed metadata keys', () => {
    expect(Object.keys(loadTokens(tokensJson).color)).not.toContain('$type');
  });

  it('rejects invalid values with a path', () => {
    const raw = clone();
    raw.color!.primary = { $value: 'blue' };
    expect(issuesFor(raw).join('\n')).toMatch(/^color\.primary:/);
  });

  it('rejects bad names, missing values and wrong $type', () => {
    const raw = clone();
    raw.space!['Big'] = { $value: '1rem' };
    raw.radius!.md = { value: '1rem' };
    raw.shadow!.$type = 'color';
    const issues = issuesFor(raw).join('\n');
    expect(issues).toMatch('space.Big: name must match');
    expect(issues).toMatch('radius.md: missing $value');
    expect(issues).toMatch('shadow: $type must be "shadow"');
  });

  it('requires md and lg breakpoints in ascending order', () => {
    const raw = clone();
    raw.breakpoint!.md = { $value: '1200px' };
    expect(issuesFor(raw).join('\n')).toMatch('md must be smaller than lg');

    const missing = clone();
    delete missing.breakpoint!.lg;
    expect(issuesFor(missing).join('\n')).toMatch('exactly "md" then "lg"');
  });

  it('rejects names that would make utility classes ambiguous', () => {
    const raw = clone();
    raw.color!.xl = { $value: '#000000' }; // text-xl: color vs font size
    raw.color!['1'] = { $value: '#000000' }; // border-1: color vs width
    raw.fontWeight!.sans = { $value: 400 }; // font-sans: family vs weight
    const issues = issuesFor(raw).join('\n');
    expect(issues).toMatch('"text-xl" would be ambiguous');
    expect(issues).toMatch('"border-1" would be ambiguous');
    expect(issues).toMatch('"font-sans" would be ambiguous');
  });

  it('reports every problem at once', () => {
    const raw = clone();
    raw.color!.primary = { $value: 'nope' };
    raw.space!['4'] = { $value: 'big' };
    expect(issuesFor(raw).length).toBeGreaterThan(1);
  });

  it('rejects a non-object document', () => {
    expect(() => loadTokens(null)).toThrow(TokenError);
  });
});
