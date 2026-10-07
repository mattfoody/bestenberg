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
  type Align,
  type Aspect,
  type Justify,
} from '@bestenberg/tokens';
import { z } from 'zod/v4';

/** ["color.primary", …] for a category's name list. */
function refs<C extends string, N extends string>(category: C, names: readonly N[]) {
  return names.map((name) => `${category}.${name}`) as [`${C}.${N}`, ...`${C}.${N}`[]];
}

export const ColorRef = z.enum(refs('color', COLOR_NAMES));
export const SpaceRef = z.enum(refs('space', SPACE_NAMES));
export const FontSizeRef = z.enum(refs('fontSize', FONT_SIZE_NAMES));
export const FontFamilyRef = z.enum(refs('fontFamily', FONT_FAMILY_NAMES));
export const FontWeightRef = z.enum(refs('fontWeight', FONT_WEIGHT_NAMES));
export const LineHeightRef = z.enum(refs('lineHeight', LINE_HEIGHT_NAMES));
export const RadiusRef = z.enum(refs('radius', RADIUS_NAMES));
export const ShadowRef = z.enum(refs('shadow', SHADOW_NAMES));
export const ContainerRef = z.enum(refs('container', CONTAINER_NAMES));

/** "space.4" → "4". */
export function tokenName(ref: string): string {
  return ref.slice(ref.indexOf('.') + 1);
}

const enumOf = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

export const MediaRefSchema = z.strictObject({
  id: z.number().int().positive().optional(),
  url: z.string().min(1),
  alt: z.string().optional(),
});
export type MediaRef = z.infer<typeof MediaRefSchema>;

export const LayoutSchema = z.strictObject({
  display: z.enum(['stack', 'row', 'grid']).optional(),
  columns: z.literal([...GRID_COLUMNS]).optional(),
  gap: SpaceRef.optional(),
  align: enumOf(Object.keys(ALIGN) as Align[]).optional(),
  justify: enumOf(Object.keys(JUSTIFY) as Justify[]).optional(),
  wrap: z.boolean().optional(),
});

/**
 * Visual style for one breakpoint (SCHEMA.md §3). Token references only;
 * unknown keys are rejected, so no raw CSS can enter a document.
 */
export const StyleSchema = z.strictObject({
  layout: LayoutSchema.optional(),
  padding: z.strictObject({ x: SpaceRef.optional(), y: SpaceRef.optional() }).optional(),
  margin: z.strictObject({ top: SpaceRef.optional(), bottom: SpaceRef.optional() }).optional(),
  width: z.union([z.enum(['auto', 'full']), ContainerRef]).optional(),
  background: z
    .union([ColorRef, z.strictObject({ image: MediaRefSchema, overlay: ColorRef.optional() })])
    .optional(),
  color: ColorRef.optional(),
  font: z
    .strictObject({
      family: FontFamilyRef.optional(),
      size: FontSizeRef.optional(),
      weight: FontWeightRef.optional(),
      lineHeight: LineHeightRef.optional(),
      align: z.enum(TEXT_ALIGN).optional(),
    })
    .optional(),
  radius: RadiusRef.optional(),
  shadow: ShadowRef.optional(),
  border: z
    .strictObject({
      width: z.literal([...BORDER_WIDTHS]).optional(),
      color: ColorRef.optional(),
    })
    .optional(),
  aspect: enumOf(Object.keys(ASPECTS) as Aspect[]).optional(),
});

export type Style = z.infer<typeof StyleSchema>;
export type StyleKey = keyof Style;
export const STYLE_KEYS = Object.keys(StyleSchema.shape) as StyleKey[];

export const BREAKPOINTS = ['base', 'tablet', 'desktop'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Mobile-first: `base` applies everywhere, `tablet`/`desktop` override upward. */
export const ResponsiveStyleSchema = z.strictObject({
  base: StyleSchema,
  tablet: StyleSchema.optional(),
  desktop: StyleSchema.optional(),
});
export type ResponsiveStyle = z.infer<typeof ResponsiveStyleSchema>;
