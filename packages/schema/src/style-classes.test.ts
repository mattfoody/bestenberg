import { buildUtilityMap, HIDDEN_CLASSES, tokens } from '@bestenberg/tokens';
import { describe, expect, it } from 'vitest';
import {
  componentClasses,
  defaultRegistry,
  nodeClasses,
  sampleStyles,
  STYLE_KEYS,
  styleToClasses,
  visibilityClasses,
} from './index';

const map = buildUtilityMap(tokens);
const everyStyleValue = sampleStyles;

describe('styleToClasses', () => {
  it('maps a responsive style mobile-first', () => {
    expect(
      styleToClasses({
        base: {
          layout: { display: 'grid', columns: 1, gap: 'space.6' },
          padding: { y: 'space.8' },
        },
        tablet: { layout: { columns: 2 } },
        desktop: { layout: { columns: 3 }, padding: { y: 'space.16' } },
      }),
    ).toEqual([
      'bb:grid',
      'bb:grid-cols-1',
      'bb:gap-6',
      'bb:py-8',
      'bb:md:grid-cols-2',
      'bb:lg:grid-cols-3',
      'bb:lg:py-16',
    ]);
  });

  it('expands stack and row into flex utilities', () => {
    expect(styleToClasses({ base: { layout: { display: 'stack' } } })).toEqual([
      'bb:flex',
      'bb:flex-col',
    ]);
    expect(
      styleToClasses({ base: {}, desktop: { layout: { display: 'row', wrap: true } } }),
    ).toEqual(['bb:lg:flex', 'bb:lg:flex-row', 'bb:lg:flex-wrap']);
  });

  it('maps backgrounds, typography and effects', () => {
    expect(
      styleToClasses({
        base: {
          background: { image: { url: '/hero.jpg' }, overlay: 'color.on-surface' },
          color: 'color.on-primary',
          font: { size: 'fontSize.5xl', weight: 'fontWeight.bold', align: 'center' },
          radius: 'radius.lg',
          border: { width: 1, color: 'color.border' },
          aspect: '16/9',
          width: 'container.lg',
        },
      }),
    ).toEqual([
      'bb:container-lg',
      'bb:bg-cover',
      'bb:overlay-on-surface',
      'bb:text-on-primary',
      'bb:text-5xl',
      'bb:font-bold',
      'bb:text-center',
      'bb:rounded-lg',
      'bb:border-1',
      'bb:border-border',
      'bb:aspect-video',
    ]);
  });

  it('returns nothing for no style', () => {
    expect(styleToClasses(undefined)).toEqual([]);
    expect(styleToClasses({ base: {} })).toEqual([]);
  });

  it('only produces classes that exist in the utility map, at every breakpoint', () => {
    for (const style of everyStyleValue()) {
      for (const classes of [
        styleToClasses({ base: style }),
        styleToClasses({ base: {}, tablet: style }),
        styleToClasses({ base: {}, desktop: style }),
      ]) {
        expect(classes.length > 0, JSON.stringify(style)).toBe(true);
        for (const name of classes) {
          expect(map.rules[name] !== undefined, `${name} from ${JSON.stringify(style)}`).toBe(true);
        }
      }
    }
  });

  it('can reach every utility class from some style (every style key covered)', () => {
    const produced = new Set<string>();
    for (const style of everyStyleValue()) {
      for (const bp of ['base', 'tablet', 'desktop'] as const) {
        styleToClasses({ base: {}, [bp]: style }).forEach((c) => produced.add(c));
      }
    }
    visibilityClasses({ base: true, tablet: true, desktop: true }).forEach((c) => produced.add(c));
    const unreachable = Object.keys(map.rules).filter((name) => !produced.has(name));
    expect(unreachable).toEqual([]);
  });

  it('covers every style key', () => {
    const used = new Set(everyStyleValue().flatMap((style) => Object.keys(style)));
    expect([...used].sort()).toEqual([...STYLE_KEYS].sort());
  });
});

describe('visibility', () => {
  it('uses exact breakpoint ranges', () => {
    expect(visibilityClasses({ base: true, desktop: true })).toEqual([
      HIDDEN_CLASSES.base.className,
      HIDDEN_CLASSES.desktop.className,
    ]);
    expect(visibilityClasses({ tablet: false })).toEqual([]);
  });

  it('combines with style classes without duplicates', () => {
    expect(
      nodeClasses({
        style: { base: { padding: { y: 'space.4' } }, tablet: { padding: { y: 'space.4' } } },
        hidden: { tablet: true },
      }),
    ).toEqual(['bb:py-4', 'bb:md:py-4', 'bb:md:max-lg:hidden']);
  });
});

describe('componentClasses', () => {
  it('puts element classes first and removes duplicates', () => {
    expect(
      componentClasses(defaultRegistry.get('stack')!, {
        style: { base: { layout: { display: 'stack', gap: 'space.4' } } },
        hidden: { desktop: true },
      }),
    ).toEqual(['bb-stack', 'bb:flex', 'bb:flex-col', 'bb:gap-4', 'bb:lg:hidden']);
  });

  it('uses only utilities that exist for element classes', () => {
    for (const def of defaultRegistry.list()) {
      for (const name of def.element?.classes ?? []) {
        if (name.startsWith('bb:')) expect(map.rules[name] !== undefined, name).toBe(true);
      }
    }
  });

  it('maps height for spacers', () => {
    expect(
      componentClasses(defaultRegistry.get('spacer')!, {
        style: { base: { height: 'space.8' }, desktop: { height: 'space.16' } },
      }),
    ).toEqual(['bb-spacer', 'bb:h-8', 'bb:lg:h-16']);
  });
});
