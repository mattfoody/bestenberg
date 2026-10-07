import { className, HIDDEN_CLASSES, utility, type Variant } from '@bestenberg/tokens';
import type { Node } from './document';
import { tokenName, type Breakpoint, type ResponsiveStyle, type Style } from './style';

const VARIANT: Record<Breakpoint, Variant | undefined> = {
  base: undefined,
  tablet: 'md',
  desktop: 'lg',
};

/** Utility classes for one breakpoint's style. Mirrors PHP Bestenberg\Styles\StyleClasses. */
export function styleClasses(style: Style, variant?: Variant): string[] {
  const out: string[] = [];
  const add = (base: string) => out.push(className(base, variant));

  const { layout } = style;
  if (layout) {
    if (layout.display === 'stack') {
      add(utility.flex);
      add(utility.flexCol);
    } else if (layout.display === 'row') {
      add(utility.flex);
      add(utility.flexRow);
    } else if (layout.display === 'grid') {
      add(utility.grid);
    }
    if (layout.columns !== undefined) add(utility.gridCols(layout.columns));
    if (layout.gap) add(utility.gap(tokenName(layout.gap)));
    if (layout.align) add(utility.items(layout.align));
    if (layout.justify) add(utility.justify(layout.justify));
    if (layout.wrap !== undefined) add(utility.wrap(layout.wrap));
  }

  if (style.width === 'auto') add(utility.wAuto);
  else if (style.width === 'full') add(utility.wFull);
  else if (style.width) add(utility.container(tokenName(style.width)));

  if (style.padding?.x) add(utility.px(tokenName(style.padding.x)));
  if (style.padding?.y) add(utility.py(tokenName(style.padding.y)));
  if (style.margin?.top) add(utility.mt(tokenName(style.margin.top)));
  if (style.margin?.bottom) add(utility.mb(tokenName(style.margin.bottom)));

  if (typeof style.background === 'string') {
    add(utility.bg(tokenName(style.background)));
  } else if (style.background) {
    // The image URL itself is an inline style added at render time (SCHEMA.md §6).
    add(utility.bgCover);
    if (style.background.overlay) add(utility.overlay(tokenName(style.background.overlay)));
  }
  if (style.color) add(utility.text(tokenName(style.color)));

  const { font } = style;
  if (font) {
    if (font.family) add(utility.font(tokenName(font.family)));
    if (font.size) add(utility.textSize(tokenName(font.size)));
    if (font.weight) add(utility.fontWeight(tokenName(font.weight)));
    if (font.lineHeight) add(utility.leading(tokenName(font.lineHeight)));
    if (font.align) add(utility.textAlign(font.align));
  }

  if (style.radius) add(utility.rounded(tokenName(style.radius)));
  if (style.shadow) add(utility.shadow(tokenName(style.shadow)));
  if (style.border?.width !== undefined) add(utility.border(style.border.width));
  if (style.border?.color) add(utility.borderColor(tokenName(style.border.color)));
  if (style.aspect) add(utility.aspect(style.aspect));

  return out;
}

/** Classes for all breakpoints: base, then `md:` (tablet), then `lg:` (desktop). */
export function styleToClasses(style?: ResponsiveStyle): string[] {
  if (!style) return [];
  return (['base', 'tablet', 'desktop'] as const).flatMap((bp) => {
    const value = style[bp];
    return value ? styleClasses(value, VARIANT[bp]) : [];
  });
}

/** Exact-range visibility classes for `node.hidden`. */
export function visibilityClasses(hidden?: Node['hidden']): string[] {
  if (!hidden) return [];
  return (['base', 'tablet', 'desktop'] as const)
    .filter((bp) => hidden[bp])
    .map((bp) => HIDDEN_CLASSES[bp].className);
}

/** Every utility class a node needs (deduplicated, stable order). */
export function nodeClasses(node: Pick<Node, 'style' | 'hidden'>): string[] {
  return [...new Set([...styleToClasses(node.style), ...visibilityClasses(node.hidden)])];
}
