import {
  ALIGN,
  ASPECTS,
  BORDER_WIDTHS,
  COLOR_NAMES,
  CONTAINER_NAMES,
  FONT_FAMILY_NAMES,
  FONT_SIZE_NAMES,
  FONT_WEIGHT_NAMES,
  GRID_COLUMNS,
  JUSTIFY,
  LINE_HEIGHT_NAMES,
  RADIUS_NAMES,
  SHADOW_NAMES,
  SPACE_NAMES,
  TEXT_ALIGN,
} from '@bestenberg/tokens';
import { StyleSchema, type Style } from './style';

const refs = (category: string, names: readonly string[]) => names.map((n) => `${category}.${n}`);

/**
 * One single-property style per possible value of every style field. Used by
 * tests, property-style generators and the TS/PHP parity fixtures.
 */
export function sampleStyles(): Style[] {
  const colors = refs('color', COLOR_NAMES);
  const space = refs('space', SPACE_NAMES);
  const raw: unknown[] = [
    ...['stack', 'row', 'grid'].map((display) => ({ layout: { display } })),
    ...GRID_COLUMNS.map((columns) => ({ layout: { columns } })),
    ...space.map((gap) => ({ layout: { gap } })),
    ...Object.keys(ALIGN).map((align) => ({ layout: { align } })),
    ...Object.keys(JUSTIFY).map((justify) => ({ layout: { justify } })),
    ...[true, false].map((wrap) => ({ layout: { wrap } })),
    ...space.flatMap((s) => [{ padding: { x: s } }, { padding: { y: s } }]),
    ...space.flatMap((s) => [{ margin: { top: s } }, { margin: { bottom: s } }]),
    ...['auto', 'full', ...refs('container', CONTAINER_NAMES)].map((width) => ({ width })),
    ...space.map((height) => ({ height })),
    ...colors.map((background) => ({ background })),
    ...colors.map((overlay) => ({ background: { image: { url: '/a.jpg' }, overlay } })),
    { background: { image: { url: '/b.jpg', alt: 'B' } } },
    ...colors.map((color) => ({ color })),
    ...refs('fontFamily', FONT_FAMILY_NAMES).map((family) => ({ font: { family } })),
    ...refs('fontSize', FONT_SIZE_NAMES).map((size) => ({ font: { size } })),
    ...refs('fontWeight', FONT_WEIGHT_NAMES).map((weight) => ({ font: { weight } })),
    ...refs('lineHeight', LINE_HEIGHT_NAMES).map((lineHeight) => ({ font: { lineHeight } })),
    ...TEXT_ALIGN.map((align) => ({ font: { align } })),
    ...refs('radius', RADIUS_NAMES).map((radius) => ({ radius })),
    ...refs('shadow', SHADOW_NAMES).map((shadow) => ({ shadow })),
    ...BORDER_WIDTHS.map((width) => ({ border: { width } })),
    ...colors.map((color) => ({ border: { color } })),
    ...Object.keys(ASPECTS).map((aspect) => ({ aspect })),
  ];
  return raw.map((style) => StyleSchema.parse(style));
}
