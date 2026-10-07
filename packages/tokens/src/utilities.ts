import { cssVar } from './css-variables';
import type { Tokens } from './load';

/**
 * Utility catalogue (SCHEMA.md §6). Tailwind-style names with a `bb:` prefix,
 * mobile-first variants `md:` (tablet) and `lg:` (desktop), token values only.
 *
 * This module is the single source for utility names: the CSS generator
 * enumerates it, and styleToClasses (in @bestenberg/schema) builds names with
 * the same `utility` helpers.
 */

export const UTILITY_PREFIX = 'bb' as const;

/** Responsive variants. `base` (mobile) has no variant. */
export const VARIANTS = ['md', 'lg'] as const;
export type Variant = (typeof VARIANTS)[number];

/** Media buckets, in cascade order. '' is unconditional. */
export const MEDIA_KEYS = ['', 'md', 'lg', 'max-md', 'md-max-lg'] as const;
export type MediaKey = (typeof MEDIA_KEYS)[number];

export const GRID_COLUMNS = [1, 2, 3, 4, 5, 6, 12] as const;
export type GridColumns = (typeof GRID_COLUMNS)[number];

export const ALIGN = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
} as const;
export type Align = keyof typeof ALIGN;

export const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
} as const;
export type Justify = keyof typeof JUSTIFY;

export const TEXT_ALIGN = ['start', 'center', 'end'] as const;
export type TextAlign = (typeof TEXT_ALIGN)[number];

export const BORDER_WIDTHS = [0, 1, 2] as const;
export type BorderWidth = (typeof BORDER_WIDTHS)[number];

export const ASPECTS = {
  auto: { name: 'aspect-auto', value: 'auto' },
  '1/1': { name: 'aspect-square', value: '1 / 1' },
  '16/9': { name: 'aspect-video', value: '16 / 9' },
  '4/3': { name: 'aspect-4/3', value: '4 / 3' },
  '3/4': { name: 'aspect-3/4', value: '3 / 4' },
} as const;
export type Aspect = keyof typeof ASPECTS;

/** Utility base names (no prefix, no variant). */
export const utility = {
  flex: 'flex',
  flexCol: 'flex-col',
  flexRow: 'flex-row',
  grid: 'grid',
  gridCols: (n: GridColumns) => `grid-cols-${n}`,
  gap: (space: string) => `gap-${space}`,
  items: (align: Align) => `items-${align}`,
  justify: (justify: Justify) => `justify-${justify}`,
  wrap: (wrap: boolean) => (wrap ? 'flex-wrap' : 'flex-nowrap'),
  px: (space: string) => `px-${space}`,
  py: (space: string) => `py-${space}`,
  mt: (space: string) => `mt-${space}`,
  mb: (space: string) => `mb-${space}`,
  wAuto: 'w-auto',
  wFull: 'w-full',
  container: (name: string) => `container-${name}`,
  bg: (color: string) => `bg-${color}`,
  bgCover: 'bg-cover',
  overlay: (color: string) => `overlay-${color}`,
  text: (color: string) => `text-${color}`,
  textSize: (size: string) => `text-${size}`,
  textAlign: (align: TextAlign) => `text-${align}`,
  font: (family: string) => `font-${family}`,
  fontWeight: (weight: string) => `font-${weight}`,
  leading: (lineHeight: string) => `leading-${lineHeight}`,
  rounded: (radius: string) => `rounded-${radius}`,
  shadow: (shadow: string) => `shadow-${shadow}`,
  border: (width: BorderWidth) => `border-${width}`,
  borderColor: (color: string) => `border-${color}`,
  aspect: (aspect: Aspect) => ASPECTS[aspect].name,
} as const;

/** Full class name: `bb:py-4`, `bb:md:py-4`. */
export function className(base: string, variant?: Variant): string {
  return `${UTILITY_PREFIX}:${variant ? `${variant}:` : ''}${base}`;
}

/** Per-breakpoint visibility classes (exact ranges, not cascading). */
export const HIDDEN_CLASSES = {
  base: { className: `${UTILITY_PREFIX}:max-md:hidden`, media: 'max-md' },
  tablet: { className: `${UTILITY_PREFIX}:md:max-lg:hidden`, media: 'md-max-lg' },
  desktop: { className: `${UTILITY_PREFIX}:lg:hidden`, media: 'lg' },
} as const satisfies Record<string, { className: string; media: MediaKey }>;

/** Escapes a class name for use in a CSS selector. */
export function escapeClassName(name: string): string {
  return name.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

type Rule = (selector: string) => string;
const decl =
  (declarations: string): Rule =>
  (selector) =>
    `${selector}{${declarations}}`;

/**
 * Every utility as [base name, rule builder], in cascade order. Layout comes
 * first so later utilities (e.g. margins) win over its child resets.
 */
function catalogue(tokens: Tokens): Array<[string, Rule]> {
  const space = Object.keys(tokens.space);
  const colors = Object.keys(tokens.color);
  const list: Array<[string, Rule]> = [];
  const add = (name: string, rule: Rule) => list.push([name, rule]);

  // Layout. Children of flex/grid lose WordPress flow-layout margins; spacing comes from gap.
  const display =
    (value: string): Rule =>
    (s) =>
      `${s}{display:${value}}${s}>*{margin-block-start:0}`;
  add(utility.flex, display('flex'));
  add(utility.grid, display('grid'));
  add(utility.flexCol, decl('flex-direction:column'));
  add(utility.flexRow, decl('flex-direction:row'));
  add(utility.wrap(true), decl('flex-wrap:wrap'));
  add(utility.wrap(false), decl('flex-wrap:nowrap'));
  for (const n of GRID_COLUMNS) {
    add(utility.gridCols(n), decl(`grid-template-columns:repeat(${n},minmax(0,1fr))`));
  }
  for (const [name, value] of Object.entries(ALIGN)) {
    add(utility.items(name as Align), decl(`align-items:${value}`));
  }
  for (const [name, value] of Object.entries(JUSTIFY)) {
    add(utility.justify(name as Justify), decl(`justify-content:${value}`));
  }
  for (const s of space) add(utility.gap(s), decl(`gap:${cssVar('space', s)}`));

  // Sizing.
  add(utility.wAuto, decl('width:auto'));
  add(utility.wFull, decl('width:100%'));
  for (const c of Object.keys(tokens.container)) {
    add(
      utility.container(c),
      decl(`width:100%;max-width:${cssVar('container', c)};margin-inline:auto`),
    );
  }

  // Spacing.
  for (const s of space) add(utility.px(s), decl(`padding-inline:${cssVar('space', s)}`));
  for (const s of space) add(utility.py(s), decl(`padding-block:${cssVar('space', s)}`));
  for (const s of space) add(utility.mt(s), decl(`margin-block-start:${cssVar('space', s)}`));
  for (const s of space) add(utility.mb(s), decl(`margin-block-end:${cssVar('space', s)}`));

  // Color.
  for (const c of colors) add(utility.bg(c), decl(`background-color:${cssVar('color', c)}`));
  add(
    utility.bgCover,
    decl('background-size:cover;background-position:center;background-repeat:no-repeat'),
  );
  for (const c of colors) {
    add(
      utility.overlay(c),
      (s) =>
        `${s}{position:relative;isolation:isolate}` +
        `${s}::before{content:"";position:absolute;inset:0;z-index:-1;background-color:${cssVar('color', c)};opacity:.6}`,
    );
  }
  for (const c of colors) add(utility.text(c), decl(`color:${cssVar('color', c)}`));

  // Typography.
  for (const f of Object.keys(tokens.fontFamily)) {
    add(utility.font(f), decl(`font-family:${cssVar('fontFamily', f)}`));
  }
  for (const size of Object.keys(tokens.fontSize)) {
    add(utility.textSize(size), decl(`font-size:${cssVar('fontSize', size)}`));
  }
  for (const w of Object.keys(tokens.fontWeight)) {
    add(utility.fontWeight(w), decl(`font-weight:${cssVar('fontWeight', w)}`));
  }
  for (const lh of Object.keys(tokens.lineHeight)) {
    add(utility.leading(lh), decl(`line-height:${cssVar('lineHeight', lh)}`));
  }
  for (const a of TEXT_ALIGN) add(utility.textAlign(a), decl(`text-align:${a}`));

  // Effects.
  for (const r of Object.keys(tokens.radius)) {
    add(utility.rounded(r), decl(`border-radius:${cssVar('radius', r)}`));
  }
  for (const sh of Object.keys(tokens.shadow)) {
    add(utility.shadow(sh), decl(`box-shadow:${cssVar('shadow', sh)}`));
  }
  for (const w of BORDER_WIDTHS) {
    add(
      utility.border(w),
      decl(w === 0 ? 'border-width:0' : `border-width:${w}px;border-style:solid`),
    );
  }
  for (const c of colors) add(utility.borderColor(c), decl(`border-color:${cssVar('color', c)}`));
  for (const aspect of Object.keys(ASPECTS) as Aspect[]) {
    add(utility.aspect(aspect), decl(`aspect-ratio:${ASPECTS[aspect].value}`));
  }

  return list;
}

/** [order, media key, CSS] per class. */
export type UtilityRuleEntry = [order: number, media: MediaKey, css: string];

export interface UtilityMap {
  version: 1;
  prefix: typeof UTILITY_PREFIX;
  /** Media queries for each non-empty media key. */
  media: Record<Exclude<MediaKey, ''>, string>;
  rules: Record<string, UtilityRuleEntry>;
}

function pxBelow(value: string): string {
  return `${parseFloat(value) - 0.02}px`;
}

/** Builds the full class → rule map for the given tokens. */
export function buildUtilityMap(tokens: Tokens): UtilityMap {
  const md = tokens.breakpoint.md!;
  const lg = tokens.breakpoint.lg!;
  const media: UtilityMap['media'] = {
    md: `(min-width: ${md})`,
    lg: `(min-width: ${lg})`,
    'max-md': `(max-width: ${pxBelow(md)})`,
    'md-max-lg': `(min-width: ${md}) and (max-width: ${pxBelow(lg)})`,
  };

  const rules: Record<string, UtilityRuleEntry> = {};
  let order = 0;
  const entries = catalogue(tokens);

  for (const variant of [undefined, ...VARIANTS] as const) {
    for (const [base, rule] of entries) {
      const name = className(base, variant);
      if (name in rules) throw new Error(`Duplicate utility class "${name}"`);
      rules[name] = [order++, variant ?? '', rule(`.${escapeClassName(name)}`)];
    }
  }

  for (const { className: name, media: key } of Object.values(HIDDEN_CLASSES)) {
    rules[name] = [order++, key, `.${escapeClassName(name)}{display:none!important}`];
  }

  return { version: 1, prefix: UTILITY_PREFIX, media, rules };
}

/**
 * CSS for the given classes only, in cascade order and grouped by media query.
 * Unknown classes are ignored. Mirrors Bestenberg\Styles\Utilities::css_for() in PHP.
 */
export function cssForClasses(map: UtilityMap, classes: Iterable<string>): string {
  const used = [...new Set(classes)]
    .map((name) => map.rules[name])
    .filter((entry): entry is UtilityRuleEntry => entry !== undefined)
    .sort((a, b) => a[0] - b[0]);

  const out: string[] = [];
  let currentMedia: MediaKey = '';
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    out.push(
      currentMedia === ''
        ? buffer.join('')
        : `@media ${map.media[currentMedia]}{${buffer.join('')}}`,
    );
    buffer = [];
  };

  for (const [, media, css] of used) {
    if (media !== currentMedia) {
      flush();
      currentMedia = media;
    }
    buffer.push(css);
  }
  flush();

  return out.join('\n');
}

/** The complete utility stylesheet (used by the editor canvas). */
export function generateUtilitiesCss(map: UtilityMap): string {
  return `/* Generated by \`pnpm generate\` from tokens.json. Do not edit. */\n${cssForClasses(map, Object.keys(map.rules))}\n`;
}
