import {
  ALIGN,
  ASPECTS,
  BORDER_WIDTHS,
  buildUtilityMap,
  COLOR_NAMES,
  CONTAINER_NAMES,
  FONT_FAMILY_NAMES,
  FONT_SIZE_NAMES,
  FONT_WEIGHT_NAMES,
  GRID_COLUMNS,
  HIDDEN_CLASSES,
  JUSTIFY,
  LINE_HEIGHT_NAMES,
  RADIUS_NAMES,
  SHADOW_NAMES,
  SPACE_NAMES,
  TEXT_ALIGN,
  tokens,
} from '@bestenberg/tokens';
import { describe, expect, it } from 'vitest';
import {
  nodeClasses,
  STYLE_KEYS,
  StyleSchema,
  styleToClasses,
  visibilityClasses,
  type Style,
} from './index';

const map = buildUtilityMap(tokens);
const ref = (category: string, names: readonly string[]) => names.map((n) => `${category}.${n}`);

/** One single-property style per possible value of every style field. */
function everyStyleValue(): Style[] {
  const colors = ref('color', COLOR_NAMES);
  const space = ref('space', SPACE_NAMES);
  const raw: unknown[] = [
    ...['stack', 'row', 'grid'].map((display) => ({ layout: { display } })),
    ...GRID_COLUMNS.map((columns) => ({ layout: { columns } })),
    ...space.map((gap) => ({ layout: { gap } })),
    ...Object.keys(ALIGN).map((align) => ({ layout: { align } })),
    ...Object.keys(JUSTIFY).map((justify) => ({ layout: { justify } })),
    ...[true, false].map((wrap) => ({ layout: { wrap } })),
    ...space.flatMap((s) => [{ padding: { x: s } }, { padding: { y: s } }]),
    ...space.flatMap((s) => [{ margin: { top: s } }, { margin: { bottom: s } }]),
    ...['auto', 'full', ...ref('container', CONTAINER_NAMES)].map((width) => ({ width })),
    ...colors.map((background) => ({ background })),
    ...colors.map((overlay) => ({ background: { image: { url: '/a.jpg' }, overlay } })),
    ...colors.map((color) => ({ color })),
    ...ref('fontFamily', FONT_FAMILY_NAMES).map((family) => ({ font: { family } })),
    ...ref('fontSize', FONT_SIZE_NAMES).map((size) => ({ font: { size } })),
    ...ref('fontWeight', FONT_WEIGHT_NAMES).map((weight) => ({ font: { weight } })),
    ...ref('lineHeight', LINE_HEIGHT_NAMES).map((lineHeight) => ({ font: { lineHeight } })),
    ...TEXT_ALIGN.map((align) => ({ font: { align } })),
    ...ref('radius', RADIUS_NAMES).map((radius) => ({ radius })),
    ...ref('shadow', SHADOW_NAMES).map((shadow) => ({ shadow })),
    ...BORDER_WIDTHS.map((width) => ({ border: { width } })),
    ...colors.map((color) => ({ border: { color } })),
    ...Object.keys(ASPECTS).map((aspect) => ({ aspect })),
  ];
  return raw.map((style) => StyleSchema.parse(style));
}

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
