import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildUtilityMap,
  className,
  cssForClasses,
  escapeClassName,
  generateCssVariables,
  generateUtilitiesCss,
  HIDDEN_CLASSES,
  tokens,
  utility,
  type MediaKey,
} from './index';

const repoFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const map = buildUtilityMap(tokens);
const names = Object.keys(map.rules);

describe('utility map', () => {
  it('uses Tailwind-style names with the bb: prefix', () => {
    expect(names.every((name) => name.startsWith('bb:'))).toBe(true);
    expect(map.rules['bb:py-4']).toBeDefined();
    expect(map.rules['bb:md:grid-cols-3']).toBeDefined();
    expect(map.rules['bb:lg:text-5xl']).toBeDefined();
    expect(map.rules['bb:bg-primary']).toBeDefined();
    expect(map.rules['bb:rounded-lg']).toBeDefined();
  });

  it('builds names from the same helpers styleToClasses uses', () => {
    expect(className(utility.py('4'))).toBe('bb:py-4');
    expect(className(utility.gridCols(3), 'lg')).toBe('bb:lg:grid-cols-3');
    expect(className(utility.aspect('16/9'))).toBe('bb:aspect-video');
  });

  it('emits every base utility for each breakpoint, plus visibility classes', () => {
    const base = names.filter((n) => !/^bb:(md|lg|max-md):/.test(n));
    const md = names.filter((n) => n.startsWith('bb:md:') && !n.includes('max-lg'));
    const lg = names.filter(
      (n) => n.startsWith('bb:lg:') && n !== HIDDEN_CLASSES.desktop.className,
    );
    expect(md.length).toBe(base.length);
    expect(lg.length).toBe(base.length);
    expect(names.length).toBe(base.length * 3 + 3);
  });

  it('orders rules mobile-first: base, then md, then lg, then visibility', () => {
    const rank: Record<MediaKey, number> = { '': 0, md: 1, lg: 2, 'max-md': 3, 'md-max-lg': 3 };
    const entries = Object.entries(map.rules).sort((a, b) => a[1][0] - b[1][0]);
    let last = 0;
    for (const [name, [, media]] of entries) {
      const isHidden = name.endsWith(':hidden');
      const current = isHidden ? 3 : rank[media];
      expect(current >= last, name).toBe(true);
      last = current;
    }
  });

  it('uses min-width queries for variants and exact ranges for visibility', () => {
    expect(map.media.md).toBe('(min-width: 768px)');
    expect(map.media.lg).toBe('(min-width: 1024px)');
    expect(map.media['max-md']).toBe('(max-width: 767.98px)');
    expect(map.media['md-max-lg']).toBe('(min-width: 768px) and (max-width: 1023.98px)');
    expect(map.rules['bb:md:py-4']![1]).toBe('md');
    expect(map.rules['bb:py-4']![1]).toBe('');
  });

  it('only references token variables, never raw lengths or colors', () => {
    const defined = new Set(
      [...generateCssVariables(tokens).matchAll(/(--bb-[a-z0-9-]+):/g)].map((m) => m[1]),
    );
    for (const [name, [, , css]] of Object.entries(map.rules)) {
      for (const [, variable] of css.matchAll(/var\((--bb-[a-z0-9-]+)\)/g)) {
        expect(defined.has(variable!), `${name} uses undefined ${variable}`).toBe(true);
      }
      expect(css, name).not.toMatch(/\d(rem|em)\b|#[0-9a-f]{3,8}\b/i);
    }
  });

  it('escapes selectors', () => {
    expect(escapeClassName('bb:md:aspect-4/3')).toBe('bb\\:md\\:aspect-4\\/3');
    expect(map.rules['bb:md:py-4']![2]).toBe('.bb\\:md\\:py-4{padding-block:var(--bb-space-4)}');
  });

  it('resets flow-layout child margins on flex and grid', () => {
    expect(map.rules['bb:grid']![2]).toMatch('.bb\\:grid>*{margin-block-start:0}');
  });

  it('matches the committed utilities.map.json', () => {
    expect(JSON.parse(repoFile('wp/plugin/generated/utilities.map.json'))).toEqual(map);
  });

  it('matches the committed utilities.css', () => {
    expect(repoFile('wp/plugin/generated/utilities.css')).toBe(generateUtilitiesCss(map));
  });
});

describe('cssForClasses', () => {
  it('returns only the requested rules, ignoring unknown classes', () => {
    const css = cssForClasses(map, ['bb:py-4', 'not-a-utility', 'bb:nope']);
    expect(css).toBe('.bb\\:py-4{padding-block:var(--bb-space-4)}');
  });

  it('groups by media query in cascade order regardless of input order', () => {
    const css = cssForClasses(map, ['bb:lg:py-8', 'bb:md:py-6', 'bb:py-4', 'bb:md:px-4']);
    expect(css).toBe(
      [
        '.bb\\:py-4{padding-block:var(--bb-space-4)}',
        '@media (min-width: 768px){.bb\\:md\\:px-4{padding-inline:var(--bb-space-4)}.bb\\:md\\:py-6{padding-block:var(--bb-space-6)}}',
        '@media (min-width: 1024px){.bb\\:lg\\:py-8{padding-block:var(--bb-space-8)}}',
      ].join('\n'),
    );
  });

  it('dedupes and returns an empty string for nothing', () => {
    expect(cssForClasses(map, [])).toBe('');
    expect(cssForClasses(map, ['bb:py-4', 'bb:py-4']).split('padding').length).toBe(2);
  });
});
